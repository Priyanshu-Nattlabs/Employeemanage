import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Blueprint, BlueprintDocument, RolePreparation, RolePreparationDocument, UserProfile, UserProfileDocument } from "../shared/schemas";
import { AiService } from "../shared/ai.service";

@Injectable()
export class BlueprintService {
  private readonly logger = new Logger(BlueprintService.name);
  private readonly jsearchHost = "jsearch.p.rapidapi.com";
  private readonly jsearchTtlMs = 10 * 60 * 1000; // 10 minutes
  private readonly jsearchCache = new Map<string, { at: number; data: any }>();

  constructor(
    @InjectModel(Blueprint.name) private readonly blueprintModel: Model<BlueprintDocument>,
    @InjectModel(RolePreparation.name) private readonly prepModel: Model<RolePreparationDocument>,
    @InjectModel(UserProfile.name) private readonly profileModel: Model<UserProfileDocument>,
    private readonly ai: AiService
  ) {}

  getAllBlueprints() { return this.blueprintModel.find().lean(); }
  getByType(type: string) {
    const t = String(type || "").trim();
    return this.blueprintModel.find({ type: { $regex: `^${this.escapeRegex(t)}$`, $options: "i" } }).lean();
  }
  async getNamesByType(type: string) { return (await this.getByType(type)).map((d) => d.name); }
  async getDocByTypeAndName(type: string, name: string) {
    const t = String(type || "").trim();
    const n = String(name || "").trim();
    return this.blueprintModel
      .findOne({
        type: { $regex: `^${this.escapeRegex(t)}$`, $options: "i" },
        name: { $regex: `^${this.escapeRegex(n)}$`, $options: "i" },
      })
      .lean();
  }
  async getRole(roleName: string, level?: string) {
    const rn = String(roleName || "").trim();
    const lvl = String(level || "").trim();
    const query: any = {
      type: { $regex: "^role$", $options: "i" },
      name: { $regex: `^${this.escapeRegex(rn)}$`, $options: "i" },
    };
    if (lvl) query.level = { $regex: `^${this.escapeRegex(lvl)}$`, $options: "i" };
    const role: any = await this.blueprintModel
      .findOne(query)
      .lean();
    if (!role) return null;
    const skillRequirements = (role.skillRequirements || []).length
      ? (role.skillRequirements || [])
      : this.buildSkillRequirementsFromLegacySkills(role.skills || {});
    const description =
      role.description ||
      role?.jobDescription?.summary ||
      role?.jobDescription?.responsibilities ||
      "";
    return { ...role, skillRequirements, description };
  }

  private extractRoleSkillNames(role: any): string[] {
    const fromReq = Array.isArray(role?.skillRequirements)
      ? role.skillRequirements.map((s: any) => String(s?.skillName || "").trim()).filter(Boolean)
      : [];
    const fromTech = Array.isArray(role?.skills?.technical)
      ? role.skills.technical.map((s: any) => String(s || "").trim()).filter(Boolean)
      : [];
    const fromSoft = Array.isArray(role?.skills?.soft)
      ? role.skills.soft.map((s: any) => String(s || "").trim()).filter(Boolean)
      : [];
    return Array.from(new Set([...fromReq, ...fromTech, ...fromSoft]));
  }

  async getSkillProficiencyDelta(roleName: string, level?: string) {
    const lvl = Number(String(level || "").trim());
    if (!Number.isFinite(lvl) || lvl <= 1) {
      return { roleName, level: String(level || ""), previousLevel: "", items: [] as any[] };
    }

    const current = await this.getRole(roleName, String(lvl));
    const previous = await this.getRole(roleName, String(lvl - 1));
    if (!current || !previous) {
      return { roleName, level: String(lvl), previousLevel: String(lvl - 1), items: [] as any[] };
    }

    const currentSkills = this.extractRoleSkillNames(current);
    const previousSkills = this.extractRoleSkillNames(previous);
    const norm = (v: string) => String(v || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    const prevMap = new Map(previousSkills.map((s) => [norm(s), s]));
    const exactMatches = currentSkills
      .map((s) => ({ currentSkill: s, previousSkill: prevMap.get(norm(s)) || null, similarityType: "exact" as const }))
      .filter((x) => !!x.previousSkill);

    const unmatchedCurrent = currentSkills.filter((s) => !prevMap.has(norm(s)));
    const unmatchedPrevSet = new Set(previousSkills.map((s) => s.toLowerCase()));
    const unmatchedPrevious = previousSkills.filter((s) => !exactMatches.some((m) => String(m.previousSkill || "").toLowerCase() === s.toLowerCase()));

    const tokenSet = (v: string) => new Set(norm(v).split(" ").filter(Boolean));
    const heuristicSimilar: Array<{ currentSkill: string; previousSkill: string; similarityType: "similar" }> = [];
    for (const cur of unmatchedCurrent) {
      let bestPrev = "";
      let bestScore = 0;
      const curNorm = norm(cur);
      const curTokens = tokenSet(cur);
      for (const prevSkill of unmatchedPrevious) {
        if (!unmatchedPrevSet.has(prevSkill.toLowerCase())) continue;
        const prevNorm = norm(prevSkill);
        let score = 0;
        if (curNorm.includes(prevNorm) || prevNorm.includes(curNorm)) score += 3;
        const prevTokens = tokenSet(prevSkill);
        const inter = Array.from(curTokens).filter((t) => prevTokens.has(t)).length;
        if (inter > 0) score += inter;
        if (score > bestScore) {
          bestScore = score;
          bestPrev = prevSkill;
        }
      }
      if (bestPrev && bestScore >= 2) {
        heuristicSimilar.push({ currentSkill: cur, previousSkill: bestPrev, similarityType: "similar" });
        unmatchedPrevSet.delete(bestPrev.toLowerCase());
      }
    }

    const aiPairFallback = heuristicSimilar.map((m) => ({ currentSkill: m.currentSkill, previousSkill: m.previousSkill, similarityType: "similar" }));
    const aiPairSystem = `You map skill names across adjacent levels. Return ONLY valid JSON.`;
    const aiPairPrompt = `Role: ${roleName}
Current level: ${lvl}
Previous level: ${lvl - 1}

Current level skills not matched exactly:
${unmatchedCurrent.map((s) => `- ${s}`).join("\n") || "- none"}

Previous level skills available:
${unmatchedPrevious.map((s) => `- ${s}`).join("\n") || "- none"}

Map only truly similar skills (examples: "Excel" and "Advanced Excel", "SQL" and "Advanced SQL").

Return:
{
  "pairs": [
    { "currentSkill": "current name", "previousSkill": "previous name", "similarityType": "similar" }
  ]
}

Rules:
- Do not invent new names
- Use exact names from provided lists
- Include only high-confidence similar pairs
- No markdown`;
    const aiPairsOut = await this.ai.chatJson<any>(aiPairPrompt, aiPairSystem, { pairs: aiPairFallback });
    const aiPairs = Array.isArray(aiPairsOut?.pairs) ? aiPairsOut.pairs : aiPairFallback;
    const aiSimilar = aiPairs
      .map((p: any) => ({
        currentSkill: String(p?.currentSkill || "").trim(),
        previousSkill: String(p?.previousSkill || "").trim(),
        similarityType: "similar" as const,
      }))
      .filter((p: any) => p.currentSkill && p.previousSkill && unmatchedCurrent.includes(p.currentSkill) && unmatchedPrevious.includes(p.previousSkill));

    const matchedByCurrent = new Map<string, { previousSkill: string; similarityType: "exact" | "similar" }>();
    for (const m of exactMatches) matchedByCurrent.set(m.currentSkill, { previousSkill: String(m.previousSkill), similarityType: "exact" });
    for (const m of heuristicSimilar) if (!matchedByCurrent.has(m.currentSkill)) matchedByCurrent.set(m.currentSkill, { previousSkill: m.previousSkill, similarityType: "similar" });
    for (const m of aiSimilar) if (!matchedByCurrent.has(m.currentSkill)) matchedByCurrent.set(m.currentSkill, { previousSkill: m.previousSkill, similarityType: "similar" });

    const matchedCurrentSkills = Array.from(matchedByCurrent.keys());
    if (!matchedCurrentSkills.length) {
      return { roleName, level: String(lvl), previousLevel: String(lvl - 1), items: [] as any[] };
    }

    const currentReqMap = new Map(
      (current.skillRequirements || []).map((s: any) => [String(s?.skillName || "").trim().toLowerCase(), s])
    );
    const previousReqMap = new Map(
      (previous.skillRequirements || []).map((s: any) => [String(s?.skillName || "").trim().toLowerCase(), s])
    );

    const fallbackItems = matchedCurrentSkills.map((skillName) => {
      const pair = matchedByCurrent.get(skillName)!;
      const c = currentReqMap.get(skillName.toLowerCase()) || {};
      const p = previousReqMap.get(String(pair.previousSkill || "").toLowerCase()) || {};
      const cMonths = Math.max(1, Number(c?.timeRequiredMonths || 1));
      const pMonths = Math.max(1, Number(p?.timeRequiredMonths || 1));
      const monthDelta = Math.max(0, cMonths - pMonths);
      const diffRank = (d: string) => {
        const x = String(d || "").toLowerCase();
        if (x.includes("advanced")) return 3;
        if (x.includes("intermediate")) return 2;
        return 1;
      };
      const diffDelta = Math.max(0, diffRank(c?.difficulty) - diffRank(p?.difficulty));
      const similarityBonus = pair.similarityType === "similar" ? 6 : 0;
      const increasePct = Math.min(70, Math.max(8, 12 + monthDelta * 6 + diffDelta * 10 + similarityBonus));
      return {
        skillName,
        increasePct,
        reason: pair.similarityType === "similar"
          ? `Progression from "${pair.previousSkill}" to deeper variant.`
          : "More depth and practical complexity expected at this level.",
        previousSkill: pair.previousSkill,
        similarityType: pair.similarityType,
      };
    });

    const system = `You are a technical learning evaluator. Return ONLY valid JSON.`;
    const prompt = `Role: ${roleName}
Current level: ${lvl}
Previous level: ${lvl - 1}

Estimate proficiency increase for these matched skills from previous level to current level.
Matched skills:
${matchedCurrentSkills.map((s) => {
  const p = matchedByCurrent.get(s)!;
  return `- current: ${s} | previous: ${p.previousSkill} | type: ${p.similarityType}`;
}).join("\n")}

Return JSON object:
{
  "items": [
    { "skillName": "name", "increasePct": number_between_5_and_70, "reason": "short reason under 12 words", "previousSkill": "name", "similarityType": "exact_or_similar" }
  ]
}

Rules:
- Include ONLY the listed matched current skills
- Keep skillName exactly as provided for current skill
- increasePct should reflect higher depth/complexity at current level
- For similar pairs (e.g., Excel -> Advanced Excel), assign meaningful increase
- No markdown`;

    const aiOut = await this.ai.chatJson<any>(prompt, system, { items: fallbackItems });
    const rawItems = Array.isArray(aiOut?.items) ? aiOut.items : fallbackItems;
    const allowed = new Set(matchedCurrentSkills.map((s) => s.toLowerCase()));
    const normalized = rawItems
      .map((it: any) => ({
        skillName: String(it?.skillName || "").trim(),
        increasePct: Math.max(5, Math.min(70, Number(it?.increasePct) || 0)),
        reason: String(it?.reason || "").trim(),
        previousSkill: String(it?.previousSkill || "").trim(),
        similarityType: String(it?.similarityType || "").toLowerCase() === "similar" ? "similar" : "exact",
      }))
      .filter((it: any) => it.skillName && allowed.has(it.skillName.toLowerCase()));

    const dedup = new Map<string, any>();
    for (const it of normalized) {
      const k = it.skillName.toLowerCase();
      if (!dedup.has(k)) dedup.set(k, it);
    }
    const items = Array.from(dedup.values());
    return { roleName, level: String(lvl), previousLevel: String(lvl - 1), items: items.length ? items : fallbackItems };
  }
  async getAllSkillNames(query?: string) {
    const docs = await this.blueprintModel.find().lean();
    const set = new Set<string>();
    for (const d of docs) for (const s of d.skillRequirements || []) if (s.skillName) set.add(s.skillName.trim());
    let all = Array.from(set).sort();
    if (query?.trim()) all = all.filter((s) => s.toLowerCase().includes(query.toLowerCase().trim()));
    return all;
  }

  async getRoleWithGantt(roleName: string, userId: string, duration?: number, level?: string) {
    try {
      const role = await this.getRole(roleName, level);
      if (!role) return null;
      const prep = await this.prepModel.findOne({ studentId: userId, roleName }).lean().catch(() => null);
      const completed = Object.entries((prep as any)?.skillProgress || {})
        .filter(([, v]: any) => v?.completed)
        .map(([k]) => k);
      const totalMonths = duration && duration > 0 ? duration : await this.getRemainingMonths(userId).catch(() => 12);
      const skillRequirements = role.skillRequirements || [];
      const plan = this.generateDeterministicPlan(skillRequirements, completed, totalMonths);
      const description =
        role.description ||
        ((role as any).jobDescription?.summary as string) ||
        ((role as any).jobDescription?.responsibilities as string) ||
        "";
      return { ...role, description, skillRequirements, plan };
    } catch (e) {
      this.logger.error(`getRoleWithGantt: unexpected error for "${roleName}" / user "${userId}": ${e}`);
      const role = await this.getRole(roleName, level).catch(() => null);
      if (!role) return null;
      const plan = this.generateDeterministicPlan(role.skillRequirements || [], [], 12);
      return { ...role, plan, aiEnhanced: false, _fallback: true };
    }
  }

  /**
   * Replan an existing skill list without calling AI.
   * Used by the "Customize Chart → Apply" modal so skill names stay consistent.
   */
  async replanGantt(roleName: string, body: { skills: any[]; priorityOrder?: string[]; breakMonths?: number[]; duration?: number }) {
    const { skills = [], priorityOrder, breakMonths = [], duration } = body;
    const totalMonths = duration && duration > 0
      ? duration
      : Math.max(12, skills.reduce((s: number, k: any) => s + Math.max(1, Number(k.timeRequiredMonths || 1)), 0));

    // Apply priority order
    const hasPriority = Array.isArray(priorityOrder) && priorityOrder.length > 0;
    const sortedSkills = [...skills];
    if (hasPriority) {
      const pm = new Map(priorityOrder.map((n, i) => [n, i]));
      sortedSkills.sort((a, b) => (pm.get(a.skillName) ?? 9999) - (pm.get(b.skillName) ?? 9999));
    }

    // When the user has set an explicit order, strip AI-generated prerequisites so
    // the topo sort cannot override the user's chosen sequence.
    const planSkills = hasPriority
      ? sortedSkills.map(s => ({ ...s, prerequisites: [] }))
      : sortedSkills;

    const plan = this.generateDeterministicPlan(planSkills, [], totalMonths, breakMonths);
    return { skillRequirements: sortedSkills, plan, aiEnhanced: true, customized: true };
  }

  /**
   * AI-generated contextual JD + skills for a role within a specific
   * industry / education / specialization combination.
   */
  async getContextualRole(roleName: string, industry?: string, education?: string, specialization?: string, level?: string) {
    const role = await this.getRole(roleName, level);
    if (!role) return null;
    if (!industry && !education && !specialization) return role;

    const context = [
      industry  && `Industry: ${industry}`,
      education && `Education background: ${education}`,
      specialization && `Specialization: ${specialization}`,
    ].filter(Boolean).join("; ");

    const system = `You are a senior HR specialist and curriculum designer. Return ONLY a valid JSON object. No markdown, no extra text.`;

    const prompt = `Create a specialised role profile for: "${roleName}"
Context: ${context}

Return a JSON object with exactly these fields:
{
  "description": "2–3 sentence role description specific to this context",
  "jobDescription": {
    "summary": "role summary specific to this selected context",
    "industry": "${industry || "General"}",
    "responsibilities": "5 responsibilities specific to this selected industry/education/specialization context, separated by semicolons",
    "requirements": "key academic and experience requirements for this context",
    "expectedSalary": "estimated salary range for this selected context"
  },
  "skillRequirements": [
    {
      "skillName": "exact skill name",
      "skillType": "technical" or "non-technical",
      "timeRequiredMonths": integer 1-6,
      "difficulty": "beginner" or "intermediate" or "advanced",
      "importance": "Essential" or "Important" or "Good to have",
      "description": "why this skill matters in this selected context",
      "prerequisites": [],
      "isOptional": false
    }
  ]
}

Rules:
- Generate at most 10 skills total that reflect what "${roleName}" does specifically in this context: ${context}
- Skills MUST differ from a generic ${roleName} — reflect this specific context deeply (industry + education + specialization when provided)
- Mix of 60% technical and 40% soft/non-technical skills
- Order skills from foundational to advanced`;

    let raw: any = null;
    try {
      raw = await this.ai.chatJson<any>(prompt, system, null);
    } catch (e) {
      this.logger.warn(`getContextualRole: provider call failed for "${roleName}" in "${industry || "General"}" — using generic fallback. Error: ${e}`);
      return { ...role, isContextual: false };
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      this.logger.warn(`getContextualRole: AI returned invalid data for "${roleName}" in "${industry}" — using generic.`);
      return { ...role, isContextual: false };
    }

    const skillRequirements = Array.isArray(raw.skillRequirements) && raw.skillRequirements.length > 0
      ? raw.skillRequirements
          .map((s: any) => ({
            skillName: String(s.skillName || "").trim(),
            skillType: (() => {
              const st = String(s.skillType || "technical").toLowerCase();
              return st.includes("soft") || st.includes("non") ? "non-technical" : "technical";
            })(),
            timeRequiredMonths: Math.max(1, Math.min(6, Number(s.timeRequiredMonths) || 2)),
            difficulty: s.difficulty || "intermediate",
            importance: s.importance || "Important",
            description: s.description || "",
            prerequisites: Array.isArray(s.prerequisites) ? s.prerequisites : [],
            isOptional: !!s.isOptional,
          }))
          .filter((s: any) => s.skillName)
          .slice(0, 10)
      : role.skillRequirements;

    return {
      ...role,
      description:      raw.description      || role.description,
      jobDescription:   raw.jobDescription   || role.jobDescription,
      skillRequirements,
      skills: {
        technical: skillRequirements.filter((s: any) => s.skillType === "technical").map((s: any) => s.skillName),
        soft:      skillRequirements.filter((s: any) => s.skillType === "non-technical").map((s: any) => s.skillName),
      },
      isContextual:     true,
      contextIndustry:  industry  || null,
      contextEducation: education || null,
      contextSpecialization: specialization || null,
    };
  }

  async getSkillTopics(roleName: string, skillName: string, startMonth: number, endMonth: number) {
    const duration = Math.max(1, endMonth - startMonth + 1);

    // Fallback: sensible default topics
    const fallback: Record<number, string[]> = {};
    const defaultPhases = ["Core Fundamentals", "Hands-on Practice", "Projects & Revision"];
    for (let i = 0; i < duration; i++) {
      fallback[startMonth + i] = [defaultPhases[i % defaultPhases.length], `${skillName} deep-dive`, "Review & self-test"];
    }
    const fallbackRel: Record<string, string[]> = {};
    for (let i = 0; i < duration; i++) fallbackRel[String(i + 1)] = fallback[startMonth + i];

    const system = `You are a curriculum designer. Return ONLY a valid JSON object mapping relative month numbers (as string keys "1", "2", ...) to arrays of 3-5 specific learning topics for that month. No markdown, no extra text.
Example for 2 months: {"1":["Intro to X","Basic syntax","First project"],"2":["Advanced X","Real-world usage","Assessment"]}`;

    const prompt = `Create a month-by-month study plan for the skill "${skillName}" as required for the role "${roleName}".
Duration: ${duration} month(s).
Keys must be "1" through "${duration}" (relative month numbers).
Each value must be an array of 3-5 specific, actionable learning topics.
Return ONLY the JSON object.`;

    const raw = await this.ai.chatJson<Record<string, string[]>>(prompt, system, fallbackRel);

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      this.logger.warn(`getSkillTopics: AI returned invalid shape for "${skillName}", using fallback.`);
      return fallback;
    }

    // Map relative keys ("1","2",...) to absolute month numbers
    const mapped: Record<number, string[]> = {};
    for (const [k, v] of Object.entries(raw)) {
      const rel = parseInt(k, 10);
      if (!Number.isNaN(rel) && rel >= 1 && rel <= duration && Array.isArray(v)) {
        mapped[startMonth + rel - 1] = v.map(String).filter(Boolean).slice(0, 6);
      }
    }

    // If AI response had no valid keys, fall back
    if (Object.keys(mapped).length === 0) return fallback;
    return mapped;
  }

  /** Lower = drop first when the plan does not fit in `totalMonths` (optional → good-to-have → important → essential). */
  private importanceDropRank(s: any): number {
    if (s.isOptional) return 0;
    const i = String(s.importance || "").toLowerCase();
    if (i.includes("good")) return 1;
    if (i.includes("essential")) return 3;
    return 2;
  }

  private pickSkillToDrop(pool: any[]): any {
    let best = pool[0];
    for (const s of pool) {
      const ra = this.importanceDropRank(s);
      const rb = this.importanceDropRank(best);
      if (ra < rb) best = s;
      else if (ra === rb) {
        const ta = Math.max(1, Number(s.timeRequiredMonths || 1));
        const tb = Math.max(1, Number(best.timeRequiredMonths || 1));
        if (ta > tb) best = s;
      }
    }
    return best;
  }

  /**
   * Schedules skills within a fixed horizon `totalMonths` using parallel monthly capacity.
   * Never extends the timeline: if the plan does not fit, least-important skills are omitted first.
   */
  private generateDeterministicPlan(
    skillRequirements: any[],
    completedSkills: string[],
    totalMonths: number,
    breakMonthNums: number[] = [],
  ) {
    const horizon = Math.max(1, totalMonths);
    const breakSet = new Set(breakMonthNums);

    const BASE_MONTHLY_BUDGET = 4;
    const MAX_MONTHLY_BUDGET = 8;
    const diffCost = (d: string): number => {
      const dl = (d || "intermediate").toLowerCase();
      if (dl === "advanced") return 3;
      if (dl === "beginner") return 1;
      return 2;
    };

    const skills = skillRequirements
      .filter((s) => !completedSkills.includes(s.skillName))
      .map((s) => ({ ...s, timeRequiredMonths: Math.max(1, Number(s.timeRequiredMonths || 1)) }));

    const required = skills.filter((s) => !s.isOptional);
    const optional = skills.filter((s) => !!s.isOptional);
    let pool = [...required, ...optional];

    const warnings: string[] = [];

    const trySchedule = (ordered: any[], monthlyBudget: number): { tasks: any[]; topo: any[] } | null => {
      const map = new Map(ordered.map((s) => [s.skillName, s]));
      const visiting = new Set<string>();
      const visited = new Set<string>();
      const topo: any[] = [];
      const dfs = (name: string): boolean => {
        if (visited.has(name)) return true;
        if (visiting.has(name)) return false;
        visiting.add(name);
        const node = map.get(name);
        for (const p of node?.prerequisites || []) if (map.has(p) && !dfs(p)) return false;
        visiting.delete(name);
        visited.add(name);
        if (node) topo.push(node);
        return true;
      };
      for (const s of ordered) {
        if (!dfs(s.skillName)) return null;
      }

      const usedBudget = new Map<number, number>();

      const placeSkill = (fromMonth: number, dur: number, cost: number): { start: number; end: number } | null => {
        const startLower = Math.max(1, fromMonth);
        for (let startM = startLower; startM <= horizon; startM++) {
          if (breakSet.has(startM)) continue;

          let m = startM;
          let count = 0;
          let endM = startM;
          let fits = true;
          const simUsed = new Map(usedBudget);

          while (count < dur) {
            if (m > horizon) {
              fits = false;
              break;
            }
            if (breakSet.has(m)) {
              m++;
              continue;
            }
            const avail = monthlyBudget - (simUsed.get(m) ?? 0);
            if (avail < cost) {
              fits = false;
              break;
            }
            simUsed.set(m, (simUsed.get(m) ?? 0) + cost);
            endM = m;
            count++;
            m++;
          }

          if (fits && endM <= horizon) {
            m = startM;
            count = 0;
            while (count < dur) {
              if (breakSet.has(m)) {
                m++;
                continue;
              }
              usedBudget.set(m, (usedBudget.get(m) ?? 0) + cost);
              count++;
              m++;
            }
            return { start: startM, end: endM };
          }
        }
        return null;
      };

      const tasks: any[] = [];
      const endBySkill: Record<string, number> = {};

      for (const s of topo) {
        const prereqNames = (s.prerequisites || []).filter((p: string) => map.has(p));
        const prereqEnd = prereqNames.length ? Math.max(...prereqNames.map((p: string) => endBySkill[p] || 0)) : 0;
        const fromMonth = prereqEnd + 1;
        const cost = diffCost(s.difficulty);
        const placed = placeSkill(fromMonth, s.timeRequiredMonths, cost);
        if (!placed) return null;

        const { start, end } = placed;
        endBySkill[s.skillName] = end;
        tasks.push({
          id: `skill_${s.skillName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "")}`,
          name: s.skillName,
          start,
          end,
          difficulty: s.difficulty || "intermediate",
          importance: s.importance || "Important",
          type: (() => {
            const st = (s.skillType || "technical").toLowerCase();
            return st.includes("soft") || st.includes("non") ? "non-technical" : "technical";
          })(),
          description: s.description || "",
          timeRequired: s.timeRequiredMonths,
          progress: 0,
          isOptional: !!s.isOptional,
        });
      }

      for (let i = 0; i < tasks.length; i++) {
        const a = tasks[i];
        a.parallel = tasks.some((b, j) => j !== i && b.start <= a.end && b.end >= a.start);
      }

      return { tasks, topo };
    };

    while (pool.length) {
      const subpool = pool.map((s) => ({
        ...s,
        prerequisites: (s.prerequisites || []).filter((p: string) => pool.some((x) => x.skillName === p)),
      }));
      const ordered = [...subpool.filter((s) => !s.isOptional), ...subpool.filter((s) => !!s.isOptional)];

      // First try the normal monthly capacity. If it doesn't fit, increase effective
      // parallel capacity before omitting skills. This avoids unnecessary skipping.
      let result: { tasks: any[]; topo: any[] } | null = null;
      for (let monthlyBudget = BASE_MONTHLY_BUDGET; monthlyBudget <= MAX_MONTHLY_BUDGET; monthlyBudget++) {
        result = trySchedule(ordered, monthlyBudget);
        if (result) {
          if (monthlyBudget > BASE_MONTHLY_BUDGET) {
            warnings.push(`Increased parallelism to fit timeline (monthly capacity ${monthlyBudget}/${BASE_MONTHLY_BUDGET} baseline).`);
          }
          break;
        }
      }
      if (result) {
        const { tasks } = result;
        return {
          chartType: "gantt",
          totalMonths: horizon,
          breakMonths: breakMonthNums,
          labels: Array.from({ length: horizon }, (_, i) => `Month ${i + 1}`),
          tasks,
          warnings,
        };
      }

      const victim = this.pickSkillToDrop(pool);
      warnings.push(`Plan limited to ${horizon} month(s); omitted (lowest priority): ${victim.skillName}`);
      pool = pool.filter((s) => s.skillName !== victim.skillName);
    }

    return {
      chartType: "gantt",
      totalMonths: horizon,
      breakMonths: breakMonthNums,
      labels: Array.from({ length: horizon }, (_, i) => `Month ${i + 1}`),
      tasks: [],
      warnings: warnings.length ? warnings : ["No skills left to schedule after fitting the time horizon."],
    };
  }

  private buildSkillRequirementsFromLegacySkills(skills: Record<string, any>) {
    const technical = Array.isArray(skills?.technical) ? skills.technical : [];
    const soft = Array.isArray(skills?.soft) ? skills.soft : [];
    const all = [
      ...technical.map((s: string) => ({ name: s, type: "technical" })),
      ...soft.map((s: string) => ({ name: s, type: "non-technical" }))
    ];
    return all.map((s, i) => ({
      skillName: s.name,
      skillType: s.type,
      timeRequiredMonths: s.type === "technical" ? 2 : 1,
      difficulty: s.type === "technical" ? (i % 3 === 0 ? "intermediate" : "beginner") : "beginner",
      importance: i < Math.ceil(all.length / 2) ? "Essential" : "Important",
      description: `${s.name} for role readiness`,
      prerequisites: [],
      isOptional: false
    }));
  }

  async getRemainingMonths(userId: string): Promise<number> {
    const profile = await this.profileModel.findOne({ userId }).lean();
    const y = Number(profile?.expectedGraduationYear || "");
    const m = Number(profile?.expectedGraduationMonth || "");
    if (!y || Number.isNaN(y)) return 12;
    const month = m >= 1 && m <= 12 ? m : 6;
    const now = new Date();
    const grad = new Date(y, month - 1, 1);
    const diff = (grad.getFullYear() - now.getFullYear()) * 12 + (grad.getMonth() - now.getMonth());
    if (diff <= 0) return 3;
    return Math.min(60, diff);
  }

  async map(entityType: string, entityName: string, targetField: "roles" | "educations" | "specializations", value: string) {
    const doc = await this.blueprintModel.findOne({ type: entityType, name: entityName });
    if (!doc) return false;
    const arr = ((doc as any)[targetField] || []) as string[];
    if (!arr.includes(value)) arr.push(value);
    (doc as any)[targetField] = arr;
    await doc.save();
    return true;
  }

  async unmap(entityType: string, entityName: string, targetField: "roles" | "educations" | "specializations", value: string) {
    const doc = await this.blueprintModel.findOne({ type: entityType, name: entityName });
    if (!doc) return false;
    (doc as any)[targetField] = (((doc as any)[targetField] || []) as string[]).filter((x) => x !== value);
    await doc.save();
    return true;
  }

  async roleMappings(roleName: string) {
    const [industryDocs, educationDocs, specializationDocs, roleDoc] = await Promise.all([
      this.blueprintModel.find({ type: "industry", roles: roleName }).lean(),
      this.blueprintModel.find({ type: "education", roles: roleName }).lean(),
      this.blueprintModel.find({ type: "specialization", roles: roleName }).lean(),
      this.blueprintModel.findOne({ type: "role", name: roleName }).lean()
    ]);

    // Primary: back-references from industry/education docs
    let industries = industryDocs.map((d) => d.name);
    let educations = educationDocs.map((d) => d.name);
    let specializations = specializationDocs.map((d) => d.name);

    // Fallback: use the role document's own fields when back-references are empty
    const rd = roleDoc as any;
    if (industries.length === 0 && Array.isArray(rd?.industries)) {
      industries = rd.industries.filter(Boolean);
    }
    // Role docs often use `specializations` as industry category tags (e.g. ["Healthcare"])
    if (industries.length === 0 && Array.isArray(rd?.specializations)) {
      industries = rd.specializations.filter(Boolean);
    }
    if (educations.length === 0 && Array.isArray(rd?.educations)) {
      educations = rd.educations.filter(Boolean);
    }

    return { industries, educations, specializations };
  }

  /**
   * Aggregates study links from free public APIs (no keys):
   * - Wikipedia (opensearch)
   * - Open Library
   * - Semantic Scholar (paper search)
   * - PeerTube (SepiaSearch global index)
   * - Internet Archive (movies/audio items)
   *
   * All lookups use the **topic** phrase only (not role/skill), so results match the learning topic.
   */
  async getStudyResources(topic: string) {
    type Item = { title: string; url: string; source: string };
    const q = String(topic || "").trim().replace(/\s+/g, " ");
    if (!q) return { query: "", wikipedia: [] as Item[], books: [] as Item[], papers: [] as Item[], videos: [] as Item[] };

    const UA = "JobBlueprintStudyBot/1.0 (educational; https://github.com/)";

    const fetchJson = async (url: string) => {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    };

    const [wikipedia, books, papers, peertubeRows, archiveRows] = await Promise.all([
      (async (): Promise<Item[]> => {
        try {
          const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=5&namespace=0&format=json`;
          const data = await fetchJson(url);
          if (!Array.isArray(data) || data.length < 4) return [];
          const titles = data[1] as string[];
          const urls = data[3] as string[];
          const out: Item[] = [];
          for (let i = 0; i < Math.min(titles.length, urls.length, 5); i++) {
            if (titles[i] && urls[i]) out.push({ title: titles[i], url: urls[i], source: "wikipedia" });
          }
          return out;
        } catch (e) {
          this.logger.warn(`getStudyResources Wikipedia: ${e}`);
          return [];
        }
      })(),
      (async (): Promise<Item[]> => {
        try {
          const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=6&fields=title,key,author_name,first_publish_year`;
          const data = await fetchJson(url);
          const docs = data?.docs || [];
          const out: Item[] = [];
          for (const d of docs) {
            if (!d?.key || !d?.title) continue;
            const authors = Array.isArray(d.author_name) ? d.author_name.slice(0, 2).join(", ") : "";
            const base = authors ? `${d.title} — ${authors}` : String(d.title);
            const label = d.first_publish_year ? `${base} (${d.first_publish_year})` : base;
            out.push({ title: label, url: `https://openlibrary.org${d.key}`, source: "openlibrary" });
            if (out.length >= 4) break;
          }
          return out;
        } catch (e) {
          this.logger.warn(`getStudyResources Open Library: ${e}`);
          return [];
        }
      })(),
      (async (): Promise<Item[]> => {
        try {
          const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=5&fields=title,url`;
          const data = await fetchJson(url);
          const docs = data?.data || [];
          const out: Item[] = [];
          for (const d of docs) {
            if (d?.url && d?.title) out.push({ title: d.title as string, url: d.url as string, source: "semanticscholar" });
          }
          return out;
        } catch (e) {
          this.logger.warn(`getStudyResources Semantic Scholar: ${e}`);
          return [];
        }
      })(),
      (async (): Promise<Item[]> => {
        try {
          const url = `https://sepiasearch.org/api/v1/search/videos?search=${encodeURIComponent(q)}&count=6`;
          const data = await fetchJson(url);
          const rows = Array.isArray(data?.data) ? data.data : [];
          const out: Item[] = [];
          for (const v of rows) {
            if (v?.url && v?.name) out.push({ title: String(v.name), url: String(v.url), source: "peertube" });
          }
          return out;
        } catch (e) {
          this.logger.warn(`getStudyResources PeerTube/SepiaSearch: ${e}`);
          return [];
        }
      })(),
      (async (): Promise<Item[]> => {
        try {
          const iaq = `${q} AND mediatype:movies`;
          const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(iaq)}&fl[]=identifier&fl[]=title&output=json&rows=5`;
          const data = await fetchJson(url);
          const docs = data?.response?.docs || [];
          const out: Item[] = [];
          for (const d of docs) {
            if (d?.identifier && d?.title) {
              out.push({
                title: String(d.title),
                url: `https://archive.org/details/${encodeURIComponent(d.identifier)}`,
                source: "archive",
              });
            }
          }
          return out;
        } catch (e) {
          this.logger.warn(`getStudyResources Internet Archive: ${e}`);
          return [];
        }
      })(),
    ]);

    const videos: Item[] = [...peertubeRows, ...archiveRows].slice(0, 10);

    return { query: q, wikipedia, books, papers, videos };
  }

  /**
   * RapidAPI Jsearch "Trending jobs" style insights for this role.
   * We run a search using `roleName + contextual tags` and compute:
   * - Most frequent job titles
   * - Most frequent companies
   * - Most frequent skills (if returned by Jsearch)
   */
  async getTrendingJobsInsights(
    roleName: string,
    industry?: string,
    education?: string,
    specialization?: string
  ) {
    const apiKey = process.env.RAPIDAPI_KEY || process.env.VITE_RAPIDAPI_KEY || "";
    const host = this.jsearchHost;

    const baseQueryParts = [roleName, industry, specialization]
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    const baseQuery = baseQueryParts.join(" ") || String(roleName || "").trim() || "jobs";

    // "Related roles" are derived from blueprint mappings so we fetch jobs for:
    // - exact role name
    // - roles from same industry / specialization / education (if provided)
    const relatedRolesSet = new Set<string>();
    const addRelated = (arr: any) => {
      if (!Array.isArray(arr)) return;
      for (const r of arr) {
        const v = String(r || "").trim();
        if (v && v.toLowerCase() !== String(roleName || "").trim().toLowerCase()) relatedRolesSet.add(v);
      }
    };

    try {
      if (industry) {
        const ind = await this.blueprintModel.findOne({ type: "industry", name: industry }).lean();
        addRelated((ind as any)?.roles);
      }
      if (education) {
        const ed = await this.blueprintModel.findOne({ type: "education", name: education }).lean();
        addRelated((ed as any)?.roles);
      }
      if (specialization) {
        const sp = await this.blueprintModel.findOne({ type: "specialization", name: specialization }).lean();
        addRelated((sp as any)?.roles);
      }
    } catch (e) {
      this.logger.warn(`getTrendingJobsInsights: related role lookup failed: ${e}`);
    }

    const relatedRoles = Array.from(relatedRolesSet).slice(0, 4);
    const queries = [baseQuery, ...relatedRoles.map((r) => [r, industry, specialization].filter(Boolean).join(" "))].filter(Boolean);
    const query = baseQuery;

    if (!apiKey) {
      return {
        available: false,
        message: "Trending insights unavailable: RAPIDAPI_KEY not set on the backend.",
        query,
        topJobTitles: [],
        topCompanies: [],
        topSkills: [],
        sampleJobs: [],
      };
    }

    const cacheKey = `jsearch|${queries.join("||")}`.toLowerCase();
    const cached = this.jsearchCache.get(cacheKey);
    if (cached && Date.now() - cached.at < this.jsearchTtlMs) return cached.data;

    const toTopList = (m: Map<string, number>, limit: number) =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([k, n]) => ({ name: k, count: n }));

    const inc = (m: Map<string, number>, k?: string) => {
      const key = String(k || "").trim();
      if (!key) return;
      m.set(key, (m.get(key) || 0) + 1);
    };

    try {
      const searchOne = async (q: string) => {
        const url = new URL(`https://${host}/search`);
        url.searchParams.set("query", q);
        url.searchParams.set("page", "1");
        url.searchParams.set("num_pages", "1");
        url.searchParams.set("country", "us");
        url.searchParams.set("date_posted", "month");

        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 9000);
        try {
          const r = await fetch(url.toString(), {
            method: "GET",
            signal: controller.signal,
            headers: {
              "x-rapidapi-key": apiKey,
              "x-rapidapi-host": host,
            },
          });
          if (!r.ok) {
            const body = await r.text().catch(() => "");
            this.logger.warn(`Jsearch searchOne failed for query "${q}": HTTP ${r.status} - ${body}`);
            if (r.status === 429) return { ok: false, status: 429, jobs: [], body };
            return { ok: false, status: r.status, jobs: [], body };
          }
          const payload: any = await r.json().catch(() => ({}));
          const jobsRaw = payload?.data?.data ?? payload?.data ?? [];
          const jobs = Array.isArray(jobsRaw) ? jobsRaw : [];
          return { ok: true, status: 200, jobs, body: "" };
        } finally {
          clearTimeout(t);
        }
      };

      const results = await Promise.all(queries.map((q) => searchOne(q)));
      const any429 = results.some((x) => x.status === 429);
      if (any429) {
        return {
          available: false,
          message: "Trending insights rate-limited (429). Try again in a bit.",
          query,
          queriesUsed: queries,
          topJobTitles: [],
          topCompanies: [],
          topSkills: [],
          jobs: [],
        };
      }

      const jobsAll = results.flatMap((r) => r.jobs || []);
      const seen = new Set<string>();
      const jobs = jobsAll.filter((j: any) => {
        const id = String(j?.job_id || j?.id || "").trim();
        if (!id) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      const titleCounts = new Map<string, number>();
      const companyCounts = new Map<string, number>();
      const skillCounts = new Map<string, number>();

      for (const job of jobs) {
        inc(titleCounts, job?.job_title ?? job?.title);
        inc(companyCounts, job?.employer_name ?? job?.company);

        const skills =
          (Array.isArray(job?.skills) ? job.skills : null) ||
          (Array.isArray(job?.job_skills) ? job.job_skills : null) ||
          null;

        if (skills && Array.isArray(skills)) {
          for (const s of skills) inc(skillCounts, typeof s === "string" ? s : (s?.name ?? s?.skillName));
        }
      }

      const jobsOut =
        jobs.slice(0, 12).map((j: any) => {
          const title = String(j?.job_title ?? j?.title ?? "").trim();
          const company = String(j?.employer_name ?? j?.company ?? "").trim();
          const city = String(j?.job_city ?? j?.city ?? "").trim();
          const country = String(j?.job_country ?? j?.country ?? "").trim();
          const applyLink = String(j?.job_apply_link ?? j?.apply_link ?? j?.job_apply_url ?? "").trim();
          const postedAt = String(j?.job_posted_at_datetime_utc ?? j?.job_posted_at_datetime ?? j?.posted_at ?? "").trim();
          return {
            job_id: j?.job_id ?? j?.id ?? "",
            title,
            company,
            location: [city, country].filter(Boolean).join(", "),
            applyLink,
            postedAt,
          };
        }) || [];

      const data = {
        available: jobs.length > 0,
        message: jobs.length > 0 ? "" : "No relevant jobs found via Jsearch for this role/context.",
        query,
        queriesUsed: queries,
        topJobTitles: toTopList(titleCounts, 6),
        topCompanies: toTopList(companyCounts, 6),
        topSkills: toTopList(skillCounts, 8),
        jobs: jobsOut,
      };

      this.jsearchCache.set(cacheKey, { at: Date.now(), data });
      return data;
    } catch (e: any) {
      this.logger.warn(`getTrendingJobsInsights: ${e?.message || e}`);
      return {
        available: false,
        message: "Trending insights unavailable right now.",
        query,
        topJobTitles: [],
        topCompanies: [],
        topSkills: [],
        sampleJobs: [],
      };
    }
  }

  async seedDemoData() {
    const count = await this.blueprintModel.countDocuments();
    if (count > 0) return { inserted: 0, message: "already seeded" };
    await this.blueprintModel.insertMany([
      { type: "industry", name: "Technology & Digital Services", roles: ["Software Development Engineer", "Data Scientist"], educations: ["B.Tech", "MCA"] },
      { type: "education", name: "B.Tech", roles: ["Software Development Engineer"], specializations: ["Computer Science", "AI"] },
      { type: "specialization", name: "Computer Science", roles: ["Software Development Engineer"] },
      {
        type: "role",
        name: "Software Development Engineer",
        description: "Build scalable backend and frontend systems.",
        skillRequirements: [
          { skillName: "Data Structures", skillType: "technical", timeRequiredMonths: 2, difficulty: "beginner", importance: "Essential", prerequisites: [], isOptional: false },
          { skillName: "JavaScript", skillType: "technical", timeRequiredMonths: 2, difficulty: "beginner", importance: "Essential", prerequisites: [], isOptional: false },
          { skillName: "System Design", skillType: "technical", timeRequiredMonths: 3, difficulty: "advanced", importance: "Important", prerequisites: ["Data Structures"], isOptional: false }
        ]
      }
    ]);
    return { inserted: 4 };
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

