import { Body, Controller, Get, Headers, Param, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { OrgAuthService } from "../org-auth/org-auth.service";
import { CreateScheduledInterviewDto, PatchScheduledInterviewDto } from "./scheduled-interview.dto";
import { ScheduledInterviewService } from "./scheduled-interview.service";

function getBearerToken(authHeader?: string): string {
  const h = (authHeader || "").trim();
  if (!h) return "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return (m?.[1] || "").trim();
}

@Controller("api/org-auth/scheduled-interviews")
export class ScheduledInterviewController {
  constructor(
    private readonly service: ScheduledInterviewService,
    private readonly orgAuth: OrgAuthService,
  ) {}

  @Get()
  async list(@Headers("authorization") authorization?: string) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.orgAuth.verifyToken(token);
    return this.service.list(me);
  }

  /** Latest interview snapshot per employee under manager/HR scope. */
  @Get("summary-by-employee")
  async summary(@Headers("authorization") authorization?: string) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.orgAuth.verifyToken(token);
    return this.service.summaryByEmployee(me);
  }

  @Post()
  async create(@Headers("authorization") authorization?: string, @Body() body?: CreateScheduledInterviewDto) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.orgAuth.verifyToken(token);
    return this.service.create(me, body as CreateScheduledInterviewDto);
  }

  @Patch(":id")
  async patch(
    @Param("id") id: string,
    @Headers("authorization") authorization?: string,
    @Body() body?: PatchScheduledInterviewDto,
  ) {
    const token = getBearerToken(authorization);
    if (!token) throw new UnauthorizedException("Missing token");
    const me = this.orgAuth.verifyToken(token);
    return this.service.patch(me, id, body as PatchScheduledInterviewDto);
  }
}
