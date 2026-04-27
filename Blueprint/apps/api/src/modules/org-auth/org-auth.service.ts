import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
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
const OTP_SECRET = process.env.ORG_EMAIL_OTP_SECRET || process.env.OTP_SECRET || "dev-only-change-me";
const OTP_TTL_MINUTES = Number(process.env.ORG_EMAIL_OTP_TTL_MINUTES || "10");
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.ORG_EMAIL_OTP_RESEND_COOLDOWN_SECONDS || "30");
const OTP_DEBUG = String(process.env.ORG_EMAIL_OTP_DEBUG || "").trim() === "true";

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

  private otpHash(email: string, otp: string): string {
    const h = crypto.createHash("sha256");
    h.update(`${normalizeEmail(email)}:${otp}:${OTP_SECRET}`);
    return h.digest("hex");
  }

  private generateOtp(): string {
    // 6-digit numeric code (000000-999999)
    const n = crypto.randomInt(0, 1_000_000);
    return String(n).padStart(6, "0");
  }

  private async sendOtpEmail(email: string, otp: string): Promise<null | { messageId?: string; accepted?: any; rejected?: any; response?: string }> {
    const host = (process.env.SMTP_HOST || "").trim();
    const port = Number(process.env.SMTP_PORT || "0");
    const user = (process.env.SMTP_USER || "").trim();
    const pass = (process.env.SMTP_PASS || "").trim();
    const from = (process.env.SMTP_FROM || user || "no-reply@example.com").trim();

    // eslint-disable-next-line no-console
    console.log("[ORG AUTH] SMTP config", {
      host,
      port,
      user: user ? `${user.slice(0, 2)}***${user.slice(-8)}` : "",
      from,
      hasPass: Boolean(pass),
    });

    // If SMTP is not configured, don't fail the signup flow in dev; just log it.
    if (!host || !port || !user || !pass) {
      // eslint-disable-next-line no-console
      console.log(`[ORG AUTH] OTP for ${email}: ${otp} (SMTP not configured)`);
      return null;
    }

    const secure = port === 465;
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      // Gmail on 587 uses STARTTLS. This makes failures more deterministic.
      requireTLS: !secure,
    });

    const info = await transport.sendMail({
      from,
      to: normalizeEmail(email),
      subject: "Your verification code",
      text: `Your email verification code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      html: `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height:1.5">
          <h2 style="margin:0 0 10px">Verify your email</h2>
          <p style="margin:0 0 14px">Use this code to verify your email address:</p>
          <div style="font-size:28px; font-weight:800; letter-spacing:6px; margin:0 0 14px">${otp}</div>
          <p style="margin:0; color:#475569">This code expires in ${OTP_TTL_MINUTES} minutes.</p>
        </div>
      `,
    });

    // eslint-disable-next-line no-console
    console.log("[ORG AUTH] OTP email sent", {
      to: normalizeEmail(email),
      via: `${host}:${port}`,
      from,
      messageId: (info as any)?.messageId,
      accepted: (info as any)?.accepted,
      rejected: (info as any)?.rejected,
      response: (info as any)?.response,
    });

    if (!OTP_DEBUG) return null;
    return {
      messageId: (info as any)?.messageId,
      accepted: (info as any)?.accepted,
      rejected: (info as any)?.rejected,
      response: (info as any)?.response,
    };
  }

  private async setAndSendEmailOtp(user: CompanyUserDocument) {
    const otp = this.generateOtp();
    user.emailVerified = false;
    user.emailOtpHash = this.otpHash(user.email, otp);
    user.emailOtpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
    user.emailOtpLastSentAt = new Date();
    await user.save();
    return await this.sendOtpEmail(user.email, otp);
  }

  private signToken(user: CompanyUserDocument) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      companyName: user.companyName,
      companyDomain: user.companyDomain,
      accountType: user.accountType,
      currentRole: user.currentRole,
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
    department?: string;
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

    // HR doesn't need a department. Everyone else (EMPLOYEE / MANAGER) does.
    const isHR = input.currentRole === "HR";
    const department = (input.department || "").trim();
    if (!isHR && !department) {
      throw new BadRequestException("Department is required");
    }

    const existing = await this.companyUserModel.findOne({ email }).lean();
    if (existing) throw new BadRequestException("An account with this email already exists");

    const passwordHash = await bcrypt.hash(input.password, 12);
    const created = await this.companyUserModel.create({
      email,
      passwordHash,
      fullName: input.fullName?.trim(),
      designation: input.designation?.trim(),
      department: isHR ? undefined : department,
      companyName: input.companyName?.trim(),
      companyDomain,
      employeeId: input.employeeId?.trim(),
      currentRole: input.currentRole,
      accountType: "EMPLOYEE" as OrgAccountType,
      mobileNo: input.mobileNo?.trim(),
      reportingManagerEmail: mgrEmail,
      emailVerified: false,
    });

    const debugMail = await this.setAndSendEmailOtp(created);
    return OTP_DEBUG ? { verificationRequired: true, email: created.email, debugMail } : { verificationRequired: true, email: created.email };
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
      accountType: "ADMIN" as OrgAccountType,
      emailVerified: false,
    });

    const debugMail = await this.setAndSendEmailOtp(created);
    return OTP_DEBUG ? { verificationRequired: true, email: created.email, debugMail } : { verificationRequired: true, email: created.email };
  }

  async login(emailRaw: string, password: string) {
    const email = normalizeEmail(emailRaw);
    const user = await this.companyUserModel.findOne({ email });
    if (!user) throw new UnauthorizedException("Invalid email or password");
    if (!user.emailVerified) throw new UnauthorizedException("Email not verified. Please verify your email with OTP.");
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
        department: (user as any).department,
        companyName: user.companyName,
        companyDomain: user.companyDomain,
        employeeId: user.employeeId,
        currentRole: user.currentRole,
        accountType: user.accountType,
        mobileNo: user.mobileNo,
        reportingManagerEmail: user.reportingManagerEmail,
      },
    };
  }

  async resendEmailOtp(emailRaw: string) {
    const email = normalizeEmail(emailRaw);
    const user = await this.companyUserModel.findOne({ email });
    if (!user) throw new NotFoundException("User not found");
    if (user.emailVerified) return { ok: true, message: "Email already verified" };

    const last = user.emailOtpLastSentAt ? new Date(user.emailOtpLastSentAt).getTime() : 0;
    const now = Date.now();
    if (last && now - last < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      const wait = Math.ceil((OTP_RESEND_COOLDOWN_SECONDS * 1000 - (now - last)) / 1000);
      throw new BadRequestException(`Please wait ${wait}s before requesting another OTP`);
    }

    const debugMail = await this.setAndSendEmailOtp(user);
    return OTP_DEBUG ? { ok: true, debugMail } : { ok: true };
  }

  async verifyEmailOtp(emailRaw: string, otpRaw: string) {
    const email = normalizeEmail(emailRaw);
    const otp = (otpRaw || "").trim();
    const user = await this.companyUserModel.findOne({ email });
    if (!user) throw new NotFoundException("User not found");
    if (user.emailVerified) {
      const token = this.signToken(user);
      return {
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          fullName: user.fullName,
          designation: user.designation,
          department: (user as any).department,
          companyName: user.companyName,
          companyDomain: user.companyDomain,
          employeeId: user.employeeId,
          currentRole: user.currentRole,
          accountType: user.accountType,
          mobileNo: user.mobileNo,
          reportingManagerEmail: user.reportingManagerEmail,
        },
      };
    }

    const exp = user.emailOtpExpiresAt ? new Date(user.emailOtpExpiresAt).getTime() : 0;
    if (!user.emailOtpHash || !exp || Date.now() > exp) {
      throw new BadRequestException("OTP expired. Please resend OTP.");
    }

    const got = this.otpHash(email, otp);
    const a = Buffer.from(got, "hex");
    const b = Buffer.from(user.emailOtpHash, "hex");
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) throw new BadRequestException("Invalid OTP");

    user.emailVerified = true;
    user.emailOtpHash = undefined;
    user.emailOtpExpiresAt = undefined;
    await user.save();

    const token = this.signToken(user);
    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        designation: user.designation,
        department: (user as any).department,
        companyName: user.companyName,
        companyDomain: user.companyDomain,
        employeeId: user.employeeId,
        currentRole: user.currentRole,
        accountType: user.accountType,
        mobileNo: user.mobileNo,
        reportingManagerEmail: user.reportingManagerEmail,
      },
    };
  }

  async getEmployeesForManager(companyDomain: string, department?: string) {
    const domain = normalizeDomain(companyDomain);
    const filter: any = { companyDomain: domain, accountType: "EMPLOYEE" };
    const dept = (department || "").trim();
    if (dept) {
      // Match the manager's department case-insensitively, ignoring trailing spaces.
      filter.department = new RegExp(`^${dept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    }
    return this.companyUserModel
      .find(filter)
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

  async getEmployeesActivityForManager(companyDomain: string, department?: string) {
    const employees = await this.getEmployeesForManager(companyDomain, department);
    const ids = employees.map((e: any) => String(e._id || e.id || "")).filter(Boolean);
    const empById = new Map<string, any>();
    for (const e of employees as any[]) empById.set(String(e._id || e.id || ""), e);

    const empty = {
      activityFeed: [] as any[],
      dailySeries: [] as any[],
      topSkills: [] as any[],
      roleAggregates: [] as any[],
      engagement: { active7d: 0, active30d: 0, dormant: 0, total: 0 },
    };
    if (!ids.length) return empty;

    // Recent tests across the team (last 60 days for trend; activity feed uses top N anyway)
    const sinceTrend = new Date();
    sinceTrend.setDate(sinceTrend.getDate() - 60);
    const tests = await this.testModel
      .find({ studentId: { $in: ids }, status: { $in: ["COMPLETED", "FAILED"] } })
      .sort({ createdAt: -1 })
      .lean();

    const preps = await this.prepModel.find({ studentId: { $in: ids } }).lean();

    // ---- Activity feed: tests + completed skills ----
    const feed: any[] = [];
    for (const t of tests as any[]) {
      const sid = String(t.studentId || "");
      const e = empById.get(sid) || {};
      const at = t.completedAt || t.createdAt;
      feed.push({
        type: t.passed === true ? "TEST_PASSED" : "TEST_FAILED",
        at,
        employeeId: sid,
        employeeName: e.fullName || e.email || "Unknown",
        employeeEmail: e.email || "",
        employeeDepartment: e.department || null,
        roleName: t.roleName,
        skillName: t.skillName,
        score: typeof t.score === "number" ? t.score : null,
      });
    }
    for (const p of preps as any[]) {
      const sid = String(p.studentId || "");
      const e = empById.get(sid) || {};
      const sp = p.skillProgress || {};
      for (const [skillName, raw] of Object.entries(sp)) {
        const pr: any = raw;
        if (pr?.completed && pr.completedDate) {
          feed.push({
            type: "SKILL_COMPLETED",
            at: pr.completedDate,
            employeeId: sid,
            employeeName: e.fullName || e.email || "Unknown",
            employeeEmail: e.email || "",
            employeeDepartment: e.department || null,
            roleName: p.roleName,
            skillName,
            score: typeof pr.score === "number" ? pr.score : null,
          });
        }
      }
      // also surface "started prep" events
      if (p.preparationStartDate) {
        feed.push({
          type: "PREP_STARTED",
          at: p.preparationStartDate,
          employeeId: sid,
          employeeName: e.fullName || e.email || "Unknown",
          employeeEmail: e.email || "",
          employeeDepartment: e.department || null,
          roleName: p.roleName,
          skillName: null,
          score: null,
        });
      }
    }
    feed.sort((a, b) => {
      const ad = a.at ? new Date(a.at).getTime() : 0;
      const bd = b.at ? new Date(b.at).getTime() : 0;
      return bd - ad;
    });
    const activityFeed = feed.slice(0, 25);

    // ---- 14-day daily series for tests ----
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailySeries: any[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const dayTests = (tests as any[]).filter((t) => {
        const ts = t.completedAt ? new Date(t.completedAt).getTime() : (t.createdAt ? new Date(t.createdAt).getTime() : 0);
        return ts >= d.getTime() && ts < next.getTime();
      });
      const scores = dayTests.map((t) => t.score).filter((s: any) => typeof s === "number") as number[];
      const avg = scores.length ? Math.round(scores.reduce((s: number, x: number) => s + x, 0) / scores.length) : null;
      const passed = dayTests.filter((t) => t.passed === true).length;
      dailySeries.push({
        date: d.toISOString().slice(0, 10),
        count: dayTests.length,
        avgScore: avg,
        passed,
        failed: dayTests.length - passed,
      });
    }

    // ---- Top skills (most attempted in window) with team pass rate ----
    const skillMap = new Map<string, { attempts: number; passed: number; sum: number; n: number }>();
    for (const t of tests as any[]) {
      const name = String(t.skillName || "Unknown");
      const cur = skillMap.get(name) || { attempts: 0, passed: 0, sum: 0, n: 0 };
      cur.attempts += 1;
      if (t.passed === true) cur.passed += 1;
      if (typeof t.score === "number") {
        cur.sum += t.score;
        cur.n += 1;
      }
      skillMap.set(name, cur);
    }
    const topSkills = Array.from(skillMap.entries())
      .map(([name, s]) => ({
        name,
        attempts: s.attempts,
        passRate: s.attempts > 0 ? Math.round((s.passed / s.attempts) * 100) : 0,
        avgScore: s.n > 0 ? Math.round(s.sum / s.n) : null,
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8);

    // ---- Per-role aggregates (active preps only) ----
    const roleMap = new Map<string, { learners: Set<string>; sum: number; n: number }>();
    for (const p of preps as any[]) {
      if (!p.isActive) continue;
      const name = String(p.roleName || "Unknown");
      const cur = roleMap.get(name) || { learners: new Set<string>(), sum: 0, n: 0 };
      cur.learners.add(String(p.studentId || ""));
      cur.sum += this.prepPct(p);
      cur.n += 1;
      roleMap.set(name, cur);
    }
    const roleAggregates = Array.from(roleMap.entries())
      .map(([name, s]) => ({
        name,
        learners: s.learners.size,
        avgPct: s.n > 0 ? Math.round(s.sum / s.n) : 0,
      }))
      .sort((a, b) => b.learners - a.learners)
      .slice(0, 8);

    // ---- Engagement: who interacted in last 7d / 30d ----
    const now = Date.now();
    const d7 = now - 7 * 24 * 60 * 60 * 1000;
    const d30 = now - 30 * 24 * 60 * 60 * 1000;
    const active7 = new Set<string>();
    const active30 = new Set<string>();
    const touch = (sid: string, ts: number) => {
      if (!sid || !ts) return;
      if (ts >= d7) active7.add(sid);
      if (ts >= d30) active30.add(sid);
    };
    for (const t of tests as any[]) {
      const ts = t.completedAt ? new Date(t.completedAt).getTime() : (t.createdAt ? new Date(t.createdAt).getTime() : 0);
      touch(String(t.studentId || ""), ts);
    }
    for (const p of preps as any[]) {
      const ts = p.updatedAt ? new Date(p.updatedAt).getTime() : (p.createdAt ? new Date(p.createdAt).getTime() : 0);
      touch(String(p.studentId || ""), ts);
    }

    return {
      activityFeed,
      dailySeries,
      topSkills,
      roleAggregates,
      engagement: {
        active7d: active7.size,
        active30d: active30.size,
        dormant: Math.max(0, ids.length - active30.size),
        total: ids.length,
      },
    };
  }

  async getEmployeesPrepSummaryForManager(companyDomain: string, department?: string) {
    const employees = await this.getEmployeesForManager(companyDomain, department);
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

