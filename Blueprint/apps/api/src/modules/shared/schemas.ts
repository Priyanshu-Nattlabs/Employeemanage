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
  @Prop({ type: [String], default: [] }) knownSkillsForTest!: string[];
  @Prop({ type: [String], default: [] }) passedKnownSkills!: string[];
  @Prop({ type: [String], default: [] }) failedKnownSkills!: string[];
  @Prop({ type: [Object], default: [] }) earnedBadges!: Array<Record<string, unknown>>;
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

export type OrgAccountType = "EMPLOYEE" | "ADMIN";
export type OrgCurrentRole = "EMPLOYEE" | "MANAGER" | "HR";

@Schema({ collection: "company_users", timestamps: true })
export class CompanyUser {
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) email!: string;
  @Prop({ required: true }) passwordHash!: string;

  @Prop({ required: true }) fullName!: string;
  @Prop() designation?: string;
  @Prop() department?: string;

  @Prop({ required: true }) companyName!: string;
  @Prop({ required: true, lowercase: true, trim: true }) companyDomain!: string; // e.g. nattlabs.com

  @Prop() employeeId?: string;
  @Prop({ default: "EMPLOYEE" }) currentRole!: OrgCurrentRole;
  @Prop({ default: "EMPLOYEE" }) accountType!: OrgAccountType;

  @Prop() mobileNo?: string;
  @Prop({ lowercase: true, trim: true }) reportingManagerEmail?: string;

  @Prop({ default: false }) emailVerified!: boolean;
  @Prop() emailOtpHash?: string;
  @Prop() emailOtpExpiresAt?: Date;
  @Prop() emailOtpLastSentAt?: Date;
}

/**
 * Per-company organization structure: departments and the roles that belong to each.
 * Stored once per `companyDomain` and consumed by the role-recommendation flow so
 * managers see only roles relevant to an employee's department.
 */
@Schema({ _id: false })
export class OrgDepartmentSection {
  @Prop({ required: true }) name!: string;
  @Prop({ type: [String], default: [] }) roles!: string[];
  @Prop() description?: string;
}

@Schema({ collection: "company_org_structures", timestamps: true })
export class CompanyOrgStructure {
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) companyDomain!: string;
  @Prop() companyName?: string;
  @Prop() setupByEmail?: string;
  @Prop() setupByName?: string;
  @Prop({ type: [Object], default: [] }) departments!: OrgDepartmentSection[];
}

/**
 * A role suggestion from a manager/HR to a specific employee. Doubles as the
 * employee-side notification source.
 */
export type RoleRecommendationStatus = "PENDING" | "SEEN" | "DISMISSED" | "ACCEPTED";

@Schema({ collection: "role_recommendations", timestamps: true })
export class RoleRecommendation {
  @Prop({ required: true, lowercase: true, trim: true }) companyDomain!: string;

  @Prop({ required: true }) recommendedById!: string;
  @Prop({ required: true, lowercase: true, trim: true }) recommendedByEmail!: string;
  @Prop() recommendedByName?: string;
  @Prop() recommendedByRole?: OrgCurrentRole;

  @Prop({ required: true }) recommendedToId!: string;
  @Prop({ required: true, lowercase: true, trim: true }) recommendedToEmail!: string;
  @Prop() recommendedToName?: string;
  @Prop() recommendedToDepartment?: string;

  @Prop({ required: true }) roleName!: string;
  @Prop() note?: string;

  @Prop({ default: "PENDING" }) status!: RoleRecommendationStatus;
  @Prop() seenAt?: Date;
  @Prop() respondedAt?: Date;
}

export type BlueprintDocument = HydratedDocument<Blueprint>;
export type RolePreparationDocument = HydratedDocument<RolePreparation>;
export type SkillTestDocument = HydratedDocument<SkillTest>;
export type UserProfileDocument = HydratedDocument<UserProfile>;
export type CompanyUserDocument = HydratedDocument<CompanyUser>;
export type CompanyOrgStructureDocument = HydratedDocument<CompanyOrgStructure>;
export type RoleRecommendationDocument = HydratedDocument<RoleRecommendation>;

export const BlueprintSchema = SchemaFactory.createForClass(Blueprint);
export const RolePreparationSchema = SchemaFactory.createForClass(RolePreparation);
export const SkillTestSchema = SchemaFactory.createForClass(SkillTest);
export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
export const CompanyUserSchema = SchemaFactory.createForClass(CompanyUser);
export const CompanyOrgStructureSchema = SchemaFactory.createForClass(CompanyOrgStructure);
export const RoleRecommendationSchema = SchemaFactory.createForClass(RoleRecommendation);

