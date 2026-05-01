import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Get,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { OrgAuthService } from "../org-auth/org-auth.service";
import { InterviewXService } from "./interviewx.service";

function getBearerToken(authHeader?: string): string {
  const h = (authHeader || "").trim();
  if (!h) return "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return (m?.[1] || "").trim();
}

type BlueprintOpenInterviewBody = {
  employeeId?: string;
  interviewStartDateTime?: string;
  interviewEndDateTime?: string;
};

type BlueprintGetReportBody = {
  employeeId?: string;
  interviewConfigId?: string;
  candidateId?: string;
};

@Controller("api/interviewx")
export class InterviewXController {
  constructor(
    private readonly orgAuth: OrgAuthService,
    private readonly service: InterviewXService,
  ) {}

  /**
   * Blueprint Manager one-click flow:
   * - Server looks up the employee + their active prep role in Blueprint DB
   * - Creates InterviewX AI interview config + candidate (no manual forms)
   * - Returns the generated credentials so Blueprint UI can display them
   */
  @Post("blueprint-open-ai-interview")
  async blueprintOpenAiInterview(
    @Headers("authorization") authorization?: string,
    @Body() body?: BlueprintOpenInterviewBody,
  ) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");

    const me = this.orgAuth.verifyToken(token);
    const isManagerOrHr =
      me?.accountType === "EMPLOYEE" &&
      (me?.currentRole === "MANAGER" || me?.currentRole === "HR");
    if (!isManagerOrHr) throw new UnauthorizedException("Only managers or HR can open interviews");

    const employeeId = String(body?.employeeId || "").trim();
    if (!employeeId) throw new BadRequestException("Missing employeeId");

    const interviewStartDateTime = body?.interviewStartDateTime ? String(body.interviewStartDateTime).trim() : undefined;
    const interviewEndDateTime = body?.interviewEndDateTime ? String(body.interviewEndDateTime).trim() : undefined;

    return this.service.createInterviewXForEmployee({ me, employeeId, interviewStartDateTime, interviewEndDateTime });
  }

  @Post("blueprint-get-interview-report")
  async blueprintGetInterviewReport(
    @Headers("authorization") authorization?: string,
    @Body() body?: BlueprintGetReportBody,
  ) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");

    const me = this.orgAuth.verifyToken(token);
    const isManagerOrHr =
      me?.accountType === "EMPLOYEE" &&
      (me?.currentRole === "MANAGER" || me?.currentRole === "HR");
    if (!isManagerOrHr) throw new UnauthorizedException("Only managers or HR can view reports");

    const interviewConfigId = String(body?.interviewConfigId || "").trim();
    const candidateId = String(body?.candidateId || "").trim();
    if (!interviewConfigId) throw new BadRequestException("Missing interviewConfigId");

    return this.service.getInterviewXReportForCandidate({ interviewConfigId, candidateId });
  }

  @Get("manager-analytics")
  async managerAnalytics(@Headers("authorization") authorization?: string) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");

    const me = this.orgAuth.verifyToken(token);
    const isManagerOrHr =
      me?.accountType === "EMPLOYEE" &&
      (me?.currentRole === "MANAGER" || me?.currentRole === "HR");
    if (!isManagerOrHr) throw new UnauthorizedException("Only managers or HR can view analytics");

    return this.service.getManagerAnalytics(me);
  }

  @Get("blueprint-latest-credentials")
  async blueprintLatestCredentials(
    @Headers("authorization") authorization?: string,
    @Query("employeeId") employeeIdQ?: string,
  ) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");

    const me = this.orgAuth.verifyToken(token);
    const isManagerOrHr =
      me?.accountType === "EMPLOYEE" &&
      (me?.currentRole === "MANAGER" || me?.currentRole === "HR");
    if (!isManagerOrHr) throw new UnauthorizedException("Only managers or HR can view credentials");

    const employeeId = String(employeeIdQ || "").trim();
    if (!employeeId) throw new BadRequestException("Missing employeeId");

    return this.service.getLatestCredentialsForEmployee({ me, employeeId });
  }
}

