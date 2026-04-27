import { Body, Controller, Get, Headers, Patch, Post, Query, UnauthorizedException } from "@nestjs/common";
import { OrgAuthService } from "./org-auth.service";
import { LoginDto, RegisterAdminDto, RegisterEmployeeDto, ResendEmailOtpDto, VerifyEmailOtpDto } from "./org-auth.dto";

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
}

