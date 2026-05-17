import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Blueprint, BlueprintDocument, SkillTest, SkillTestDocument } from "../shared/schemas";
import { RolePreparationService } from "../role-preparation/role-preparation.service";
import { AiService } from "../shared/ai.service";

@Injectable()
export class SkillTestService {
  private readonly logger = new Logger(SkillTestService.name);
  private static readonly MAX_ATTEMPTS_PER_TEST = 3;

  constructor(
    @InjectModel(SkillTest.name) private readonly testModel: Model<SkillTestDocument>,
    @InjectModel(Blueprint.name) private readonly blueprintModel: Model<BlueprintDocument>,
    private readonly prepService: RolePreparationService,
    private readonly ai: AiService
  ) {}

  private async assertAttemptLimitSingleSkill(studentId: string, roleName: string, skillName: string, preparationId: string) {
    const attempts = await this.testModel.countDocuments({
      studentId,
      roleName,
      skillName,
      testType: "SINGLE_SKILL",
      preparationId,
    });
    if (attempts >= SkillTestService.MAX_ATTEMPTS_PER_TEST) {
      throw new BadRequestException(
        `Retake limit reached for this preparation. You can attempt this skill test only ${SkillTestService.MAX_ATTEMPTS_PER_TEST} times before stopping and starting preparation again.`
      );
    }
  }

  private async assertAttemptLimitKnownSkills(studentId: string, roleName: string, preparationId: string) {
    const attempts = await this.testModel.countDocuments({
      studentId,
      roleName,
      testType: "KNOWN_SKILLS",
      preparationId,
    });
    if (attempts >= SkillTestService.MAX_ATTEMPTS_PER_TEST) {
      throw new BadRequestException(
        `Retake limit reached for this preparation. You can attempt this combined test only ${SkillTestService.MAX_ATTEMPTS_PER_TEST} times before stopping and starting preparation again.`
      );
    }
  }

  private async currentPreparationId(studentId: string, roleName: string): Promise<string | null> {
    return this.prepService.getPreparationId(studentId, roleName);
  }

  private escapeRegex(value: string) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /** Align URL / user input with catalogue skill names (e.g. "sql" → "SQL"). */
  private async resolveSkillNameAgainstRole(roleName: string, skillName: string): Promise<string> {
    const want = String(skillName || "").trim().toLowerCase();
    const rn = String(roleName || "").trim();
    if (!want || !rn) return String(skillName || "").trim();
    const doc: any = await this.blueprintModel
      .findOne({
        type: { $regex: "^role$", $options: "i" },
        name: { $regex: `^${this.escapeRegex(rn)}$`, $options: "i" },
      })
      .lean();
    if (!doc) return String(skillName || "").trim();
    const names: string[] = [];
    for (const r of doc.skillRequirements || []) {
      const n = String(r?.skillName || "").trim();
      if (n) names.push(n);
    }
    for (const t of doc.skills?.technical || []) {
      const n = String(t || "").trim();
      if (n) names.push(n);
    }
    for (const n of names) {
      if (n.toLowerCase() === want) return n;
    }
    return String(skillName || "").trim();
  }

  async start(studentId: string, roleName: string, skillName: string) {
    const preparationId = await this.currentPreparationId(studentId, roleName);
    if (!preparationId) {
      throw new BadRequestException("Start role preparation for this role before taking a skill test.");
    }
    const resolved = await this.resolveSkillNameAgainstRole(roleName, skillName);
    const existing = await this.testModel.findOne({
      studentId,
      roleName,
      skillName: resolved,
      status: "IN_PROGRESS",
      preparationId,
    });
    if (existing) return existing;
    await this.assertAttemptLimitSingleSkill(studentId, roleName, resolved, preparationId);

    this.logger.log(`Generating AI questions for skill: "${resolved}" (role: "${roleName}")`);
    // generateQuestions always returns at least the fallback — never throws
    const questions = await this.generateQuestions(roleName, resolved).catch(() => this.buildFallback(resolved));
    return this.testModel.create({
      preparationId,
      studentId,
      roleName,
      skillName: resolved,
      testType: "SINGLE_SKILL",
      selectedSkills: [resolved],
      questions,
      answers: {},
      status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
    });
  }

  async startKnownSkillsTest(studentId: string, roleName: string, selectedSkills: string[]) {
    const preparationId = await this.currentPreparationId(studentId, roleName);
    if (!preparationId) {
      throw new BadRequestException("Start role preparation for this role before taking the known-skills test.");
    }
    const skills = this.uniq(selectedSkills.map((s) => String(s || "").trim()).filter(Boolean));
    if (!skills.length) throw new BadRequestException("Please select at least one known skill to start the test");

    const existing = await this.testModel.findOne({
      studentId,
      roleName,
      testType: "KNOWN_SKILLS",
      status: "IN_PROGRESS",
      preparationId,
    });
    if (existing) return existing;
    await this.assertAttemptLimitKnownSkills(studentId, roleName, preparationId);

    const questions = await this.generateKnownSkillsQuestions(roleName, skills).catch(() => this.buildKnownSkillsFallback(skills, skills.length * 5));
    return this.testModel.create({
      preparationId,
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

    const system = `You are a technical interviewer. Return ONLY a valid JSON array of exactly 5 MCQ objects. No markdown, no extra text.
Each object must have exactly these keys:
  "questionNumber": integer (1-5)
  "questionText": string (the question)
  "options": array of exactly 4 strings (the answer choices, not labeled A/B/C/D)
  "correctAnswer": string (must exactly match one of the options strings)
  "skillName": string (must be exactly "${skillName}")
Example:
[{"questionNumber":1,"questionText":"What is X?","options":["Option1","Option2","Option3","Option4"],"correctAnswer":"Option1","skillName":"${skillName}"}]`;

    const prompt = `Generate exactly 5 purely ${skillName}-focused MCQ questions for the role "${roleName}".
Do not ask generic aptitude, communication, or unrelated role questions.
Difficulty split must be exact (medium to hard only):
- 3 medium questions
- 2 hard questions
Questions should be practical and directly test ${skillName} knowledge and application.
Set question numbers from 1 to 5 in ascending order.
Set "skillName" to "${skillName}" for every question.
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
          correctAnswer: correct,
          skillName: String(q.skillName || skillName).trim() || skillName,
        };
      })
      .slice(0, 5);

    // Pad to 5 if AI returned fewer
    while (cleaned.length < 5) cleaned.push(fallback[cleaned.length]);

    return cleaned;
  }

  private async generateKnownSkillsQuestions(roleName: string, selectedSkills: string[]) {
    const questionCount = selectedSkills.length * 5;
    const mediumCount = selectedSkills.length * 3;
    const hardCount = selectedSkills.length * 2;
    const fallback = this.buildKnownSkillsFallback(selectedSkills, questionCount);
    const skillList = selectedSkills.join(", ");
    const system = `You are a technical interviewer. Return ONLY a valid JSON array of exactly ${questionCount} MCQ objects. No markdown, no extra text.
Each object must have exactly these keys:
  "questionNumber": integer (1-${questionCount})
  "questionText": string
  "options": array of exactly 4 strings
  "correctAnswer": string (must exactly match one option)
  "skillName": string (must be exactly one value from: ${skillList}).`;
    const prompt = `Create one combined technical MCQ test for role "${roleName}" covering these known skills: ${skillList}.
Generate exactly ${questionCount} questions, medium to hard only, with exactly 5 questions per skill.
Difficulty split:
- ${mediumCount} medium (3 per skill)
- ${hardCount} hard (2 per skill)
Questions must be practical and strictly skill-related. Avoid aptitude, HR, communication, or generic questions.
Every question must include "skillName" and each listed skill must appear exactly 5 times.
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
          skillName: String(q.skillName || "").trim(),
        };
      })
      .slice(0, questionCount);

    const allowedSkills = new Set(selectedSkills.map((s) => s.toLowerCase()));
    const bySkillCount: Record<string, number> = {};
    const normalized = cleaned.map((q) => {
      const key = String(q.skillName || "").trim().toLowerCase();
      const fallbackSkill = selectedSkills[(q.questionNumber - 1) % selectedSkills.length];
      const chosen = key && allowedSkills.has(key) ? (selectedSkills.find((s) => s.toLowerCase() === key) || fallbackSkill) : fallbackSkill;
      bySkillCount[chosen] = (bySkillCount[chosen] || 0) + 1;
      return { ...q, skillName: chosen };
    });

    const targetPerSkill = 5;
    for (const skill of selectedSkills) {
      let count = bySkillCount[skill] || 0;
      while (count < targetPerSkill && normalized.length < questionCount) {
        const idx = normalized.length + 1;
        const { questionText, options, correctAnswer } = this.buildClearFallbackMcq(skill, "implementation and debugging", "medium");
        normalized.push({ questionNumber: idx, questionText, options, correctAnswer, skillName: skill });
        count++;
      }
      bySkillCount[skill] = count;
    }

    while (normalized.length < questionCount) normalized.push(fallback[normalized.length]);
    return normalized.slice(0, questionCount).map((q, i) => ({ ...q, questionNumber: i + 1 }));
  }

  private buildFallback(skillName: string) {
    const plan = [...Array.from({ length: 3 }, () => "medium"), ...Array.from({ length: 2 }, () => "tough")];
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
      const topic = level === "medium" ? mediumTopics[i % mediumTopics.length] : toughTopics[i % toughTopics.length];
      const { questionText, options, correctAnswer } = this.buildClearFallbackMcq(skillName, topic, level as "easy" | "medium" | "tough");
      return ({
        questionNumber: i + 1,
        questionText,
        options,
        correctAnswer,
        skillName,
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
        skillName: skill,
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

  async getInProgress(studentId: string, roleName: string, skillName: string) {
    const preparationId = await this.currentPreparationId(studentId, roleName);
    if (!preparationId) return null;
    const resolved = await this.resolveSkillNameAgainstRole(roleName, skillName);
    const byResolved = await this.testModel.findOne({
      studentId,
      roleName,
      skillName: resolved,
      status: "IN_PROGRESS",
      preparationId,
    });
    if (byResolved) return byResolved;
    return this.testModel.findOne({
      studentId,
      roleName,
      skillName,
      status: "IN_PROGRESS",
      preparationId,
    });
  }

  async getKnownSkillsInProgress(studentId: string, roleName: string) {
    const preparationId = await this.currentPreparationId(studentId, roleName);
    if (!preparationId) return null;
    return this.testModel.findOne({ studentId, roleName, testType: "KNOWN_SKILLS", status: "IN_PROGRESS", preparationId });
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
    test.score = score;

    const passThreshold = 80;
    const breakdown: Record<string, { correct: number; total: number; score: number; passed: boolean }> = {};
    if (test.testType === "KNOWN_SKILLS") {
      const selected = this.uniq((test.selectedSkills || []).map((s) => String(s || "").trim()).filter(Boolean));
      for (const s of selected) breakdown[s] = { correct: 0, total: 0, score: 0, passed: false };
      for (const q of questions as any[]) {
        const qSkill = String((q as any)?.skillName || "").trim();
        const skill = selected.includes(qSkill) ? qSkill : selected.find((s) => (q.questionText || "").toLowerCase().includes(s.toLowerCase())) || selected[0];
        if (!skill) continue;
        breakdown[skill] = breakdown[skill] || { correct: 0, total: 0, score: 0, passed: false };
        breakdown[skill].total += 1;
        const key = String(q.questionNumber);
        const given = (merged[key] || "").trim().toLowerCase();
        const expected = String(q.correctAnswer || "").trim().toLowerCase();
        if (given && given === expected) breakdown[skill].correct += 1;
      }
      for (const [skill, row] of Object.entries(breakdown)) {
        row.score = Math.round((row.correct * 100) / Math.max(1, row.total));
        row.passed = row.score >= passThreshold;
      }
      test.skillBreakdown = breakdown;
      test.markModified("skillBreakdown");
      const allSkillPass = Object.values(breakdown).every((r) => r.passed);
      test.passed = allSkillPass;
      test.status = allSkillPass ? "COMPLETED" : "FAILED";
    } else {
      test.passed = score >= passThreshold;
      test.status = test.passed ? "COMPLETED" : "FAILED";
    }
    test.completedAt = new Date().toISOString();
    await test.save();

    this.logger.log(`Test ${testId} submitted — correct: ${correct}/${questions.length}, score: ${score}%, passed: ${test.passed}`);
    if (test.testType === "KNOWN_SKILLS") {
      try {
        await this.prepService.markKnownSkillsTestSubmitted(test.studentId, test.roleName);
        const skills = this.uniq((test.selectedSkills || []).map((s) => String(s || "").trim()).filter(Boolean));
        for (const skill of skills) {
          const row = (test.skillBreakdown || {})[skill];
          const skillScore = typeof row?.score === "number" ? row.score : score;
          if (row?.passed) {
            try {
              await this.prepService.markCompletedAfterTest(test.studentId, test.roleName, skill, skillScore);
            } catch (e: any) {
              this.logger.warn(`Known-skill completion sync failed for "${skill}": ${e?.message || e}`);
            }
            await this.prepService.markKnownSkillPassed(test.studentId, test.roleName, skill, skillScore);
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

  async latestResult(studentId: string, roleName: string, skillName: string) {
    const preparationId = await this.currentPreparationId(studentId, roleName);
    if (!preparationId) return null;
    return this.testModel.findOne({ studentId, roleName, skillName, preparationId }).sort({ createdAt: -1 });
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
    type Expanded = { skillName: string; test: any; score: number | null; passed: boolean; totalQ: number; correctQ: number | null; testType: string; selectedSkills: string[] };
    const expanded: Expanded[] = [];
    for (const t of tests) {
      if (t.testType === "KNOWN_SKILLS" && t.skillBreakdown && typeof t.skillBreakdown === "object") {
        for (const [skill, rowAny] of Object.entries(t.skillBreakdown as any)) {
          const row: any = rowAny || {};
          expanded.push({
            skillName: skill,
            test: t,
            score: typeof row.score === "number" ? row.score : null,
            passed: !!row.passed,
            totalQ: Number(row.total || 0),
            correctQ: typeof row.correct === "number" ? row.correct : null,
            testType: "KNOWN_SKILLS",
            selectedSkills: Array.isArray(t.selectedSkills) ? t.selectedSkills : [],
          });
        }
      } else if (t.skillName) {
        const total = t.questions?.length ?? 0;
        const correct = (typeof t.score === "number" && total)
          ? Math.round((t.score / 100) * total)
          : null;
        expanded.push({
          skillName: t.skillName,
          test: t,
          score: typeof t.score === "number" ? t.score : null,
          passed: t.passed === true,
          totalQ: total,
          correctQ: correct,
          testType: t.testType || "SINGLE_SKILL",
          selectedSkills: Array.isArray(t.selectedSkills) ? t.selectedSkills : [],
        });
      }
    }

    const bySkill = new Map<string, Expanded[]>();
    for (const e of expanded) {
      const arr = bySkill.get(e.skillName) ?? [];
      arr.push(e);
      bySkill.set(e.skillName, arr);
    }

    const results: any[] = [];
    for (const [skillName, attempts] of bySkill) {
      for (let i = 0; i < attempts.length; i++) {
        const a = attempts[i];
        const t = a.test;
        results.push({
          skillName,
          testType: a.testType || "SINGLE_SKILL",
          selectedSkills: a.selectedSkills,
          score: a.score,
          passed: a.passed,
          status:       t.status,
          completedAt:  t.completedAt ?? null,
          totalQ:       a.totalQ,
          correctQ:     a.correctQ,
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
