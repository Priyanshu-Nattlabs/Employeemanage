import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({ _id: false })
export class SkillRequirement {
  @Prop() skillName!: string;
  @Prop() skillType?: string;
  @Prop({ default: 1 }) timeRequiredMonths!: number;
  @Prop() difficulty?: string;
  @Prop() importance?: string;
  @Prop() description?: string;
  @Prop({ type: [String], default: [] }) prerequisites!: string[];
  @Prop({ default: false }) isOptional!: boolean;
}

@Schema({ collection: "blueprints", timestamps: true })
export class Blueprint {
  @Prop() type!: string;
  @Prop() name!: string;
  @Prop({ type: [String], default: [] }) roles!: string[];
  @Prop({ type: [String], default: [] }) specializations!: string[];
  @Prop({ type: [String], default: [] }) educations!: string[];
  @Prop({ type: [String], default: [] }) industries!: string[];
  @Prop({ type: Object }) jobDescription?: Record<string, unknown>;
  @Prop({ type: Object }) skills?: Record<string, unknown>;
  @Prop({ type: Object }) plan?: Record<string, unknown>;
  @Prop({ type: [Object], default: [] }) skillRequirements!: SkillRequirement[];
  @Prop() description?: string;
}

@Schema({ _id: false })
export class SkillProgress {
  @Prop({ default: false }) completed!: boolean;
  @Prop() completedDate?: string;
  @Prop() targetDate?: string;
  @Prop() score?: number;
  @Prop({ type: Object, default: {} }) subtopicCompletion!: Record<string, boolean>;
}

@Schema({ collection: "role_preparations", timestamps: true })
export class RolePreparation {
  @Prop() studentId!: string;
  @Prop() roleName!: string;
  @Prop() preparationStartDate?: string;
  @Prop() targetCompletionDate?: string;
  @Prop({ default: true }) isActive!: boolean;
  @Prop({ type: Object, default: {} }) skillProgress!: Record<string, SkillProgress>;
  @Prop({ type: Object }) ganttChartData?: Record<string, unknown>;
}

@Schema({ _id: false })
export class SkillQuestion {
  @Prop() questionText!: string;
  @Prop({ type: [String], default: [] }) options!: string[];
  @Prop() correctAnswer!: string;
  @Prop() questionNumber!: number;
}

@Schema({ collection: "skill_tests", timestamps: true })
export class SkillTest {
  @Prop() studentId!: string;
  @Prop() roleName!: string;
  @Prop() skillName!: string;
  @Prop({ type: [Object], default: [] }) questions!: SkillQuestion[];
  @Prop({ type: Object, default: {} }) answers!: Record<string, string>;
  @Prop() score?: number;
  @Prop() passed?: boolean;
  @Prop() startedAt?: string;
  @Prop() completedAt?: string;
  @Prop({ default: "IN_PROGRESS" }) status!: string;
}

@Schema({ collection: "user_profiles", timestamps: true })
export class UserProfile {
  @Prop({ required: true, unique: true }) userId!: string;
  @Prop() fullName?: string;
  @Prop() email?: string;
  @Prop() education?: string;
  @Prop() expectedGraduationYear?: string;
  @Prop() expectedGraduationMonth?: string;
  /** Student roll / ID from SomethingX (User.studentId) */
  @Prop() studentRollNumber?: string;
}

export type BlueprintDocument = HydratedDocument<Blueprint>;
export type RolePreparationDocument = HydratedDocument<RolePreparation>;
export type SkillTestDocument = HydratedDocument<SkillTest>;
export type UserProfileDocument = HydratedDocument<UserProfile>;

export const BlueprintSchema = SchemaFactory.createForClass(Blueprint);
export const RolePreparationSchema = SchemaFactory.createForClass(RolePreparation);
export const SkillTestSchema = SchemaFactory.createForClass(SkillTest);
export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);

