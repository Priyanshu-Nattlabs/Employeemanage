import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import {
  CompanyUser,
  type CompanyUserDocument,
  type OrgAccountType,
  type OrgCurrentRole,
  RolePreparation,
  type RolePreparationDocument,
  SkillTest,
  type SkillTestDocument,
} from "../shared/schemas";

const JWT_SECRET = process.env.ORG_AUTH_JWT_SECRET || process.env.JWT_SECRET || "dev-only-change-me";
const JWT_EXPIRES_IN = process.env.ORG_AUTH_JWT_EXPIRES_IN || "7d";

function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

function emailDomain(email: string): string {
  const at = normalizeEmail(email).split("@");
  return at.length === 2 ? at[1] : "";
}

function normalizeDomain(domain: string): string {
  return (domain || "").trim().toLowerCase().replace(/^@/, "");
}

@Injectable()
export class OrgAuthService {
  constructor(
    @InjectModel(CompanyUser.name) private readonly companyUserModel: Model<CompanyUserDocument>,
    @InjectModel(RolePreparation.name) private readonly prepModel: Model<RolePreparationDocument>,
    @InjectModel(SkillTest.name) private readonly testModel: Model<SkillTestDocument>,
  ) {}

  private signToken(user: CompanyUserDocument) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      companyName: user.companyName,
      companyDomain: user.companyDomain,
      accountType: user.accountType,
      currentRole: user.currentRole
    };
    const secret: jwt.Secret = JWT_SECRET;
    const expiresIn: jwt.SignOptions["expiresIn"] = JWT_EXPIRES_IN as any;
    return jwt.sign(payload, secret, { expiresIn });
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  async registerEmployee(input: {
    email: string;
    password: string;
    fullName: string;
    designation: string;
    companyName: string;
    companyDomain?: string;
    employeeId: string;
    currentRole: OrgCurrentRole;
    mobileNo: string;
    reportingManagerEmail: string;
  }) {
    const email = normalizeEmail(input.email);
    const domainFromEmail = emailDomain(email);
    if (!domainFromEmail) throw new BadRequestException("Email must be a valid company email");

    const companyDomain = normalizeDomain(input.companyDomain || domainFromEmail);
    if (domainFromEmail !== companyDomain) {
      throw new BadRequestException(`Email must use the company domain: ${companyDomain}`);
    }

    const mgrEmail = normalizeEmail(input.reportingManagerEmail);
    if (emailDomain(mgrEmail) !== companyDomain) {
      throw new BadRequestException("Reporting manager email must be in the same company domain");
    }

    const existing = await this.companyUserModel.findOne({ email }).lean();
    if (existing) throw new BadRequestException("An account with this email already exists");

    const passwordHash = await bcrypt.hash(input.password, 12);
    const created = await this.companyUserModel.create({
      email,
      passwordHash,
      fullName: input.fullName?.trim(),
      designation: input.designation?.trim(),
      companyName: input.companyName?.trim(),
      companyDomain,
      employeeId: input.employeeId?.trim(),
      currentRole: input.currentRole,
      accountType: "EMPLOYEE" as OrgAccountType,
      mobileNo: input.mobileNo?.trim(),
      reportingManagerEmail: mgrEmail
    });

    const token = this.signToken(created);
    return {
      token,
      user: {
        id: created._id.toString(),
        email: created.email,
        fullName: created.fullName,
        designation: created.designation,
        companyName: created.companyName,
        companyDomain: created.companyDomain,
        employeeId: created.employeeId,
        currentRole: created.currentRole,
        accountType: created.accountType,
        mobileNo: created.mobileNo,
        reportingManagerEmail: created.reportingManagerEmail
      }
    };
  }

  async registerAdmin(input: { email: string; password: string; fullName: string; companyName: string; companyDomain?: string }) {
    const email = normalizeEmail(input.email);
    const domainFromEmail = emailDomain(email);
    if (!domainFromEmail) throw new BadRequestException("Email must be a valid company email");

    const companyDomain = normalizeDomain(input.companyDomain || domainFromEmail);
    if (domainFromEmail !== companyDomain) {
      throw new BadRequestException(`Email must use the company domain: ${companyDomain}`);
    }

    const existing = await this.companyUserModel.findOne({ email }).lean();
    if (existing) throw new BadRequestException("An account with this email already exists");

    const passwordHash = await bcrypt.hash(input.password, 12);
    const created = await this.companyUserModel.create({
      email,
      passwordHash,
      fullName: input.fullName?.trim(),
      companyName: input.companyName?.trim(),
      companyDomain,
      currentRole: "EMPLOYEE",
      accountType: "ADMIN" as OrgAccountType
    });

    const token = this.signToken(created);
    return {
      token,
      user: {
        id: created._id.toString(),
        email: created.email,
        fullName: created.fullName,
        companyName: created.companyName,
        companyDomain: created.companyDomain,
        currentRole: created.currentRole,
        accountType: created.accountType
      }
    };
  }

  async login(emailRaw: string, password: string) {
    const email = normalizeEmail(emailRaw);
    const user = await this.companyUserModel.findOne({ email });
    if (!user) throw new UnauthorizedException("Invalid email or password");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid email or password");
    const token = this.signToken(user);
    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        designation: user.designation,
        companyName: user.companyName,
        companyDomain: user.companyDomain,
        employeeId: user.employeeId,
        currentRole: user.currentRole,
        accountType: user.accountType,
        mobileNo: user.mobileNo,
        reportingManagerEmail: user.reportingManagerEmail
      }
    };
  }

  async getEmployeesForManager(companyDomain: string) {
    const domain = normalizeDomain(companyDomain);
    return this.companyUserModel
      .find({ companyDomain: domain, accountType: "EMPLOYEE" })
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .lean();
  }

  async getEmployeesForAdmin(companyDomain: string, companyName: string) {
    const domain = normalizeDomain(companyDomain);
    const name = (companyName || "").trim();
    return this.companyUserModel
      .find({ companyDomain: domain, companyName: name, accountType: "EMPLOYEE" })
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .lean();
  }

  async getProfileById(id: string) {
    if (!id) throw new UnauthorizedException("Invalid token");
    const user = await this.companyUserModel.findById(id).select("-passwordHash").lean();
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async updateProfileById(id: string, patch: any) {
    if (!id) throw new UnauthorizedException("Invalid token");

    // Only allow editable fields. Email/company identity stays locked.
    const allowed: any = {};
    const setIf = (k: string) => {
      if (typeof patch?.[k] === "string") allowed[k] = patch[k].trim();
    };

    setIf("fullName");
    setIf("designation");
    setIf("employeeId");
    setIf("mobileNo");
    setIf("reportingManagerEmail");

    if (patch?.currentRole === "EMPLOYEE" || patch?.currentRole === "MANAGER") {
      allowed.currentRole = patch.currentRole;
    }

    const updated = await this.companyUserModel
      .findByIdAndUpdate(id, { $set: allowed }, { new: true })
      .select("-passwordHash")
      .lean();

    if (!updated) throw new NotFoundException("User not found");
    return updated;
  }

  private prepPct(prep: any): number {
    const sp = prep?.skillProgress || {};
    const total = Object.keys(sp).length;
    const done = Object.values(sp).filter((v: any) => v?.completed).length;
    return total ? Math.round((done / total) * 100) : 0;
  }

  async getEmployeesPrepSummaryForAdmin(companyDomain: string, companyName: string) {
    const employees = await this.getEmployeesForAdmin(companyDomain, companyName);
    const ids = employees.map((e: any) => String(e._id || e.id || "")).filter(Boolean);
    if (!ids.length) return [];

    const preps = await this.prepModel.find({ studentId: { $in: ids }, isActive: true }).lean();
    const byStudent = new Map<string, any[]>();
    for (const p of preps) {
      const sid = String((p as any).studentId || "");
      const arr = byStudent.get(sid) ?? [];
      arr.push({ roleName: (p as any).roleName, pct: this.prepPct(p), startedAt: (p as any).preparationStartDate || null });
      byStudent.set(sid, arr);
    }

    // latest test per employee (any role/skill)
    const tests = await this.testModel
      .find({ studentId: { $in: ids }, status: { $in: ["COMPLETED", "FAILED"] } })
      .sort({ createdAt: -1 })
      .lean();
    const latestTestByStudent = new Map<string, any>();
    for (const t of tests) {
      const sid = String((t as any).studentId || "");
      if (!latestTestByStudent.has(sid)) {
        latestTestByStudent.set(sid, {
          roleName: (t as any).roleName,
          skillName: (t as any).skillName,
          score: (t as any).score ?? null,
          passed: (t as any).passed === true,
          completedAt: (t as any).completedAt ?? null,
        });
      }
    }

    return employees.map((e: any) => {
      const id = String(e._id || e.id || "");
      const ongoing = byStudent.get(id) ?? [];
      const avgPct = ongoing.length ? Math.round(ongoing.reduce((s, x) => s + (x.pct || 0), 0) / ongoing.length) : 0;
      return { employee: e, ongoing, avgPct, latestTest: latestTestByStudent.get(id) ?? null };
    });
  }

  async getEmployeesPrepSummaryForManager(companyDomain: string) {
    const employees = await this.getEmployeesForManager(companyDomain);
    const ids = employees.map((e: any) => String(e._id || e.id || "")).filter(Boolean);
    if (!ids.length) return [];

    const preps = await this.prepModel.find({ studentId: { $in: ids }, isActive: true }).lean();
    const byStudent = new Map<string, any[]>();
    for (const p of preps) {
      const sid = String((p as any).studentId || "");
      const arr = byStudent.get(sid) ?? [];
      arr.push({ roleName: (p as any).roleName, pct: this.prepPct(p), startedAt: (p as any).preparationStartDate || null });
      byStudent.set(sid, arr);
    }

    const tests = await this.testModel
      .find({ studentId: { $in: ids }, status: { $in: ["COMPLETED", "FAILED"] } })
      .sort({ createdAt: -1 })
      .lean();
    const latestTestByStudent = new Map<string, any>();
    for (const t of tests) {
      const sid = String((t as any).studentId || "");
      if (!latestTestByStudent.has(sid)) {
        latestTestByStudent.set(sid, {
          roleName: (t as any).roleName,
          skillName: (t as any).skillName,
          score: (t as any).score ?? null,
          passed: (t as any).passed === true,
          completedAt: (t as any).completedAt ?? null,
        });
      }
    }

    return employees.map((e: any) => {
      const id = String(e._id || e.id || "");
      const ongoing = byStudent.get(id) ?? [];
      const avgPct = ongoing.length ? Math.round(ongoing.reduce((s, x) => s + (x.pct || 0), 0) / ongoing.length) : 0;
      return { employee: e, ongoing, avgPct, latestTest: latestTestByStudent.get(id) ?? null };
    });
  }
}

