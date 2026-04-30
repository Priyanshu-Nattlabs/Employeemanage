import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { OrgAuthService } from "./org-auth.service";
import {
  CompleteInviteDto,
  ForgotPasswordConfirmDto,
  ForgotPasswordRequestOtpDto,
  LoginDto,
  RegisterAdminDto,
  RegisterEmployeeDto,
  ResendEmailOtpDto,
  VerifyEmailOtpDto,
} from "./org-auth.dto";

function getBearerToken(authHeader?: string): string {
  const h = (authHeader || "").trim();
  if (!h) return "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return (m?.[1] || "").trim();
}

@Controller("api/org-auth")
export class OrgAuthController {
  constructor(private readonly service: OrgAuthService) {}

  @Post("register/employee")
  registerEmployee(@Body() body: RegisterEmployeeDto) {
    return this.service.registerEmployee(body as any);
  }

  @Post("register/admin")
  registerAdmin(@Body() body: RegisterAdminDto) {
    return this.service.registerAdmin(body as any);
  }

  @Post("verify-email-otp")
  verifyEmailOtp(@Body() body: VerifyEmailOtpDto) {
    return this.service.verifyEmailOtp(body.email, body.otp);
  }

  @Post("resend-email-otp")
  resendEmailOtp(@Body() body: ResendEmailOtpDto) {
    return this.service.resendEmailOtp(body.email);
  }

  @Post("login")
  login(@Body() body: LoginDto) {
    return this.service.login(body.email, body.password);
  }

  /** Manager/HR portal: request OTP to inbox for password reset (uses email typed on login screen). */
  @Post("forgot-password/request-otp")
  requestPasswordResetOtp(@Body() body: ForgotPasswordRequestOtpDto) {
    return this.service.requestManagerHrPasswordResetOtp(body.email);
  }

  /** Manager/HR portal: verify OTP and set new password; returns auth session. */
  @Post("forgot-password/confirm")
  confirmPasswordReset(@Body() body: ForgotPasswordConfirmDto) {
    return this.service.confirmManagerHrPasswordReset(body.email, body.otp, body.newPassword);
  }

  @Get("me")
  me(@Headers("authorization") authorization?: string) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    return this.service.verifyToken(token);
  }

  @Get("me/profile")
  async myProfile(@Headers("authorization") authorization?: string) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    return this.service.getProfileById(me?.sub);
  }

  @Patch("me/profile")
  async updateMyProfile(@Headers("authorization") authorization?: string, @Body() body?: any) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    return this.service.updateProfileById(me?.sub, body || {});
  }

  /** Invited employees: submit required profile fields and set a new password (after manager bulk upload). */
  @Post("me/complete-invite")
  async completeInvite(@Headers("authorization") authorization?: string, @Body() body?: CompleteInviteDto) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    return this.service.completeInviteProfile(me?.sub, body as any);
  }

  /** Manager / HR: bulk-create employees from first sheet of an Excel file (Email + Name columns; Department required per row for HR). */
  @Post("manager/invite-employees")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  async managerInviteEmployees(
    @Headers("authorization") authorization?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    if (!file?.buffer?.length) throw new BadRequestException("Missing file");
    return this.service.bulkInviteEmployeesFromExcel({ actorJwt: me, file });
  }

  /** Manager / HR view: list employees for the user's company domain. Manager scoped to their department, HR sees all. */
  @Get("employees")
  async employees(@Headers("authorization") authorization?: string, @Query("companyDomain") companyDomain?: string) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);

    const isManager = me?.accountType === "EMPLOYEE" && me?.currentRole === "MANAGER";
    const isHR = me?.accountType === "EMPLOYEE" && me?.currentRole === "HR";
    if (!isManager && !isHR) {
      throw new UnauthorizedException("Only managers or HR can access employee listings");
    }

    const domain = (companyDomain || me.companyDomain || "").trim().toLowerCase();
    if (!domain) throw new UnauthorizedException("Missing companyDomain");

    if (isHR) return this.service.getEmployeesForManager(domain);
    const profile = await this.service.getProfileById(me?.sub);
    const department = (profile as any)?.department || "";
    return this.service.getEmployeesForManager(domain, department);
  }

  /** Admin view: list employees for admin's company name + domain. */
  @Get("admin/employees")
  async adminEmployees(@Headers("authorization") authorization?: string) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);

    if (me?.accountType !== "ADMIN") {
      throw new UnauthorizedException("Only admins can access employee listings");
    }

    const domain = (me.companyDomain || "").trim().toLowerCase();
    const companyName = (me.companyName || "").trim();
    if (!domain || !companyName) throw new UnauthorizedException("Missing company info");
    return this.service.getEmployeesForAdmin(domain, companyName);
  }

  /** Admin view: employees + preparation/test summary. */
  @Get("admin/employees-summary")
  async adminEmployeesSummary(@Headers("authorization") authorization?: string) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    if (me?.accountType !== "ADMIN") throw new UnauthorizedException("Only admins can access employee summaries");
    const domain = (me.companyDomain || "").trim().toLowerCase();
    const companyName = (me.companyName || "").trim();
    if (!domain || !companyName) throw new UnauthorizedException("Missing company info");
    return this.service.getEmployeesPrepSummaryForAdmin(domain, companyName);
  }

  /** Manager / HR view: aggregated activity feed, trends, skill + role stats. Manager is scoped to their department. */
  @Get("employees-activity")
  async managerEmployeesActivity(@Headers("authorization") authorization?: string) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    const isManager = me?.accountType === "EMPLOYEE" && me?.currentRole === "MANAGER";
    const isHR = me?.accountType === "EMPLOYEE" && me?.currentRole === "HR";
    if (!isManager && !isHR) {
      throw new UnauthorizedException("Only managers or HR can access employee activity");
    }
    const domain = (me.companyDomain || "").trim().toLowerCase();
    if (!domain) throw new UnauthorizedException("Missing companyDomain");

    if (isHR) return this.service.getEmployeesActivityForManager(domain);
    const profile = await this.service.getProfileById(me?.sub);
    const department = (profile as any)?.department || "";
    return this.service.getEmployeesActivityForManager(domain, department);
  }

  /** Manager / HR view: employees + preparation/test summary. Manager is scoped to their department. */
  @Get("employees-summary")
  async managerEmployeesSummary(@Headers("authorization") authorization?: string) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    const isManager = me?.accountType === "EMPLOYEE" && me?.currentRole === "MANAGER";
    const isHR = me?.accountType === "EMPLOYEE" && me?.currentRole === "HR";
    if (!isManager && !isHR) {
      throw new UnauthorizedException("Only managers or HR can access employee summaries");
    }
    const domain = (me.companyDomain || "").trim().toLowerCase();
    if (!domain) throw new UnauthorizedException("Missing companyDomain");

    if (isHR) return this.service.getEmployeesPrepSummaryForManager(domain);
    const profile = await this.service.getProfileById(me?.sub);
    const department = (profile as any)?.department || "";
    return this.service.getEmployeesPrepSummaryForManager(domain, department);
  }

  // ───────────────────── Organization structure ─────────────────────

  /** Manager / HR: read the company's org structure (departments → roles map). */
  @Get("org-structure")
  async getOrgStructure(@Headers("authorization") authorization?: string) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    const isManager = me?.accountType === "EMPLOYEE" && me?.currentRole === "MANAGER";
    const isHR = me?.accountType === "EMPLOYEE" && me?.currentRole === "HR";
    if (!isManager && !isHR) throw new UnauthorizedException("Only managers or HR can view org structure");
    const domain = (me.companyDomain || "").trim().toLowerCase();
    return this.service.getOrgStructure(domain);
  }

  /**
   * Public: list department names for a company domain.
   * Used to populate signup dropdowns before login.
   *
   * NOTE: intentionally returns department names only (no roles).
   */
  @Get("public/departments")
  async publicDepartments(@Query("companyDomain") companyDomain?: string) {
    const domain = String(companyDomain || "").trim().toLowerCase();
    if (!domain) throw new BadRequestException("Missing companyDomain");
    return this.service.listPublicDepartments(domain);
  }

  /** Manager / HR: upsert the company's org structure. */
  @Post("org-structure")
  async saveOrgStructure(@Headers("authorization") authorization?: string, @Body() body?: any) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    const isManager = me?.accountType === "EMPLOYEE" && me?.currentRole === "MANAGER";
    const isHR = me?.accountType === "EMPLOYEE" && me?.currentRole === "HR";
    if (!isManager && !isHR) throw new UnauthorizedException("Only managers or HR can edit org structure");
    const domain = (me.companyDomain || "").trim().toLowerCase();
    return this.service.upsertOrgStructure({
      companyDomain: domain,
      companyName: me.companyName,
      setupByEmail: me.email,
      setupByName: me.fullName,
      departments: body?.departments || [],
    });
  }

  // ───────────────────── Role recommendations ─────────────────────

  /** Manager / HR: list the roles a manager can recommend to a given employee. */
  @Get("recommendable-roles")
  async recommendableRoles(
    @Headers("authorization") authorization?: string,
    @Query("employeeId") employeeId?: string,
  ) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    const isManager = me?.accountType === "EMPLOYEE" && me?.currentRole === "MANAGER";
    const isHR = me?.accountType === "EMPLOYEE" && me?.currentRole === "HR";
    if (!isManager && !isHR) throw new UnauthorizedException("Only managers or HR can view recommendable roles");

    const domain = (me.companyDomain || "").trim().toLowerCase();
    const profile = await this.service.getProfileById(me?.sub);
    const department = (profile as any)?.department || "";

    return this.service.listRecommendableRolesForEmployee({
      companyDomain: domain,
      managerDepartment: department,
      managerRole: me.currentRole,
      employeeId: String(employeeId || ""),
    });
  }

  /** Manager / HR: send a role recommendation to an employee. */
  @Post("recommendations")
  async createRecommendation(@Headers("authorization") authorization?: string, @Body() body?: any) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    const isManager = me?.accountType === "EMPLOYEE" && me?.currentRole === "MANAGER";
    const isHR = me?.accountType === "EMPLOYEE" && me?.currentRole === "HR";
    if (!isManager && !isHR) throw new UnauthorizedException("Only managers or HR can recommend roles");

    const domain = (me.companyDomain || "").trim().toLowerCase();
    const profile = await this.service.getProfileById(me?.sub);
    const department = (profile as any)?.department || "";

    return this.service.createRecommendation({
      companyDomain: domain,
      manager: {
        id: me.sub,
        email: me.email,
        name: me.fullName,
        role: me.currentRole,
        department,
      },
      employeeId: String(body?.employeeId || ""),
      roleName: String(body?.roleName || ""),
      note: body?.note ? String(body.note) : undefined,
    });
  }

  /** Manager / HR: list recommendations they have sent. */
  @Get("recommendations/sent")
  async sentRecommendations(@Headers("authorization") authorization?: string) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    const isManager = me?.accountType === "EMPLOYEE" && me?.currentRole === "MANAGER";
    const isHR = me?.accountType === "EMPLOYEE" && me?.currentRole === "HR";
    if (!isManager && !isHR) throw new UnauthorizedException("Only managers or HR can view sent recommendations");
    return this.service.listRecommendationsByManager(me.sub);
  }

  /** Employee inbox: list role recommendations sent to me. */
  @Get("recommendations/inbox")
  async myRecommendations(@Headers("authorization") authorization?: string) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    return this.service.listRecommendationsForEmployee(me.sub);
  }

  /** Employee: update status of one of my recommendations (mark seen/dismissed/accepted). */
  @Post("recommendations/:id/status")
  async updateRecommendationStatus(
    @Headers("authorization") authorization?: string,
    @Param("id") id?: string,
    @Body() body?: any,
  ) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.service.verifyToken(token);
    return this.service.setRecommendationStatus({
      recommendationId: String(id || ""),
      employeeId: me.sub,
      status: String(body?.status || "").toUpperCase() as any,
    });
  }
}

