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
      studentId, roleName, skillName, testType: "SINGLE_SKILL", selectedSkills: [skillName], questions, answers: {}, status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
    });
  }

  async startKnownSkillsTest(studentId: string, roleName: string, selectedSkills: string[]) {
    const skills = this.uniq(selectedSkills.map((s) => String(s || "").trim()).filter(Boolean));
    if (!skills.length) throw new BadRequestException("Please select at least one known skill to start the test");

    const existing = await this.testModel.findOne({ studentId, roleName, testType: "KNOWN_SKILLS", status: "IN_PROGRESS" });
    if (existing) return existing;

    const questions = await this.generateKnownSkillsQuestions(roleName, skills).catch(() => this.buildKnownSkillsFallback(skills, 20));
    return this.testModel.create({
      studentId,
      roleName,
      skillName: "KNOWN_SKILLS_COMBINED",
      testType: "KNOWN_SKILLS",
      selectedSkills: skills,
      questions,
      answers: {},
      status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
    });
  }

  private async generateQuestions(roleName: string, skillName: string) {
    const fallback = this.buildFallback(skillName);

    const system = `You are a technical interviewer. Return ONLY a valid JSON array of exactly 20 MCQ objects. No markdown, no extra text.
Each object must have exactly these keys:
  "questionNumber": integer (1-20)
  "questionText": string (the question)
  "options": array of exactly 4 strings (the answer choices, not labeled A/B/C/D)
  "correctAnswer": string (must exactly match one of the options strings)
Example:
[{"questionNumber":1,"questionText":"What is X?","options":["Option1","Option2","Option3","Option4"],"correctAnswer":"Option1"}]`;

    const prompt = `Generate exactly 20 purely ${skillName}-focused MCQ questions for the role "${roleName}".
Do not ask generic aptitude, communication, or unrelated role questions.
Difficulty split must be exact:
- 5 easy questions
- 10 medium questions
- 5 tough questions
Questions should be practical and directly test ${skillName} knowledge and application.
Set question numbers from 1 to 20 in ascending order.
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
      .slice(0, 20);

    // Pad to 20 if AI returned fewer
    while (cleaned.length < 20) cleaned.push(fallback[cleaned.length]);

    return cleaned;
  }

  private async generateKnownSkillsQuestions(roleName: string, selectedSkills: string[]) {
    const questionCount = Math.min(30, Math.max(20, selectedSkills.length * 4));
    const hardCount = Math.max(6, Math.floor(questionCount * 0.35));
    const mediumCount = questionCount - hardCount;
    const fallback = this.buildKnownSkillsFallback(selectedSkills, questionCount);
    const skillList = selectedSkills.join(", ");
    const system = `You are a technical interviewer. Return ONLY a valid JSON array of exactly ${questionCount} MCQ objects. No markdown, no extra text.
Each object must have exactly these keys:
  "questionNumber": integer (1-${questionCount})
  "questionText": string
  "options": array of exactly 4 strings
  "correctAnswer": string (must exactly match one option).`;
    const prompt = `Create one combined technical MCQ test for role "${roleName}" covering these known skills: ${skillList}.
Generate exactly ${questionCount} questions, medium to hard only.
Difficulty split:
- ${mediumCount} medium
- ${hardCount} hard
Questions must be practical and strictly skill-related. Avoid aptitude, HR, communication, or generic questions.
Distribute questions across all listed skills.
Set question numbers from 1 to ${questionCount} in order.
Return only JSON array.`;

    const raw = await this.ai.chatJson<any>(prompt, system, null);
    let arr: any[] = [];
    if (Array.isArray(raw)) arr = raw;
    else if (raw && Array.isArray(raw.questions)) arr = raw.questions;
    else return fallback;

    const cleaned = arr
      .filter((q) => q && q.questionText && Array.isArray(q.options) && q.options.length >= 2)
      .map((q, i) => {
        const opts: string[] = q.options.slice(0, 4).map(String);
        let correct = String(q.correctAnswer || "").trim();
        if (correct.length === 1 && correct >= "A" && correct <= "D") correct = opts[correct.charCodeAt(0) - 65] ?? opts[0];
        if (!opts.includes(correct)) correct = opts[0];
        return {
          questionNumber: i + 1,
          questionText: String(q.questionText).trim(),
          options: opts,
          correctAnswer: correct,
        };
      })
      .slice(0, questionCount);

    while (cleaned.length < questionCount) cleaned.push(fallback[cleaned.length]);
    return cleaned;
  }

  private buildFallback(skillName: string) {
    const plan = [
      ...Array.from({ length: 5 }, () => "easy"),
      ...Array.from({ length: 10 }, () => "medium"),
      ...Array.from({ length: 5 }, () => "tough"),
    ];
    const easyTopics = ["fundamentals", "basic syntax", "simple use-case", "core definitions", "intro setup"];
    const mediumTopics = [
      "best practices",
      "debugging approach",
      "common implementation pattern",
      "real-world scenario",
      "testing strategy",
      "error handling",
      "code organization",
      "performance basics",
      "edge cases",
      "integration usage",
    ];
    const toughTopics = ["advanced optimization", "architecture trade-offs", "security hardening", "complex debugging", "scalability design"];
    return plan.map((level, i) => {
      const topic =
        level === "easy"
          ? easyTopics[i % easyTopics.length]
          : level === "medium"
          ? mediumTopics[(i - 5) % mediumTopics.length]
          : toughTopics[(i - 15) % toughTopics.length];
      const { questionText, options, correctAnswer } = this.buildClearFallbackMcq(skillName, topic, level as "easy" | "medium" | "tough");
      return ({
        questionNumber: i + 1,
        questionText,
        options,
        correctAnswer,
      });
    });
  }

  private buildKnownSkillsFallback(selectedSkills: string[], questionCount: number) {
    const mediumCount = Math.ceil(questionCount * 0.65);
    const hardCount = questionCount - mediumCount;
    const plan = [
      ...Array.from({ length: mediumCount }, () => "medium"),
      ...Array.from({ length: hardCount }, () => "hard"),
    ];
    const skills = selectedSkills.length ? selectedSkills : ["core technical skill"];
    return plan.map((level, i) => {
      const skill = skills[i % skills.length];
      const topic = level === "medium" ? "implementation and debugging" : "architecture and optimization";
      const mappedLevel = level === "medium" ? "medium" : "tough";
      const { questionText, options, correctAnswer } = this.buildClearFallbackMcq(
        skill,
        topic,
        mappedLevel
      );
      return {
        questionNumber: i + 1,
        questionText,
        options,
        correctAnswer,
      };
    });
  }

  private buildClearFallbackMcq(skillName: string, topic: string, level: "easy" | "medium" | "tough") {
    const skill = String(skillName || "the skill").trim();
    const area = String(topic || "a practical task").trim();
    const difficultyLabel = level.toUpperCase();

    const questionText = `[${difficultyLabel}] In ${skill}, which option is the best practice for ${area}?`;
    const correctAnswer = `Use a structured, testable, and maintainable ${skill} approach with clear validation and error handling for ${area}.`;
    const options = [
      correctAnswer,
      `Use a quick implementation for ${area} that works for happy paths but skips robust validation and edge cases.`,
      `Solve ${area} with hardcoded values and minimal checks so delivery is faster now, then patch issues later.`,
      `Rely on ad-hoc fixes for ${area} and avoid tests/documentation to reduce immediate effort.`,
    ];
    return { questionText, options, correctAnswer };
  }

  getById(testId: string) { return this.testModel.findById(testId); }

  getInProgress(studentId: string, roleName: string, skillName: string) {
    return this.testModel.findOne({ studentId, roleName, skillName, status: "IN_PROGRESS" });
  }

  getKnownSkillsInProgress(studentId: string, roleName: string) {
    return this.testModel.findOne({ studentId, roleName, testType: "KNOWN_SKILLS", status: "IN_PROGRESS" });
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
    if (test.testType === "KNOWN_SKILLS") {
      try {
        await this.prepService.markKnownSkillsTestSubmitted(test.studentId, test.roleName);
        const skills = this.uniq((test.selectedSkills || []).map((s) => String(s || "").trim()).filter(Boolean));
        for (const skill of skills) {
          if (test.passed) {
            await this.prepService.markKnownSkillPassed(test.studentId, test.roleName, skill, score);
          } else {
            await this.prepService.markKnownSkillFailed(test.studentId, test.roleName, skill);
          }
        }
      } catch (e: any) {
        this.logger.warn(`Combined known skills test could not unlock preparation gate: ${e?.message || e}`);
      }
      return test;
    }

    if (test.passed) {
      try {
        await this.prepService.markCompletedAfterTest(test.studentId, test.roleName, test.skillName, score);
        await this.prepService.markKnownSkillPassed(test.studentId, test.roleName, test.skillName, score);
      } catch (e: any) {
        this.logger.warn(`Passed test could not sync to preparation: ${e?.message || e}`);
      }
    } else {
      try {
        await this.prepService.markKnownSkillFailed(test.studentId, test.roleName, test.skillName);
      } catch (e: any) {
        this.logger.warn(`Failed test could not sync back to blueprint: ${e?.message || e}`);
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
          testType: t.testType || "SINGLE_SKILL",
          selectedSkills: Array.isArray(t.selectedSkills) ? t.selectedSkills : [],
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

  private uniq(items: string[]) {
    return Array.from(new Set(items.map((s) => String(s || "").trim()).filter(Boolean)));
  }
}
