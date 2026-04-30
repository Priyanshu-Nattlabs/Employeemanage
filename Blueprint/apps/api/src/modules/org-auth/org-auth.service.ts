import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import * as XLSX from "xlsx";
import {
  CompanyOrgStructure,
  type CompanyOrgStructureDocument,
  CompanyUser,
  type CompanyUserDocument,
  type OrgAccountType,
  type OrgCurrentRole,
  RolePreparation,
  type RolePreparationDocument,
  RoleRecommendation,
  type RoleRecommendationDocument,
  type RoleRecommendationStatus,
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

/**
 * Normalizes department names for resilient matching.
 * Examples:
 * - "IT" -> "it"
 * - "Information Technology" -> "it"
 * - "Developement" -> "development"
 * - "Sales & Marketing" -> "salesmarketing"
 */
function normalizeDepartmentKey(raw: string): string {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  const compact = s.replace(/[^a-z0-9]+/g, "");
  // common aliases / misspellings
  if (compact === "informationtechnology") return "it";
  if (compact === "infotech") return "it";
  if (compact === "developement") return "development";
  if (compact === "softwaredevelopment") return "development";
  if (compact === "engineering") return "development";
  return compact;
}

function domainBucketForRoleName(roleName: string): string {
  const n = " " + String(roleName || "").toLowerCase() + " ";
  const has = (list: string[]) => list.some((k) => n.includes(k));
  if (has(["developer", "engineer", "programmer", "software", "web", "mobile", "devops", "cloud", "data", "ml ", "ai ", "security", "network", "it ", "system", "database", "frontend", "backend", "fullstack"])) return "Technology";
  if (has(["manager", "director", "head", "lead", "chief", "officer", "president", "vp ", "cto", "ceo", "cfo", "coo", "executive"])) return "Management";
  if (has(["design", "ux", "ui ", "graphic", "creative", "visual", "artist", "animator", "illustrat"])) return "Design & Creative";
  if (has(["finance", "account", "audit", "tax", "invest", "banking", "actuari", "financial analyst", "cfo"])) return "Finance & Accounting";
  if (has(["sales", "marketing", "brand", "growth", "digital market", "seo", "advertis", "business development"])) return "Sales & Marketing";
  if (has(["doctor", "nurse", "physician", "surgeon", "therapist", "pharmacist", "medical", "clinical", "health"])) return "Healthcare";
  if (has(["teacher", "professor", "lecturer", "researcher", "scientist", "academic", "trainer", "instructor"])) return "Education & Research";
  if (has(["operations", "logistics", "supply chain", "procurement", "warehouse", "quality", "production"])) return "Operations & Logistics";
  if (has(["lawyer", "attorney", "legal", "compliance", "law ", "paralegal", "advocate"])) return "Legal & Compliance";
  if (has(["hr ", "human resource", "recruiter", "talent", "people", "culture", "payroll"])) return "Human Resources";
  if (has(["analyst", "analytics", "data scientist", "business intelligence", "bi ", "statistics", "quantitative"])) return "Analytics & Data";
  return "All";
}

function isKnownDomainDepartment(rawDept: string): boolean {
  const d = String(rawDept || "").trim();
  if (!d) return false;
  return [
    "Technology",
    "Management",
    "Design & Creative",
    "Finance & Accounting",
    "Sales & Marketing",
    "Healthcare",
    "Education & Research",
    "Operations & Logistics",
    "Legal & Compliance",
    "Human Resources",
    "Analytics & Data",
  ].includes(d);
}

function emailDomain(email: string): string {
  const at = normalizeEmail(email).split("@");
  return at.length === 2 ? at[1] : "";
}

function normalizeDomain(domain: string): string {
  return (domain || "").trim().toLowerCase().replace(/^@/, "");
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Which portal branding to show in the email From display name (address still comes from SMTP_*, see extractMailboxAddress). */
type MailPortalBranding = "employee_login" | "manager_login_or_signup";

function extractMailboxAddress(): string {
  const raw = (process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@example.com").trim();
  const m = /<([^<>]+@[^<>]+)>/.exec(raw);
  if (m) return m[1].trim();
  return raw;
}

function fromHeaderForPortal(kind: MailPortalBranding): string {
  const addr = extractMailboxAddress();
  const displayName =
    kind === "employee_login"
      ? "Employee Development — Employee login"
      : "Employee Development — Manager login or signup";
  return `${displayName} <${addr}>`;
}

@Injectable()
export class OrgAuthService {
  constructor(
    @InjectModel(CompanyUser.name) private readonly companyUserModel: Model<CompanyUserDocument>,
    @InjectModel(RolePreparation.name) private readonly prepModel: Model<RolePreparationDocument>,
    @InjectModel(SkillTest.name) private readonly testModel: Model<SkillTestDocument>,
    @InjectModel(CompanyOrgStructure.name) private readonly orgStructureModel: Model<CompanyOrgStructureDocument>,
    @InjectModel(RoleRecommendation.name) private readonly recommendationModel: Model<RoleRecommendationDocument>,
  ) {}

  private otpHash(email: string, otp: string): string {
    const h = crypto.createHash("sha256");
    h.update(`${normalizeEmail(email)}:${otp}:${OTP_SECRET}`);
    return h.digest("hex");
  }

  /** Separate namespace from email verification OTP hashes. */
  private passwordResetOtpHash(email: string, otp: string): string {
    const h = crypto.createHash("sha256");
    h.update(`PWRESET:${normalizeEmail(email)}:${otp}:${OTP_SECRET}`);
    return h.digest("hex");
  }

  private generateOtp(): string {
    // 6-digit numeric code (000000-999999)
    const n = crypto.randomInt(0, 1_000_000);
    return String(n).padStart(6, "0");
  }

  private mailPortalBrandingForUser(user: CompanyUserDocument): MailPortalBranding {
    if (user.accountType === "ADMIN") return "manager_login_or_signup";
    if (user.currentRole === "MANAGER" || user.currentRole === "HR") return "manager_login_or_signup";
    return "employee_login";
  }

  private async sendOtpEmail(
    email: string,
    otp: string,
    portal: MailPortalBranding,
  ): Promise<null | { messageId?: string; accepted?: any; rejected?: any; response?: string }> {
    const host = (process.env.SMTP_HOST || "").trim();
    const port = Number(process.env.SMTP_PORT || "0");
    const user = (process.env.SMTP_USER || "").trim();
    const pass = (process.env.SMTP_PASS || "").trim();
    const from = fromHeaderForPortal(portal);

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
    return await this.sendOtpEmail(user.email, otp, this.mailPortalBrandingForUser(user));
  }

  private async sendPasswordResetOtpEmail(
    email: string,
    otp: string,
  ): Promise<null | { messageId?: string; accepted?: any; rejected?: any; response?: string }> {
    const host = (process.env.SMTP_HOST || "").trim();
    const port = Number(process.env.SMTP_PORT || "0");
    const user = (process.env.SMTP_USER || "").trim();
    const pass = (process.env.SMTP_PASS || "").trim();
    const from = fromHeaderForPortal("manager_login_or_signup");

    if (!host || !port || !user || !pass) {
      // eslint-disable-next-line no-console
      console.log(`[ORG AUTH] Password reset OTP for ${email}: ${otp} (SMTP not configured)`);
      return null;
    }

    const secure = port === 465;
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      requireTLS: !secure,
    });

    const info = await transport.sendMail({
      from,
      to: normalizeEmail(email),
      subject: "Your password reset code",
      text: `Your password reset code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.`,
      html: `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height:1.5">
          <h2 style="margin:0 0 10px">Reset your password</h2>
          <p style="margin:0 0 14px">Use this code to set a new password for your Manager/HR account:</p>
          <div style="font-size:28px; font-weight:800; letter-spacing:6px; margin:0 0 14px">${otp}</div>
          <p style="margin:0; color:#475569">This code expires in ${OTP_TTL_MINUTES} minutes.</p>
        </div>
      `,
    });

    // eslint-disable-next-line no-console
    console.log("[ORG AUTH] Password reset OTP email sent", {
      to: normalizeEmail(email),
      messageId: (info as any)?.messageId,
    });

    if (!OTP_DEBUG) return null;
    return {
      messageId: (info as any)?.messageId,
      accepted: (info as any)?.accepted,
      rejected: (info as any)?.rejected,
      response: (info as any)?.response,
    };
  }

  private isManagerOrHrPortalUser(u: CompanyUserDocument | any): boolean {
    return u?.accountType === "EMPLOYEE" && (u?.currentRole === "MANAGER" || u?.currentRole === "HR");
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

  private authPayload(user: CompanyUserDocument) {
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

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private serializeOrgUser(u: any) {
    const id = String(u?._id ?? u?.id ?? "");
    return {
      id,
      email: u?.email,
      fullName: u?.fullName,
      designation: u?.designation,
      department: u?.department,
      companyName: u?.companyName,
      companyDomain: u?.companyDomain,
      employeeId: u?.employeeId,
      currentRole: u?.currentRole,
      accountType: u?.accountType,
      mobileNo: u?.mobileNo,
      reportingManagerEmail: u?.reportingManagerEmail,
      needsProfileCompletion: Boolean(u?.needsProfileCompletion),
      mustChangePassword: Boolean(u?.mustChangePassword),
    };
  }

  private randomInvitePassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let s = "";
    for (let i = 0; i < 12; i++) s += chars[crypto.randomInt(0, chars.length)];
    return s;
  }

  private async generateUniqueEmployeeId(companyDomain: string): Promise<string> {
    const dom = normalizeDomain(companyDomain);
    const prefix =
      dom
        .split(".")[0]
        .replace(/[^a-z0-9]/gi, "")
        .toUpperCase()
        .slice(0, 6) || "ORG";
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = `${prefix}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const exists = await this.companyUserModel.exists({ companyDomain: dom, employeeId: candidate });
      if (!exists) return candidate;
    }
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  }

  private parseInviteSpreadsheet(buffer: Buffer): Array<{ email: string; name: string; department?: string }> {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) return [];
    const sheet = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const normKey = (k: string) =>
      String(k || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    const out: Array<{ email: string; name: string; department?: string }> = [];
    for (const row of raw) {
      const map: Record<string, string> = {};
      for (const k of Object.keys(row)) {
        map[normKey(k)] = String(row[k] ?? "").trim();
      }
      const email =
        map["email"] ||
        map["company email"] ||
        map["work email"] ||
        map["e-mail"] ||
        map["company mail"] ||
        map["work_mail"] ||
        "";
      const name =
        map["name"] || map["full name"] || map["employee name"] || map["full_name"] || map["employee_name"] || "";
      const department = map["department"] || map["dept"] || map["team"] || "";
      if (!email && !name) continue;
      out.push({ email, name, department: department || undefined });
    }
    return out;
  }

  private async sendInviteCredentialsEmail(input: {
    to: string;
    fullName: string;
    tempPassword: string;
    employeeId?: string;
    invitedByName?: string;
    loginUrl?: string;
  }) {
    const host = (process.env.SMTP_HOST || "").trim();
    const port = Number(process.env.SMTP_PORT || "0");
    const user = (process.env.SMTP_USER || "").trim();
    const pass = (process.env.SMTP_PASS || "").trim();
    const from = fromHeaderForPortal("employee_login");

    const portal = (process.env.ORG_PORTAL_BASE_URL || "").trim().replace(/\/$/, "");
    const loginHref = (input.loginUrl && input.loginUrl.trim()) || (portal ? `${portal}/auth/employee/login` : "");

    const textLines = [
      `Hello ${input.fullName || input.to},`,
      ``,
      `Your manager has created an account for you on the employee portal.`,
      input.employeeId ? `Employee ID: ${input.employeeId}` : ``,
      ``,
      `Sign in with your company email and this temporary password:`,
      `${input.tempPassword}`,
      ``,
      loginHref ? `Login: ${loginHref}` : `Login: use your company portal employee login page`,
      ``,
      `After you sign in, you will be asked to complete your profile and choose a new password.`,
    ];

    if (!host || !port || !user || !pass) {
      // eslint-disable-next-line no-console
      console.log(`[ORG AUTH] Invite credentials for ${input.to} (SMTP not configured). Temp password: ${input.tempPassword}`);
      return null;
    }

    const secure = port === 465;
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      requireTLS: !secure,
    });

    const info = await transport.sendMail({
      from,
      to: normalizeEmail(input.to),
      subject: "Your employee portal login",
      text: textLines.join("\n"),
      html: `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height:1.55; color:#0f172a">
          <h2 style="margin:0 0 10px">Welcome${input.invitedByName ? ` — invited by ${escapeHtml(input.invitedByName)}` : ""}</h2>
          <p style="margin:0 0 12px">Hello <b>${escapeHtml(input.fullName || input.to)}</b>,</p>
          <p style="margin:0 0 12px">Your account is ready. Use your company email and this <b>temporary password</b> to sign in:</p>
          <div style="font-size:22px; font-weight:900; letter-spacing:1px; margin:0 0 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">${escapeHtml(input.tempPassword)}</div>
          ${input.employeeId ? `<p style="margin:0 0 12px"><b>Employee ID:</b> ${escapeHtml(input.employeeId)}</p>` : ""}
          <p style="margin:0 0 12px">${
            loginHref
              ? `<a href="${escapeHtml(loginHref)}" style="color:#2563eb; font-weight:800">Open login page</a>`
              : `<span style="color:#475569">Open your company’s employee login page (your manager can share the link).</span>`
          }</p>
          <p style="margin:0; color:#475569; font-size:13px">After login you must complete your profile and set a new password.</p>
        </div>
      `,
    });

    // eslint-disable-next-line no-console
    console.log("[ORG AUTH] Invite email sent", { to: normalizeEmail(input.to), messageId: (info as any)?.messageId });
    return info;
  }

  async bulkInviteEmployeesFromExcel(input: { actorJwt: any; file?: Express.Multer.File }) {
    const me = input.actorJwt;
    const file = input.file;
    if (!file?.buffer?.length) throw new BadRequestException("Upload an Excel file (.xlsx or .xls)");

    const isManager = me?.accountType === "EMPLOYEE" && me?.currentRole === "MANAGER";
    const isHR = me?.accountType === "EMPLOYEE" && me?.currentRole === "HR";
    if (!isManager && !isHR) throw new UnauthorizedException("Only managers or HR can invite employees");

    const managerProfile = await this.getProfileById(me.sub);
    const managerDept = String((managerProfile as any)?.department || "").trim();
    if (isManager && !managerDept) {
      throw new BadRequestException("Your profile has no department. Update your profile before inviting teammates.");
    }

    const companyDomain = normalizeDomain(me.companyDomain);
    const companyName = String(me.companyName || "").trim();
    const mgrEmail = normalizeEmail(me.email);
    const mgrName = String(me.fullName || "").trim();

    const parsed = this.parseInviteSpreadsheet(file.buffer);
    if (!parsed.length) {
      throw new BadRequestException(
        "No valid rows found. Add a header row with columns such as Email and Name (and Department when uploading as HR).",
      );
    }
    if (parsed.length > 200) throw new BadRequestException("Too many rows (max 200 per upload)");

    const staticPw = (process.env.ORG_MANAGER_INVITE_STATIC_PASSWORD || "").trim();
    if (staticPw && staticPw.length < 8) {
      throw new BadRequestException("ORG_MANAGER_INVITE_STATIC_PASSWORD must be at least 8 characters");
    }

    const portalBase = (process.env.ORG_PORTAL_BASE_URL || "").trim().replace(/\/$/, "");
    const loginUrl = portalBase ? `${portalBase}/auth/employee/login` : "";

    const invited: Array<{ email: string; employeeId: string }> = [];
    const errors: Array<{ row: number; email: string; message: string }> = [];

    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      const rowNum = i + 2;
      const emailRaw = row.email;
      try {
        const email = normalizeEmail(emailRaw);
        if (!email) throw new Error("Missing email");
        if (emailDomain(email) !== companyDomain) {
          throw new Error(`Email must use @${companyDomain}`);
        }

        let dept = managerDept;
        if (isHR) {
          dept = String(row.department || "").trim();
          if (!dept) throw new Error("Department column is required for each row when HR uploads the sheet");
        }

        const fullName = String(row.name || "").trim() || email.split("@")[0] || "Employee";

        const exists = await this.companyUserModel.findOne({ email }).lean();
        if (exists) throw new Error("An account with this email already exists");

        const tempPassword = staticPw || this.randomInvitePassword();
        const employeeId = await this.generateUniqueEmployeeId(companyDomain);
        const passwordHash = await bcrypt.hash(tempPassword, 12);

        await this.companyUserModel.create({
          email,
          passwordHash,
          fullName,
          designation: undefined,
          department: dept,
          companyName,
          companyDomain,
          employeeId,
          currentRole: "EMPLOYEE",
          accountType: "EMPLOYEE",
          reportingManagerEmail: mgrEmail,
          mobileNo: undefined,
          emailVerified: true,
          needsProfileCompletion: true,
          mustChangePassword: true,
        });

        await this.sendInviteCredentialsEmail({
          to: email,
          fullName,
          tempPassword,
          employeeId,
          invitedByName: mgrName,
          loginUrl: loginUrl || undefined,
        });

        invited.push({ email, employeeId });
      } catch (e: any) {
        errors.push({ row: rowNum, email: String(emailRaw || ""), message: e?.message || "Failed" });
      }
    }

    return { ok: true, created: invited.length, invited, errors };
  }

  async completeInviteProfile(
    userId: string,
    body: { newPassword: string; fullName?: string; designation: string; mobileNo: string; employeeId?: string },
  ) {
    if (!userId) throw new UnauthorizedException("Invalid token");
    const user = await this.companyUserModel.findById(userId);
    if (!user) throw new NotFoundException("User not found");
    if (!user.needsProfileCompletion && !user.mustChangePassword) {
      throw new BadRequestException("Your profile is already complete");
    }
    if (user.accountType !== "EMPLOYEE") throw new BadRequestException("This flow is only for employee accounts");

    const designation = String(body.designation || "").trim();
    const mobileNo = String(body.mobileNo || "").trim();
    const newPassword = String(body.newPassword || "");
    if (newPassword.length < 8) throw new BadRequestException("Password must be at least 8 characters");
    if (designation.length < 2) throw new BadRequestException("Designation is required");
    if (mobileNo.length < 5) throw new BadRequestException("Mobile number is required");

    const okOld = await bcrypt.compare(newPassword, user.passwordHash);
    if (okOld) throw new BadRequestException("New password must be different from the temporary password");

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    user.needsProfileCompletion = false;
    user.designation = designation;
    user.mobileNo = mobileNo;
    user.emailVerified = true;

    const fn = String(body.fullName || "").trim();
    if (fn) user.fullName = fn;

    const eid = String(body.employeeId || "").trim();
    if (eid) {
      const dom = normalizeDomain(user.companyDomain);
      const clash = await this.companyUserModel
        .findOne({ companyDomain: dom, employeeId: eid, _id: { $ne: user._id } })
        .lean();
      if (clash) throw new BadRequestException("That employee ID is already used by someone else");
      user.employeeId = eid;
    }

    await user.save();
    const plain = user.toObject();
    return { token: this.signToken(user), user: this.serializeOrgUser(plain) };
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
    await this.setAndSendEmailOtp(created);
    return { verificationRequired: true as const, email: created.email };
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
    await this.setAndSendEmailOtp(created);
    return { verificationRequired: true as const, email: created.email };
  }

  async login(emailRaw: string, password: string) {
    const email = normalizeEmail(emailRaw);
    const user = await this.companyUserModel.findOne({ email });
    if (!user) throw new UnauthorizedException("Invalid email or password");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("Invalid email or password");
    if (!user.emailVerified) {
      throw new UnauthorizedException("Email not verified. Please verify your email with OTP.");
    }
    const token = this.signToken(user);
    return { token, user: this.serializeOrgUser(user.toObject ? user.toObject() : user) };
  }

  async resendEmailOtp(emailRaw: string) {
    const email = normalizeEmail(emailRaw);
    const user = await this.companyUserModel.findOne({ email });
    if (!user) throw new NotFoundException("User not found");
    if (user.emailVerified) {
      return { ok: true, message: "This email is already verified." };
    }
    const last = user.emailOtpLastSentAt ? new Date(user.emailOtpLastSentAt).getTime() : 0;
    if (last && Date.now() - last < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      throw new BadRequestException(`Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code.`);
    }
    await this.setAndSendEmailOtp(user);
    return { ok: true, message: "We sent a new verification code to your email." };
  }

  async verifyEmailOtp(emailRaw: string, otpRaw: string) {
    const email = normalizeEmail(emailRaw);
    const otp = (otpRaw || "").trim();
    const user = await this.companyUserModel.findOne({ email });
    if (!user) throw new NotFoundException("User not found");
    if (user.emailVerified) {
      const token = this.signToken(user);
      return { token, user: this.serializeOrgUser(user.toObject ? user.toObject() : user) };
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
    user.emailOtpLastSentAt = undefined;
    await user.save();

    const token = this.signToken(user);
    return { token, user: this.serializeOrgUser(user.toObject ? user.toObject() : user) };
  }

  /**
   * Sends a 6-digit OTP to the email for Manager/HR employee accounts only.
   * Response is generic whether or not the user exists (avoids email enumeration).
   */
  async requestManagerHrPasswordResetOtp(emailRaw: string) {
    const email = normalizeEmail(emailRaw);
    const user = await this.companyUserModel.findOne({ email });
    const ok = user && this.isManagerOrHrPortalUser(user);
    if (ok) {
      const last = user!.passwordResetOtpLastSentAt ? new Date(user!.passwordResetOtpLastSentAt).getTime() : 0;
      if (last && Date.now() - last < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        throw new BadRequestException(`Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code.`);
      }
      const otp = this.generateOtp();
      user!.passwordResetOtpHash = this.passwordResetOtpHash(user!.email, otp);
      user!.passwordResetOtpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
      user!.passwordResetOtpLastSentAt = new Date();
      await user!.save();
      await this.sendPasswordResetOtpEmail(user!.email, otp);
    }
    return {
      ok: true,
      message: "If this email is registered as a Manager or HR account, we sent a verification code.",
    };
  }

  /** Verifies OTP and sets the new password for Manager/HR portal accounts. */
  async confirmManagerHrPasswordReset(emailRaw: string, otpRaw: string, newPassword: string) {
    const email = normalizeEmail(emailRaw);
    const otp = (otpRaw || "").trim();
    const user = await this.companyUserModel.findOne({ email });
    if (!user || !this.isManagerOrHrPortalUser(user)) {
      throw new BadRequestException("Invalid or expired code");
    }

    const exp = user.passwordResetOtpExpiresAt ? new Date(user.passwordResetOtpExpiresAt).getTime() : 0;
    if (!user.passwordResetOtpHash || !exp || Date.now() > exp) {
      throw new BadRequestException("Invalid or expired code");
    }

    const got = this.passwordResetOtpHash(user.email, otp);
    const a = Buffer.from(got, "hex");
    const b = Buffer.from(user.passwordResetOtpHash, "hex");
    const otpOk = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!otpOk) throw new BadRequestException("Invalid or expired code");

    user.passwordResetOtpHash = undefined;
    user.passwordResetOtpExpiresAt = undefined;
    user.passwordResetOtpLastSentAt = undefined;
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.emailVerified = true;
    await user.save();

    const token = this.signToken(user);
    return { token, user: this.serializeOrgUser(user.toObject ? user.toObject() : user) };
  }

  /**
   * Employees visible to Manager/HR dashboards: org accounts with `currentRole: EMPLOYEE`
   * (employee portal signups and invited line employees)—not peers with Manager/HR roles.
   *
   * @param department - If **omitted** (HR callers), lists all line employees for the domain.
   *                     If **passed** (always for managers—even `""`), require a non-empty department
   *                     to scope results; managers with no department get an empty roster (never whole-domain leakage).
   */
  async getEmployeesForManager(companyDomain: string, department?: string) {
    const domain = normalizeDomain(companyDomain);
    const filter: any = {
      companyDomain: domain,
      accountType: "EMPLOYEE",
      currentRole: "EMPLOYEE",
    };

    if (department !== undefined) {
      const dept = String(department || "").trim();
      if (!dept) {
        return [];
      }
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

    const pending = await this.companyUserModel.findById(id).select("needsProfileCompletion mustChangePassword").lean();
    if (pending && ((pending as any).needsProfileCompletion || (pending as any).mustChangePassword)) {
      throw new BadRequestException("Complete the profile setup form first (you will be redirected after login).");
    }

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

  // ────────────────────────────────────────────────────────────────────────────
  // Organization structure (per company domain)
  // ────────────────────────────────────────────────────────────────────────────

  async getOrgStructure(companyDomain: string) {
    const domain = (companyDomain || "").trim().toLowerCase();
    if (!domain) return null;
    return this.orgStructureModel.findOne({ companyDomain: domain }).lean();
  }

  async upsertOrgStructure(input: {
    companyDomain: string;
    companyName?: string;
    setupByEmail?: string;
    setupByName?: string;
    departments: Array<{ name: string; roles: string[]; description?: string }>;
  }) {
    const domain = (input.companyDomain || "").trim().toLowerCase();
    if (!domain) throw new BadRequestException("Missing companyDomain");

    const cleaned = (input.departments || [])
      .map((d) => ({
        name: String(d?.name || "").trim(),
        roles: Array.from(
          new Set(
            (Array.isArray(d?.roles) ? d.roles : [])
              .map((r) => String(r || "").trim())
              .filter(Boolean),
          ),
        ),
        description: d?.description ? String(d.description).trim() : undefined,
      }))
      .filter((d) => d.name.length > 0);

    if (!cleaned.length) {
      throw new BadRequestException("Provide at least one department with roles");
    }

    const updated = await this.orgStructureModel
      .findOneAndUpdate(
        { companyDomain: domain },
        {
          $set: {
            companyDomain: domain,
            companyName: input.companyName,
            setupByEmail: input.setupByEmail,
            setupByName: input.setupByName,
            departments: cleaned,
          },
        },
        { new: true, upsert: true },
      )
      .lean();
    return updated;
  }

  /**
   * Public: department names for signup dropdowns.
   * Returns [] when structure isn't configured.
   */
  async listPublicDepartments(companyDomain: string): Promise<string[]> {
    const domain = String(companyDomain || "").trim().toLowerCase();
    if (!domain) return [];
    const structure = await this.orgStructureModel.findOne({ companyDomain: domain }).lean();
    const list = Array.isArray((structure as any)?.departments) ? (structure as any).departments : [];
    const names = list
      .map((d: any) => String(d?.name || "").trim())
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Roles a manager can recommend to the given employee. Looks up the employee's
   * department, then returns roles tied to that department in the company's
   * org-structure document. Falls back to the global role list (intersected with
   * the structure when present).
   */
  async listRecommendableRolesForEmployee(input: {
    companyDomain: string;
    managerDepartment?: string;
    managerRole: OrgCurrentRole | string;
    employeeId: string;
  }) {
    const domain = (input.companyDomain || "").trim().toLowerCase();
    if (!domain) throw new BadRequestException("Missing companyDomain");
    if (!input.employeeId) throw new BadRequestException("Missing employeeId");

    const employee = await this.companyUserModel
      .findOne({ _id: input.employeeId, companyDomain: domain })
      .select("-passwordHash")
      .lean();
    if (!employee) throw new NotFoundException("Employee not found");
    if (String((employee as any).currentRole || "EMPLOYEE") !== "EMPLOYEE") {
      throw new BadRequestException("Recommendations apply to line employees only.");
    }

    const empDept = String((employee as any).department || "").trim();

    // Managers may only recommend within their own department; HR can recommend to any.
    if (input.managerRole === "MANAGER") {
      const mgrDept = String(input.managerDepartment || "").trim();
      const mgrKey = normalizeDepartmentKey(mgrDept);
      const empKey = normalizeDepartmentKey(empDept);
      if (!mgrKey || !empKey || mgrKey !== empKey) {
        throw new UnauthorizedException("Managers can only recommend roles to their own department");
      }
    }

    const structure = await this.orgStructureModel.findOne({ companyDomain: domain }).lean();
    const all = (structure?.departments || []) as Array<{ name: string; roles: string[]; description?: string }>;

    // Role catalog scope:
    // - Managers: recommend roles for their own department (the department they chose).
    // - HR: recommend roles for the employee's department (can work across departments).
    const targetDeptRaw =
      input.managerRole === "MANAGER" ? String(input.managerDepartment || "").trim() : empDept;
    const targetKey = normalizeDepartmentKey(targetDeptRaw);
    const match = all.find((d) => normalizeDepartmentKey(String(d.name || "")) === targetKey);

    return {
      employee: {
        id: String((employee as any)._id || ""),
        email: (employee as any).email,
        fullName: (employee as any).fullName,
        department: empDept || null,
        designation: (employee as any).designation || null,
      },
      hasStructure: Boolean(structure),
      department: match?.name || targetDeptRaw || null,
      roles: match?.roles || [],
      allDepartments: all,
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Role recommendations (manager → employee notifications)
  // ────────────────────────────────────────────────────────────────────────────

  async createRecommendation(input: {
    companyDomain: string;
    manager: { id: string; email: string; name?: string; role: OrgCurrentRole | string; department?: string };
    employeeId: string;
    roleName: string;
    note?: string;
  }) {
    const domain = (input.companyDomain || "").trim().toLowerCase();
    if (!domain) throw new BadRequestException("Missing companyDomain");
    const role = String(input.roleName || "").trim();
    if (!role) throw new BadRequestException("Missing roleName");

    const employee = await this.companyUserModel
      .findOne({ _id: input.employeeId, companyDomain: domain })
      .select("-passwordHash")
      .lean();
    if (!employee) throw new NotFoundException("Employee not found");
    if (String((employee as any).currentRole || "EMPLOYEE") !== "EMPLOYEE") {
      throw new BadRequestException("Recommendations apply to line employees only.");
    }

    const empDept = String((employee as any).department || "").trim();

    if (input.manager.role === "MANAGER") {
      const mgrDept = String(input.manager.department || "").trim();
      const mgrKey = normalizeDepartmentKey(mgrDept);
      const empKey = normalizeDepartmentKey(empDept);
      if (!mgrKey || !empKey || mgrKey !== empKey) {
        throw new UnauthorizedException("Managers can only recommend roles within their own department");
      }
    }

    // If the company has explicitly mapped roles for the employee's department,
    // enforce that the suggested role lives in the correct mapping:
    // - Managers: their own department mapping (department they chose)
    // - HR: the employee's department mapping
    // When no mapping is defined for that department we accept any role so the sender isn't blocked.
    const structure = await this.orgStructureModel.findOne({ companyDomain: domain }).lean();
    if (structure) {
      const mappingDeptRaw =
        input.manager.role === "MANAGER" ? String(input.manager.department || "").trim() : empDept;
      const match = (structure.departments || []).find(
        (d: any) => normalizeDepartmentKey(String(d.name || "")) === normalizeDepartmentKey(mappingDeptRaw),
      );
      const mappedRoles: string[] = (match?.roles || []) as string[];
      if (mappedRoles.length > 0) {
        const ok = mappedRoles.some((r) => r.trim().toLowerCase() === role.toLowerCase());
        if (!ok) {
          throw new BadRequestException(
            `Role "${role}" is not part of the ${match?.name || mappingDeptRaw || "selected"} department`,
          );
        }
      }
    }

    // If org structure isn't configured for the manager's department but the department is a known domain
    // bucket (Technology/Management/...), enforce that the role name matches that domain.
    if (input.manager.role === "MANAGER") {
      const dept = String(input.manager.department || "").trim();
      if (isKnownDomainDepartment(dept)) {
        const bucket = domainBucketForRoleName(role);
        if (bucket !== dept) {
          throw new BadRequestException(`Role "${role}" does not match manager department "${dept}"`);
        }
      }
    }

    // De-duplicate: if there is already a non-dismissed PENDING/SEEN suggestion for the same role,
    // refresh its timestamp instead of creating a new one.
    const existing = await this.recommendationModel.findOne({
      companyDomain: domain,
      recommendedToId: String((employee as any)._id),
      roleName: role,
      status: { $in: ["PENDING", "SEEN"] },
    });
    if (existing) {
      existing.recommendedById = input.manager.id;
      existing.recommendedByEmail = input.manager.email;
      existing.recommendedByName = input.manager.name;
      existing.recommendedByRole = input.manager.role as OrgCurrentRole;
      existing.note = input.note;
      existing.status = "PENDING";
      existing.seenAt = undefined;
      await existing.save();
      return existing.toObject();
    }

    const created = await this.recommendationModel.create({
      companyDomain: domain,
      recommendedById: input.manager.id,
      recommendedByEmail: input.manager.email,
      recommendedByName: input.manager.name,
      recommendedByRole: input.manager.role as OrgCurrentRole,
      recommendedToId: String((employee as any)._id),
      recommendedToEmail: (employee as any).email,
      recommendedToName: (employee as any).fullName,
      recommendedToDepartment: empDept || undefined,
      roleName: role,
      note: input.note?.trim() || undefined,
      status: "PENDING",
    });
    return created.toObject();
  }

  async listRecommendationsForEmployee(employeeId: string) {
    if (!employeeId) return [];
    return this.recommendationModel
      .find({ recommendedToId: employeeId })
      .sort({ createdAt: -1 })
      .lean();
  }

  async listRecommendationsByManager(managerId: string) {
    if (!managerId) return [];
    return this.recommendationModel
      .find({ recommendedById: managerId })
      .sort({ createdAt: -1 })
      .lean();
  }

  async setRecommendationStatus(input: { recommendationId: string; employeeId: string; status: RoleRecommendationStatus }) {
    if (!input.recommendationId) throw new BadRequestException("Missing recommendationId");
    const allowed: RoleRecommendationStatus[] = ["PENDING", "SEEN", "DISMISSED", "ACCEPTED"];
    if (!allowed.includes(input.status)) throw new BadRequestException("Invalid status");

    const rec = await this.recommendationModel.findById(input.recommendationId);
    if (!rec) throw new NotFoundException("Recommendation not found");
    if (String(rec.recommendedToId) !== String(input.employeeId)) {
      throw new UnauthorizedException("You cannot modify someone else's recommendation");
    }
    rec.status = input.status;
    if (input.status === "SEEN") rec.seenAt = new Date();
    if (input.status === "ACCEPTED" || input.status === "DISMISSED") rec.respondedAt = new Date();
    await rec.save();
    return rec.toObject();
  }
}

