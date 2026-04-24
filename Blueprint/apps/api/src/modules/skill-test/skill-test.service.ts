import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Blueprint, BlueprintDocument, SkillTest, SkillTestDocument } from "../shared/schemas";
import { RolePreparationService } from "../role-preparation/role-preparation.service";
import { AiService } from "../shared/ai.service";

@Injectable()
export class SkillTestService {
  private readonly logger = new Logger(SkillTestService.name);

  constructor(
    @InjectModel(SkillTest.name) private readonly testModel: Model<SkillTestDocument>,
    @InjectModel(Blueprint.name) private readonly blueprintModel: Model<BlueprintDocument>,
    private readonly prepService: RolePreparationService,
    private readonly ai: AiService
  ) {}

  async start(studentId: string, roleName: string, skillName: string) {
    const existing = await this.testModel.findOne({ studentId, roleName, skillName, status: "IN_PROGRESS" });
    if (existing) return existing;

    this.logger.log(`Generating AI questions for skill: "${skillName}" (role: "${roleName}")`);
    // generateQuestions always returns at least the fallback — never throws
    const questions = await this.generateQuestions(roleName, skillName).catch(() => this.buildFallback(skillName));
    return this.testModel.create({
      studentId, roleName, skillName, questions, answers: {}, status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
    });
  }

  private async generateQuestions(roleName: string, skillName: string) {
    const fallback = this.buildFallback(skillName);

    const system = `You are a technical interviewer. Return ONLY a valid JSON array of exactly 10 MCQ objects. No markdown, no extra text.
Each object must have exactly these keys:
  "questionNumber": integer (1-10)
  "questionText": string (the question)
  "options": array of exactly 4 strings (the answer choices, not labeled A/B/C/D)
  "correctAnswer": string (must exactly match one of the options strings)
Example:
[{"questionNumber":1,"questionText":"What is X?","options":["Option1","Option2","Option3","Option4"],"correctAnswer":"Option1"}]`;

    const prompt = `Generate 10 MCQ questions to assess proficiency in "${skillName}" for the role of "${roleName}".
The questions should be practical, real-world scenarios ranging from beginner to intermediate difficulty.
Return ONLY the JSON array, nothing else.`;

    const raw = await this.ai.chatJson<any>(prompt, system, null);

    // Normalise — AI sometimes returns { questions: [...] } instead of bare array
    let arr: any[] = [];
    if (Array.isArray(raw)) {
      arr = raw;
    } else if (raw && Array.isArray(raw.questions)) {
      arr = raw.questions;
    } else {
      this.logger.warn(`AI returned unexpected shape for skill "${skillName}"; using fallback.`);
      return fallback;
    }

    // Validate and clean each question
    const cleaned = arr
      .filter((q) => q && q.questionText && Array.isArray(q.options) && q.options.length >= 2)
      .map((q, i) => {
        const opts: string[] = q.options.slice(0, 4).map(String);
        // If correctAnswer is an index letter like "A" map to option
        let correct = String(q.correctAnswer || "").trim();
        if (correct.length === 1 && correct >= "A" && correct <= "D") {
          correct = opts[correct.charCodeAt(0) - 65] ?? opts[0];
        }
        if (!opts.includes(correct)) correct = opts[0]; // guarantee match
        return {
          questionNumber: i + 1,
          questionText: String(q.questionText).trim(),
          options: opts,
          correctAnswer: correct
        };
      })
      .slice(0, 10);

    // Pad to 10 if AI returned fewer
    while (cleaned.length < 10) cleaned.push(fallback[cleaned.length]);

    return cleaned;
  }

  private buildFallback(skillName: string) {
    const topics = [
      "core concept", "best practice", "common pattern", "debugging approach",
      "performance consideration", "design principle", "real-world application",
      "security aspect", "testing strategy", "tooling knowledge"
    ];
    return topics.map((topic, i) => ({
      questionNumber: i + 1,
      questionText: `Regarding ${skillName}: which statement best describes its ${topic}?`,
      options: [
        `Correct understanding of ${skillName} ${topic}`,
        `Partially correct understanding`,
        `Incorrect understanding A`,
        `Incorrect understanding B`
      ],
      correctAnswer: `Correct understanding of ${skillName} ${topic}`
    }));
  }

  getById(testId: string) { return this.testModel.findById(testId); }

  getInProgress(studentId: string, roleName: string, skillName: string) {
    return this.testModel.findOne({ studentId, roleName, skillName, status: "IN_PROGRESS" });
  }

  async answer(testId: string, questionNumber: number, answer: string) {
    const test = await this.testModel.findById(testId);
    if (!test) throw new NotFoundException("Test not found");
    // If already submitted, silently skip (answer came in late — retake race)
    if (test.status !== "IN_PROGRESS") return test;
    const current = (test.toObject().answers || {}) as Record<string, string>;
    current[String(questionNumber)] = answer;
    test.answers = current;
    test.markModified("answers");
    await test.save();
    return test;
  }

  async submit(testId: string, latestAnswers?: Record<string, string>) {
    const test = await this.testModel.findById(testId);
    if (!test) throw new NotFoundException("Test not found");

    // Idempotent: if already scored, return the stored result unchanged
    if (test.status !== "IN_PROGRESS") {
      this.logger.warn(`submit called on non-IN_PROGRESS test ${testId} (status=${test.status}) — returning stored result`);
      return test;
    }

    // Build a plain-object answers map from DB + latest client answers
    // (client always sends its full answers map to cover any fire-and-forget losses)
    const dbAnswers = (test.toObject().answers || {}) as Record<string, string>;
    const merged: Record<string, string> = { ...dbAnswers };
    if (latestAnswers && typeof latestAnswers === "object") {
      for (const [k, v] of Object.entries(latestAnswers)) {
        if (v !== undefined && v !== null) merged[String(k)] = String(v);
      }
    }

    // Score against plain objects (avoids Mongoose proxy quirks)
    const questions = (test.toObject().questions || []) as Array<{
      questionNumber: number;
      correctAnswer: string;
    }>;

    let correct = 0;
    for (const q of questions) {
      const key      = String(q.questionNumber);
      const given    = (merged[key] || "").trim().toLowerCase();
      const expected = (q.correctAnswer || "").trim().toLowerCase();
      if (given && given === expected) correct++;
      this.logger.debug(
        `Q${key}: given="${given.slice(0, 40)}" | expected="${expected.slice(0, 40)}" | ${given === expected ? "✓" : "✗"}`
      );
    }

    const score = Math.round((correct * 100) / Math.max(1, questions.length));
    test.answers = merged;
    test.markModified("answers");
    test.score    = score;
    test.passed   = score >= 75;
    test.status   = test.passed ? "COMPLETED" : "FAILED";
    test.completedAt = new Date().toISOString();
    await test.save();

    this.logger.log(`Test ${testId} submitted — correct: ${correct}/${questions.length}, score: ${score}%, passed: ${test.passed}`);
    if (test.passed) {
      try {
        await this.prepService.markCompletedAfterTest(test.studentId, test.roleName, test.skillName, score);
      } catch (e: any) {
        this.logger.warn(`Passed test could not sync to preparation: ${e?.message || e}`);
      }
    }
    return test;
  }

  latestResult(studentId: string, roleName: string, skillName: string) {
    return this.testModel.findOne({ studentId, roleName, skillName }).sort({ createdAt: -1 });
  }

  /**
   * Returns ALL submitted test results (COMPLETED + FAILED) per attempt
   * for every skill the student has ever tested in this role.
   * Results are sorted: skill name asc, then attempt date desc inside each skill.
   */
  async allResultsByRole(studentId: string, roleName: string) {
    // Fetch every COMPLETED or FAILED test — explicitly exclude stuck IN_PROGRESS
    const tests = await this.testModel
      .find({ studentId, roleName, status: { $in: ["COMPLETED", "FAILED"] } })
      .sort({ skillName: 1, createdAt: -1 })
      .lean();

    if (!tests.length) return [];

    // Group by skill so we can show attempt numbers
    const bySkill = new Map<string, typeof tests>();
    for (const t of tests) {
      if (!t.skillName) continue;
      const arr = bySkill.get(t.skillName) ?? [];
      arr.push(t);
      bySkill.set(t.skillName, arr);
    }

    const results: any[] = [];
    for (const [skillName, attempts] of bySkill) {
      for (let i = 0; i < attempts.length; i++) {
        const t = attempts[i];
        const total   = t.questions?.length ?? 0;
        const correct = (typeof t.score === "number" && total)
          ? Math.round((t.score / 100) * total)
          : null;
        results.push({
          skillName,
          score:        typeof t.score === "number" ? t.score : null,
          passed:       t.passed === true,
          status:       t.status,
          completedAt:  t.completedAt ?? null,
          totalQ:       total,
          correctQ:     correct,
          attemptNo:    i + 1,             // 1 = latest, 2 = second-latest, …
          totalAttempts: attempts.length,
          isLatest:     i === 0,
        });
      }
    }

    // Sort: skill name asc, then attemptNo asc (latest last so newest is at top in UI)
    return results.sort((a, b) => {
      const nc = a.skillName.localeCompare(b.skillName);
      return nc !== 0 ? nc : a.attemptNo - b.attemptNo;
    });
  }
}
