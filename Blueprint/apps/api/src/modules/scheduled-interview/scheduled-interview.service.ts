import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { OrgAuthService } from "../org-auth/org-auth.service";
import { ScheduledInterview } from "../shared/schemas";
import type { CreateScheduledInterviewDto, PatchScheduledInterviewDto } from "./scheduled-interview.dto";

function normalizeDomain(domain: string): string {
  return (domain || "").trim().toLowerCase().replace(/^@/, "");
}

@Injectable()
export class ScheduledInterviewService {
  constructor(
    @InjectModel(ScheduledInterview.name) private readonly model: Model<ScheduledInterview>,
    private readonly orgAuth: OrgAuthService,
  ) {}

  private assertManagerOrHr(me: any) {
    const ok =
      me?.accountType === "EMPLOYEE" && (me?.currentRole === "MANAGER" || me?.currentRole === "HR");
    if (!ok) throw new UnauthorizedException("Only managers or HR can manage interviews");
  }

  private async getScopedEmployeeIds(me: any): Promise<{ domain: string; ids: Set<string> }> {
    this.assertManagerOrHr(me);
    const domain = normalizeDomain(me.companyDomain || "");
    if (!domain) throw new BadRequestException("Missing company domain");

    const isHR = me?.currentRole === "HR";
    let department: string | undefined = undefined;
    if (!isHR) {
      const profile = await this.orgAuth.getProfileById(me?.sub);
      const d = String((profile as any)?.department || "").trim();
      if (!d) return { domain, ids: new Set() };
      department = d;
    }

    const roster = await this.orgAuth.getEmployeesForManager(domain, department);
    const ids = new Set<string>();
    for (const e of roster as any[]) {
      const id = String(e._id || e.id || "");
      if (id) ids.add(id);
    }
    return { domain, ids };
  }

  private async assertEmployeeInScope(me: any, employeeId: string) {
    const { ids } = await this.getScopedEmployeeIds(me);
    if (!ids.has(String(employeeId))) throw new NotFoundException("Employee not found in your scope");
  }

  async list(me: any) {
    const { domain, ids } = await this.getScopedEmployeeIds(me);
    if (!ids.size) return [];
    return this.model
      .find({ companyDomain: domain, employeeId: { $in: [...ids] } })
      .sort({ scheduledAt: -1 })
      .lean()
      .exec();
  }

  /** Latest scheduled interview per employee (for dashboard column). */
  async summaryByEmployee(me: any): Promise<
    Record<
      string,
      {
        id: string;
        status: string;
        targetRoleName: string;
        scheduledAt: string | null;
        reportUrl?: string | null;
        employeeName?: string;
        employeeEmail?: string;
      }
    >
  > {
    const { domain, ids } = await this.getScopedEmployeeIds(me);
    const out: Record<string, any> = {};
    if (!ids.size) return out;

    const rows = await this.model
      .find({ companyDomain: domain, employeeId: { $in: [...ids] } })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    for (const r of rows as any[]) {
      const eid = String(r.employeeId || "");
      if (!eid || out[eid]) continue;
      out[eid] = {
        id: String(r._id),
        status: r.status,
        targetRoleName: r.targetRoleName,
        scheduledAt: r.scheduledAt ? new Date(r.scheduledAt).toISOString() : null,
        reportUrl: r.reportUrl ?? null,
        employeeName: r.employeeName,
        employeeEmail: r.employeeEmail,
      };
    }
    return out;
  }

  async create(me: any, dto: CreateScheduledInterviewDto) {
    await this.assertEmployeeInScope(me, dto.employeeId);
    const { domain } = await this.getScopedEmployeeIds(me);
    const emp = await this.orgAuth.getProfileById(dto.employeeId);
    if (!emp || normalizeDomain((emp as any).companyDomain || "") !== domain) {
      throw new NotFoundException("Employee not found");
    }
    const tr = String(dto.targetRoleName || "").trim();
    if (!tr) throw new BadRequestException("targetRoleName is required");

    const when = new Date(dto.scheduledAt);
    if (Number.isNaN(when.getTime())) throw new BadRequestException("Invalid scheduledAt");

    const doc = await this.model.create({
      companyDomain: domain,
      employeeId: String(dto.employeeId),
      employeeEmail: String((emp as any).email || "").toLowerCase(),
      employeeName: (emp as any).fullName,
      employeeDepartment: (emp as any).department,
      targetRoleName: tr,
      scheduledAt: when,
      durationMinutes: dto.durationMinutes,
      location: dto.location,
      meetingLink: dto.meetingLink,
      notes: dto.notes,
      status: "SCHEDULED",
      scheduledById: String(me.sub),
      scheduledByEmail: String(me.email || "").toLowerCase(),
    });
    return doc.toObject();
  }

  async patch(me: any, id: string, dto: PatchScheduledInterviewDto) {
    const { domain, ids } = await this.getScopedEmployeeIds(me);
    const doc = await this.model.findById(id).exec();
    if (!doc || doc.companyDomain !== domain) throw new NotFoundException();
    if (!ids.has(String(doc.employeeId))) throw new ForbiddenException();

    if (dto.status != null) doc.status = dto.status;
    if (dto.reportUrl !== undefined) doc.reportUrl = dto.reportUrl?.trim() || undefined;
    if (dto.scheduledAt) {
      const when = new Date(dto.scheduledAt);
      if (Number.isNaN(when.getTime())) throw new BadRequestException("Invalid scheduledAt");
      doc.scheduledAt = when;
    }
    if (dto.durationMinutes != null) doc.durationMinutes = dto.durationMinutes;
    if (dto.location !== undefined) doc.location = dto.location;
    if (dto.meetingLink !== undefined) doc.meetingLink = dto.meetingLink;
    if (dto.notes !== undefined) doc.notes = dto.notes;

    await doc.save();
    return doc.toObject();
  }
}
