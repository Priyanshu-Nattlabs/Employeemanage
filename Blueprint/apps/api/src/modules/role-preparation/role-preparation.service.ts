import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Blueprint, BlueprintDocument, RolePreparation, RolePreparationDocument, SkillTest, SkillTestDocument } from "../shared/schemas";

@Injectable()
export class RolePreparationService {
  constructor(
    @InjectModel(RolePreparation.name) private readonly prepModel: Model<RolePreparationDocument>,
    @InjectModel(Blueprint.name) private readonly blueprintModel: Model<BlueprintDocument>,
    @InjectModel(SkillTest.name) private readonly skillTestModel: Model<SkillTestDocument>
  ) {}

  async start(studentId: string, roleName: string, ganttChartData?: Record<string, unknown>) {
    let prep = await this.prepModel.findOne({ studentId, roleName });

    // Build skillProgress from tasks in the saved chart (not just the DB role doc),
    // so progress tracks exactly the skills on the locked chart.
    const chartTasks: any[] = (ganttChartData?.plan as any)?.tasks || [];
    const chartSkillNames: string[] = chartTasks.map((t: any) => t.name).filter(Boolean);

    if (!prep) {
      const skillProgress: Record<string, any> = {};
      const previous = await this.prepModel.find({ studentId }).lean();
      const completedSkills = new Set<string>();
      for (const p of previous) {
        if (p.skillProgress) {
          for (const [k, v] of Object.entries(p.skillProgress)) {
            if ((v as any)?.completed) completedSkills.add(k);
          }
        }
      }
      // Use chart tasks as source of truth for skill list
      const skillNames = chartSkillNames.length
        ? chartSkillNames
        : ((await this.blueprintModel.findOne({ type: "role", name: roleName }).lean())?.skillRequirements || []).map((s: any) => s.skillName);
      for (const name of skillNames) {
        skillProgress[name] = { completed: completedSkills.has(name), subtopicCompletion: {} };
      }
      prep = await this.prepModel.create({
        studentId,
        roleName,
        preparationStartDate: new Date().toISOString().slice(0, 10),
        isActive: true,
        skillProgress,
        ganttChartData,
      });
    } else {
      prep.isActive = true;
      if (ganttChartData) {
        prep.ganttChartData = ganttChartData;
        // Sync skillProgress to match the newly saved chart tasks
        const existing = prep.skillProgress || {};
        const updated: Record<string, any> = {};
        const skillNames = chartSkillNames.length ? chartSkillNames : Object.keys(existing);
        for (const name of skillNames) {
          updated[name] = existing[name] || { completed: false, subtopicCompletion: {} };
        }
        prep.skillProgress = updated;
      }
      await prep.save();
    }
    return prep;
  }

  async getOngoing(studentId: string) {
    const preps = await this.prepModel.find({ studentId, isActive: true }).lean();
    return preps.map((p) => {
      const skillProgress = p.skillProgress || {};
      const total     = Object.keys(skillProgress).length;
      const completed = Object.values(skillProgress).filter((v: any) => v?.completed).length;
      return {
        roleName:             p.roleName,
        preparationStartDate: p.preparationStartDate,
        totalSkills:          total,
        completedSkills:      completed,
        pct:                  total ? Math.round((completed / total) * 100) : 0,
        hasChart:             !!(p.ganttChartData as any)?.plan,
      };
    });
  }

  get(studentId: string, roleName: string) { return this.prepModel.findOne({ studentId, roleName }).lean(); }
  getAll(studentId: string) { return this.prepModel.find({ studentId }).lean(); }

  async updateSkill(studentId: string, roleName: string, skillName: string, completed: boolean) {
    if (completed) throw new Error("Skill completion requires passing the test");
    const preps = await this.prepModel.find({ studentId });
    if (!preps.length) throw new NotFoundException("Preparation not found");
    for (const prep of preps) {
      prep.skillProgress = prep.skillProgress || {};
      prep.skillProgress[skillName] = {
        ...(prep.skillProgress[skillName] || {}),
        completed: false,
        score: undefined,
        completedDate: undefined,
        subtopicCompletion: {},
      };
      prep.markModified("skillProgress");
      await prep.save();
    }
    await this.skillTestModel.deleteMany({ studentId, skillName });
    const prep = await this.prepModel.findOne({ studentId, roleName });
    return prep;
  }

  async markCompletedAfterTest(studentId: string, roleName: string, skillName: string, score: number) {
    if (score < 75) throw new Error("Score must be >= 75");
    let prep = await this.prepModel.findOne({ studentId, roleName });
    // Ensure completion always gets reflected even if a prep record is missing.
    if (!prep) prep = await this.start(studentId, roleName);
    prep.skillProgress = prep.skillProgress || {};
    prep.skillProgress[skillName] = { ...(prep.skillProgress[skillName] || {}), completed: true, score, completedDate: new Date().toISOString().slice(0, 10) };
    prep.isActive = true;
    prep.markModified("skillProgress");
    await prep.save();
    return prep;
  }

  async toggleSubtopic(studentId: string, roleName: string, skillName: string, month: number, topicIndex: number, completed: boolean) {
    const prep = await this.prepModel.findOne({ studentId, roleName });
    if (!prep) throw new NotFoundException("Preparation not found");
    prep.skillProgress = prep.skillProgress || {};
    const old = prep.skillProgress[skillName] || { completed: false, subtopicCompletion: {} };
    old.subtopicCompletion = old.subtopicCompletion || {};
    old.subtopicCompletion[`month_${month}_topic_${topicIndex}`] = completed;
    prep.skillProgress[skillName] = old;
    prep.markModified("skillProgress");
    await prep.save();
    return prep;
  }

  async analytics(studentId: string, roleName: string) {
    const prep = await this.prepModel.findOne({ studentId, roleName }).lean();
    const roleDoc = await this.blueprintModel.findOne({ type: "role", name: roleName }).lean();

    const prepSkillKeys = prep?.skillProgress ? Object.keys(prep.skillProgress) : [];
    const roleSkills = (roleDoc as any)?.skillRequirements || [];
    const totalSkills = prepSkillKeys.length || roleSkills.length || 0;
    const completedSkills = prep?.skillProgress ? Object.values(prep.skillProgress).filter((v: any) => v?.completed).length : 0;
    const learningByMonth: Record<string, number> = {};
    const skillScores: Record<string, number> = {};
    if (prep?.skillProgress) {
      for (const [skill, val] of Object.entries(prep.skillProgress)) {
        const v = val as any;
        if (v?.completedDate) {
          const key = String(v.completedDate).slice(0, 7);
          learningByMonth[key] = (learningByMonth[key] || 0) + 1;
        }
        if (typeof v?.score === "number") skillScores[skill] = v.score;
      }
    }

    // Include latest test score per skill (covers FAILED attempts too).
    const tests = await this.skillTestModel
      .find({ studentId, roleName, score: { $type: "number" } })
      .sort({ createdAt: -1 })
      .lean();
    for (const t of tests) {
      if (t?.skillName && typeof t?.score === "number" && skillScores[t.skillName] === undefined) {
        skillScores[t.skillName] = t.score;
      }
    }
    return {
      roleName,
      preparationStartDate: prep?.preparationStartDate,
      targetCompletionDate: prep?.targetCompletionDate,
      totalSkills,
      completedSkills,
      remainingSkills: Math.max(0, totalSkills - completedSkills),
      completionPercentage: totalSkills ? Math.round((completedSkills * 10000) / totalSkills) / 100 : 0,
      remainingPercentage: totalSkills ? Math.round(((totalSkills - completedSkills) * 10000) / totalSkills) / 100 : 0,
      learningByMonth,
      skillScores,
      skillsByType: {},
      skillsWithWarnings: []
    };
  }

  async remove(studentId: string, roleName: string) {
    await this.prepModel.deleteOne({ studentId, roleName });
    return { deleted: true };
  }
}

