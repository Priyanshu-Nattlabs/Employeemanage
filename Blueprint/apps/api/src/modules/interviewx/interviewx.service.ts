import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { OrgAuthService } from "../org-auth/org-auth.service";
import {
  InterviewXEmployeeInterview,
  InterviewXEmployeeInterviewDocument,
} from "../shared/schemas";

type BlueprintMe = {
  companyDomain?: string;
  department?: string;
  industry?: string;
  email?: string;
  accountType?: string;
  currentRole?: string;
};

type InterviewXBlueprintCredentials = {
  interviewConfigId: string;
  candidateId?: string;
  candidateName: string;
  candidateEmail: string;
  loginLink: string; // InterviewX internal path (e.g. /interview/<uuid>)
  password: string;
  loginUrl: string; // full URL based on InterviewX origin
  interviewStartDateTime?: string; // ISO
  interviewEndDateTime?: string; // ISO
};

type CandidateStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED";
type HiringRec = "MUST_HIRE" | "HIRE" | "MAYBE" | "NO_HIRE";
interface IxCandidate {
  id?: string;
  status?: CandidateStatus;
  name?: string;
  email?: string;
  interviewStartedAt?: string;
}

@Injectable()
export class InterviewXService {
  constructor(
    private readonly config: ConfigService,
    private readonly orgAuth: OrgAuthService,
    @InjectModel(InterviewXEmployeeInterview.name)
    private readonly interviewxEmployeeInterviewModel: Model<InterviewXEmployeeInterviewDocument>,
  ) {}

  private readonly guestUserId = "guest-industry-user";

  private normalizeOrigin(raw?: string) {
    const v = (raw || "").trim();
    if (!v) return "";
    return v.endsWith("/") ? v.slice(0, -1) : v;
  }

  private isLocalOrigin(origin: string) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  }

  /** Public InterviewX site origin (no trailing slash). Never localhost in production. */
  private resolveInterviewXFrontendOrigin(): string {
    const candidates = [
      this.config.get<string>("NEXT_PUBLIC_INTERVIEWX_ORIGIN"),
      this.config.get<string>("APP_FRONTEND_URL"),
      this.config.get<string>("NEXT_PUBLIC_SAARTHIX_URL"),
    ]
      .map((v) => this.normalizeOrigin(v))
      .filter(Boolean);
    const origin =
      candidates.find((v) => !this.isLocalOrigin(v)) ||
      candidates[0] ||
      "";
    if (!origin || this.isLocalOrigin(origin)) {
      throw new BadRequestException("Missing valid public InterviewX frontend origin");
    }
    return origin;
  }

  /**
   * Interview path always starts with `/`.
   * Older rows sometimes stored a full URL in `loginLink` or `loginUrl` — strip host so we can re-prefix with the current public origin.
   */
  private interviewPathFromStoredCredentials(loginLink: string, legacyFullLoginUrl?: string): string {
    let path = String(loginLink || "").trim();
    if (path.startsWith("http://") || path.startsWith("https://")) {
      try {
        const u = new URL(path);
        path = `${u.pathname}${u.search}${u.hash}`;
      } catch {
        path = "";
      }
    }
    if (!path) {
      const legacy = String(legacyFullLoginUrl || "").trim();
      if (legacy.startsWith("http://") || legacy.startsWith("https://")) {
        try {
          const u = new URL(legacy);
          path = `${u.pathname}${u.search}${u.hash}`;
        } catch {
          path = "";
        }
      } else if (legacy.startsWith("/")) {
        path = legacy;
      }
    }
    if (!path.startsWith("/")) path = path ? `/${path}` : "/";
    return path;
  }

  private async requestJson<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    const text = await res.text();
    let data: any = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        // keep raw text for error details below
        data = { _raw: text };
      }
    }

    if (!res.ok) {
      const msg = data?.message || data?.error || data?._raw || `HTTP ${res.status}`;
      throw new BadRequestException(typeof msg === "string" ? msg : JSON.stringify(msg));
    }

    return data as T;
  }

  private localNowDateTimeString(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    const sec = pad(d.getSeconds());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}`;
  }

  private addHoursLocalDateTimeString(startLocal: string, hours: number): string {
    const t = Date.parse(startLocal);
    if (Number.isNaN(t)) throw new BadRequestException("Invalid interviewStartDateTime");
    const d = new Date(t + hours * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    const sec = pad(d.getSeconds());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}`;
  }

  private async syncInterviewRecordSnapshot(input: {
    companyDomain: string;
    interviewConfigId: string;
    candidateId?: string;
    candidate?: IxCandidate | null;
    report?: any | null;
  }) {
    const companyDomain = String(input.companyDomain || "").trim().toLowerCase();
    const interviewConfigId = String(input.interviewConfigId || "").trim();
    if (!companyDomain || !interviewConfigId) return;
    const candidateId = String(input.candidateId || input.candidate?.id || "").trim();
    const candidate = input.candidate || null;
    const report = input.report || null;
    const status = String(candidate?.status || "").trim() || undefined;
    const startedAt = String(candidate?.interviewStartedAt || "").trim() || undefined;
    const completedAt =
      status === "COMPLETED" && report?.generatedAt
        ? String(report.generatedAt)
        : status === "COMPLETED" && startedAt
          ? startedAt
          : undefined;

    const latestReportSnapshot = report
      ? {
          id: report?.id || report?._id || undefined,
          candidateId: report?.candidateId || undefined,
          overallReview: report?.overallReview ?? null,
          strengths: Array.isArray(report?.strengths) ? report.strengths : [],
          weaknesses: Array.isArray(report?.weaknesses) ? report.weaknesses : [],
          recommendationReason: report?.recommendationReason ?? null,
        }
      : undefined;

    const query: Record<string, any> = { companyDomain, interviewConfigId };
    if (candidateId) query.candidateId = candidateId;
    await this.interviewxEmployeeInterviewModel
      .updateMany(query, {
        $set: {
          ...(status ? { lastKnownCandidateStatus: status } : {}),
          ...(startedAt ? { interviewAppearedAt: startedAt } : {}),
          ...(completedAt ? { interviewCompletedAt: completedAt } : {}),
          ...(typeof report?.overallScore === "number" ? { latestOverallScore: report.overallScore } : {}),
          ...(report?.hiringRecommendation ? { latestHiringRecommendation: String(report.hiringRecommendation) } : {}),
          ...(report?.generatedAt ? { latestReportGeneratedAt: String(report.generatedAt) } : {}),
          ...(latestReportSnapshot ? { latestReportSnapshot } : {}),
        },
      })
      .exec();
  }

  /**
   * InterviewX uses Java LocalDateTime (no timezone). If we send UTC (`...Z`) it will be
   * interpreted as local wall-clock time and shift the window. So we accept and emit
   * local datetime strings: `YYYY-MM-DDTHH:mm:ss` (no timezone suffix).
   */
  private parseLocalDateTimeOrThrow(label: string, raw?: string): string | undefined {
    if (!raw) return undefined;
    const s = String(raw).trim();
    if (!s) return undefined;

    // Accept `YYYY-MM-DDTHH:mm` from <input type="datetime-local">
    const m1 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.exec(s);
    if (m1) return `${s}:00`;

    // Accept `YYYY-MM-DDTHH:mm:ss`
    const m2 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.exec(s);
    if (m2) return s;

    throw new BadRequestException(`Invalid ${label} (expected local datetime)`);
  }

  async createInterviewXForEmployee(input: {
    me: BlueprintMe;
    employeeId: string;
    interviewStartDateTime?: string;
    interviewEndDateTime?: string;
  }): Promise<InterviewXBlueprintCredentials> {
    const companyDomain = String(input.me?.companyDomain || "").trim();
    if (!companyDomain) throw new BadRequestException("Invalid token: missing companyDomain");

    // Managers: same industry + department as the manager, or employees who list them as reporting manager. HR: full domain.
    const isHr = input.me?.currentRole === "HR";
    const prepSummary = await this.orgAuth.getEmployeesPrepSummaryForManager(
      companyDomain,
      isHr ? undefined : input.me?.department,
      isHr ? undefined : String(input.me?.email || "").trim() || undefined,
      isHr ? undefined : String(input.me?.industry || "").trim() || undefined,
    );
    const match = Array.isArray(prepSummary)
      ? prepSummary.find((x: any) => String(x?.employee?._id || x?.employee?.id || "") === input.employeeId)
      : null;

    if (!match) throw new NotFoundException("Employee not found in your scope");

    const ongoing = Array.isArray(match.ongoing) ? match.ongoing : [];
    const roleName = String(ongoing[0]?.roleName || "").trim();
    if (!roleName) throw new BadRequestException("No active preparation role found for this employee");

    const candidateEmail = String(match.employee?.email || "").trim();
    if (!candidateEmail) throw new BadRequestException("Employee is missing an email");
    const candidateName =
      String(match.employee?.fullName || "").trim() ||
      candidateEmail.split("@")[0] ||
      "Candidate";

    const prepAvgPct = typeof match.avgPct === "number" && !Number.isNaN(match.avgPct) ? match.avgPct : null;
    const latestTestScore =
      match.latestTest && typeof match.latestTest.score === "number" && !Number.isNaN(match.latestTest.score)
        ? match.latestTest.score
        : null;

    // InterviewX endpoints live on the InterviewX backend container port (8180 -> 8080 on the host).
    const interviewXBackendOrigin = this.normalizeOrigin(
      this.config.get<string>("INTERVIEWX_BACKEND_ORIGIN") ||
        this.config.get<string>("NEXT_PUBLIC_INTERVIEWX_ORIGIN") ||
        // When Blueprint API runs inside Docker, `localhost` points to the same container.
        // `host.docker.internal` reaches the host machine where InterviewX is exposed.
        "http://host.docker.internal:8180",
    );
    const interviewXFrontendOrigin = this.resolveInterviewXFrontendOrigin();

    if (!interviewXBackendOrigin) throw new BadRequestException("Missing InterviewX backend origin");

    const startISO =
      this.parseLocalDateTimeOrThrow("interviewStartDateTime", input.interviewStartDateTime) || this.localNowDateTimeString();
    const effectiveEndISO =
      this.parseLocalDateTimeOrThrow("interviewEndDateTime", input.interviewEndDateTime) ||
      this.addHoursLocalDateTimeString(startISO, 1);

    if (Date.parse(effectiveEndISO) <= Date.parse(startISO)) {
      throw new BadRequestException("Interview end time must be after start time");
    }

    const configRequestBody: any = {
      roleName,
      level: "Fresher",
      skills: [],
      interviewType: "VIDEO_PROCTORED",
      experience: "",
      customQuestions: [],
      includeResumeBasedQuestions: false,
      numberOfQuestions: 10,
      interviewStartDateTime: startISO,
      interviewEndDateTime: effectiveEndISO,
      userId: this.guestUserId,
      createdFromCombinedCard: false,
    };

    // Optional (not currently used by InterviewX UI defaults, but kept for future enhancements/debugging)
    if (typeof prepAvgPct === "number") configRequestBody.prepAvg = Math.round(prepAvgPct);
    if (typeof latestTestScore === "number") configRequestBody.skillScore = latestTestScore;

    const configCreated = await this.requestJson<any>(
      `${interviewXBackendOrigin}/api/ai-interview/configs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configRequestBody),
      },
    );

    const interviewConfigId = String(configCreated?.id || configCreated?._id || "").trim();
    if (!interviewConfigId) throw new BadRequestException("Interview config created but no id was returned");

    const candidateCreated = await this.requestJson<any>(
      `${interviewXBackendOrigin}/api/ai-interview/candidates`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewConfigId,
          userId: this.guestUserId,
          name: candidateName,
          email: candidateEmail,
        }),
      },
    );

    const loginLink = this.interviewPathFromStoredCredentials(String(candidateCreated?.loginLink || ""), "");
    const password = String(candidateCreated?.password || "").trim();
    if (!loginLink || loginLink === "/" || !password) {
      throw new BadRequestException("InterviewX returned candidate but credentials are missing");
    }

    const loginUrl = `${interviewXFrontendOrigin}${loginLink}`;

    const creds: InterviewXBlueprintCredentials = {
      interviewConfigId,
      candidateId: candidateCreated?.id ? String(candidateCreated.id) : undefined,
      candidateName,
      candidateEmail,
      loginLink,
      password,
      loginUrl,
      interviewStartDateTime: startISO,
      interviewEndDateTime: effectiveEndISO,
    };

    // Persist latest credentials so manager can view/report even after page refresh.
    await this.interviewxEmployeeInterviewModel.create({
      companyDomain,
      employeeId: input.employeeId,
      interviewConfigId: creds.interviewConfigId,
      candidateId: creds.candidateId,
      candidateName: creds.candidateName,
      candidateEmail: creds.candidateEmail,
      loginLink: creds.loginLink,
      password: creds.password,
      loginUrl: creds.loginUrl,
      interviewStartDateTime: creds.interviewStartDateTime,
      interviewEndDateTime: creds.interviewEndDateTime,
    });

    return creds;
  }

  async getLatestCredentialsForEmployee(input: { me: BlueprintMe; employeeId: string }): Promise<InterviewXBlueprintCredentials> {
    const companyDomain = String(input.me?.companyDomain || "").trim();
    if (!companyDomain) throw new BadRequestException("Invalid token: missing companyDomain");
    const employeeId = String(input.employeeId || "").trim();
    if (!employeeId) throw new BadRequestException("Missing employeeId");

    const doc = await this.interviewxEmployeeInterviewModel
      .findOne({ companyDomain: companyDomain.toLowerCase(), employeeId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    if (!doc) throw new NotFoundException("No InterviewX interview scheduled for this employee yet");

    const origin = this.resolveInterviewXFrontendOrigin();
    const rel = this.interviewPathFromStoredCredentials(
      String((doc as any).loginLink || ""),
      String((doc as any).loginUrl || ""),
    );

    return {
      interviewConfigId: String((doc as any).interviewConfigId || ""),
      candidateId: (doc as any).candidateId ? String((doc as any).candidateId) : undefined,
      candidateName: String((doc as any).candidateName || ""),
      candidateEmail: String((doc as any).candidateEmail || ""),
      loginLink: rel,
      password: String((doc as any).password || ""),
      loginUrl: `${origin}${rel}`,
      interviewStartDateTime: (doc as any).interviewStartDateTime ? String((doc as any).interviewStartDateTime) : undefined,
      interviewEndDateTime: (doc as any).interviewEndDateTime ? String((doc as any).interviewEndDateTime) : undefined,
    };
  }

  async getManagerAnalytics(me: BlueprintMe) {
    const companyDomain = String(me?.companyDomain || "").trim().toLowerCase();
    if (!companyDomain) throw new BadRequestException("Invalid token: missing companyDomain");

    const filter: Record<string, any> = { companyDomain };
    if (me?.currentRole === "MANAGER" && me?.department) {
      // Managers see only interviews they scheduled within their dept scope.
      // We don't store department on the interview record, so we rely on the
      // employeeId scoping done at scheduling time – no further filter needed here.
    }

    const allRecords = await this.interviewxEmployeeInterviewModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const interviewXBackendOrigin = this.normalizeOrigin(
      this.config.get<string>("INTERVIEWX_BACKEND_ORIGIN") ||
        this.config.get<string>("NEXT_PUBLIC_INTERVIEWX_ORIGIN") ||
        "http://host.docker.internal:8180",
    );

    const uniqueConfigIds = Array.from(new Set(allRecords.map((r: any) => String(r.interviewConfigId || "")).filter(Boolean)));

    const candidatesByConfig = new Map<string, IxCandidate[]>();
    await Promise.allSettled(
      uniqueConfigIds.map(async (configId) => {
        try {
          const res = await this.requestJson<IxCandidate[]>(
            `${interviewXBackendOrigin}/api/ai-interview/candidates?interviewConfigId=${encodeURIComponent(configId)}&userId=${encodeURIComponent(this.guestUserId)}`,
            { method: "GET" },
          );
          candidatesByConfig.set(configId, Array.isArray(res) ? res : []);
        } catch {
          candidatesByConfig.set(configId, []);
        }
      }),
    );

    const reportsByConfig = new Map<string, Array<{ candidateId?: string; overallScore?: number; hiringRecommendation?: HiringRec }>>();
    await Promise.allSettled(
      uniqueConfigIds.map(async (configId) => {
        const candidates = candidatesByConfig.get(configId) ?? [];
        const hasCompleted = candidates.some((c) => c.status === "COMPLETED");
        if (!hasCompleted) { reportsByConfig.set(configId, []); return; }
        try {
          const res = await this.requestJson<any[]>(
            `${interviewXBackendOrigin}/api/ai-interview/reports/config/${encodeURIComponent(configId)}?userId=${encodeURIComponent(this.guestUserId)}`,
            { method: "GET" },
          );
          reportsByConfig.set(configId, Array.isArray(res) ? res : []);
        } catch {
          reportsByConfig.set(configId, []);
        }
      }),
    );

    let totalScheduled = 0;
    let totalPending = 0;
    let totalAppeared = 0;
    let totalCompleted = 0;
    let totalExpired = 0;
    const hiringBreakdown: Record<string, number> = { MUST_HIRE: 0, HIRE: 0, MAYBE: 0, NO_HIRE: 0 };

    for (const configId of uniqueConfigIds) {
      const candidates = candidatesByConfig.get(configId) ?? [];
      if (candidates.length === 0) {
        // At minimum count it as one scheduled (from our Blueprint record)
        totalScheduled += 1;
        totalPending += 1;
        continue;
      }
      totalScheduled += candidates.length;
      for (const c of candidates) {
        if (c.status === "PENDING") totalPending++;
        else if (c.status === "IN_PROGRESS") totalAppeared++;
        else if (c.status === "COMPLETED") { totalCompleted++; totalAppeared++; }
        else if (c.status === "EXPIRED") totalExpired++;
        else totalPending++;
      }
      const reports = reportsByConfig.get(configId) ?? [];
      for (const r of reports) {
        const rec = String(r?.hiringRecommendation || "").toUpperCase();
        if (rec === "MUST_HIRE" || rec === "HIRE" || rec === "MAYBE" || rec === "NO_HIRE") {
          hiringBreakdown[rec] = (hiringBreakdown[rec] || 0) + 1;
        }
      }

      // Persist latest conducted status/report summary for audit/history.
      for (const c of candidates) {
        const rep =
          c.id && reports.length
            ? (reports.find((r: any) => String(r?.candidateId || "") === String(c.id || "")) ?? null)
            : reports[0] ?? null;
        await this.syncInterviewRecordSnapshot({
          companyDomain,
          interviewConfigId: configId,
          candidateId: c.id,
          candidate: c,
          report: rep,
        });
      }
    }

    const passed = hiringBreakdown.MUST_HIRE + hiringBreakdown.HIRE;
    const failed = hiringBreakdown.NO_HIRE;
    const maybe = hiringBreakdown.MAYBE;

    // Monthly trend – use stored interviewStartDateTime from Blueprint records
    const monthCountMap = new Map<string, number>();
    const monthOrder: string[] = [];
    const monthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthCountMap.set(key, 0);
      monthOrder.push(key);
    }
    for (const rec of allRecords) {
      const raw = String((rec as any).interviewStartDateTime || "");
      if (!raw) continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthCountMap.has(key)) monthCountMap.set(key, (monthCountMap.get(key) ?? 0) + 1);
    }
    const monthlyTrend = monthOrder.map((key) => {
      const [, m] = key.split("-");
      return { month: monthLabels[parseInt(m, 10) - 1], key, count: monthCountMap.get(key) ?? 0 };
    });

    // Recent interviews list (up to 10)
    const recentInterviews = allRecords.slice(0, 10).map((rec: any) => {
      const configId = String(rec.interviewConfigId || "");
      const candidates = candidatesByConfig.get(configId) ?? [];
      const candidateMatch = candidates.find((c) => c.email === String(rec.candidateEmail || "").toLowerCase()) ?? candidates[0];
      const reports = reportsByConfig.get(configId) ?? [];
      const report = candidateMatch?.id
        ? (reports.find((r: any) => String(r.candidateId || "") === String(candidateMatch.id || "")) ?? reports[0])
        : reports[0];
      return {
        candidateName: String(rec.candidateName || ""),
        candidateEmail: String(rec.candidateEmail || ""),
        interviewConfigId: configId,
        candidateId: String(rec.candidateId || ""),
        status: candidateMatch?.status ?? "PENDING",
        scheduledAt: String(rec.interviewStartDateTime || ""),
        score: report?.overallScore ?? null,
        hiringRecommendation: report?.hiringRecommendation ?? null,
      };
    });

    return {
      totals: { scheduled: totalScheduled, pending: totalPending, appeared: totalAppeared, completed: totalCompleted, passed, failed, maybe, expired: totalExpired },
      hiringBreakdown,
      monthlyTrend,
      recentInterviews,
    };
  }

  async getInterviewXReportForCandidate(input: { me: BlueprintMe; interviewConfigId: string; candidateId?: string }) {
    const companyDomain = String(input.me?.companyDomain || "").trim().toLowerCase();
    if (!companyDomain) throw new BadRequestException("Invalid token: missing companyDomain");
    const interviewConfigId = String(input.interviewConfigId || "").trim();
    const candidateId = String(input.candidateId || "").trim();
    if (!interviewConfigId) throw new BadRequestException("Missing interviewConfigId");

    const interviewXBackendOrigin = this.normalizeOrigin(
      this.config.get<string>("INTERVIEWX_BACKEND_ORIGIN") ||
        this.config.get<string>("NEXT_PUBLIC_INTERVIEWX_ORIGIN") ||
        "http://host.docker.internal:8180",
    );

    const reports = await this.requestJson<any[]>(
      `${interviewXBackendOrigin}/api/ai-interview/reports/config/${encodeURIComponent(interviewConfigId)}?userId=${encodeURIComponent(
        this.guestUserId,
      )}`,
      { method: "GET", headers: {} },
    );

    const list = Array.isArray(reports) ? reports : [];
    if (!list.length) {
      return { ready: false, message: "Report not generated yet" };
    }

    // If candidateId is missing, return first report (best-effort) — but UI should pass candidateId.
    const matched =
      (candidateId ? list.find((r) => String(r?.candidateId || "").trim() === candidateId) : undefined) ||
      list[0];

    if (!matched) return { ready: false, message: "Report not found" };

    let matchedCandidate: IxCandidate | null = null;
    try {
      const candidates = await this.requestJson<IxCandidate[]>(
        `${interviewXBackendOrigin}/api/ai-interview/candidates?interviewConfigId=${encodeURIComponent(interviewConfigId)}&userId=${encodeURIComponent(this.guestUserId)}`,
        { method: "GET", headers: {} },
      );
      const candidateList = Array.isArray(candidates) ? candidates : [];
      matchedCandidate =
        (candidateId
          ? candidateList.find((c) => String(c?.id || "").trim() === candidateId)
          : undefined) ||
        candidateList[0] ||
        null;
    } catch {
      matchedCandidate = null;
    }

    await this.syncInterviewRecordSnapshot({
      companyDomain,
      interviewConfigId,
      candidateId: String(matched?.candidateId || candidateId || "").trim() || undefined,
      candidate: matchedCandidate,
      report: matched,
    });

    const detailed = {
      id: String(matched.id || matched._id || ""),
      candidateId: String(matched.candidateId || ""),
      interviewConfigId: String(matched.interviewConfigId || interviewConfigId),
      overallScore: matched.overallScore ?? null,
      hiringRecommendation: matched.hiringRecommendation ?? null,
      overallReview: matched.overallReview ?? null,
      strengths: Array.isArray(matched.strengths) ? matched.strengths : [],
      weaknesses: Array.isArray(matched.weaknesses) ? matched.weaknesses : [],
      recommendationReason: matched.recommendationReason ?? null,
      generatedAt: matched.generatedAt ?? null,
      overallRubricScores:
        matched.overallRubricScores && typeof matched.overallRubricScores === "object" ? matched.overallRubricScores : {},
      questionAnalyses: Array.isArray(matched.questionAnalyses)
        ? matched.questionAnalyses.map((qa: any) => ({
            question: qa?.question ?? null,
            answer: qa?.answer ?? null,
            analysis: qa?.analysis ?? null,
            questionType: qa?.questionType ?? null,
            rating: typeof qa?.rating === "number" ? qa.rating : null,
            ratingCategory: qa?.ratingCategory ?? null,
            rubricScores: qa?.rubricScores && typeof qa.rubricScores === "object" ? qa.rubricScores : {},
          }))
        : [],
      proctoringSummary: matched.proctoringSummary
        ? {
            totalViolations:
              typeof matched.proctoringSummary?.totalViolations === "number"
                ? matched.proctoringSummary.totalViolations
                : null,
            violationTypes: Array.isArray(matched.proctoringSummary?.violationTypes)
              ? matched.proctoringSummary.violationTypes
              : [],
            violationSummary: matched.proctoringSummary?.violationSummary ?? null,
            hasSeriousViolations:
              typeof matched.proctoringSummary?.hasSeriousViolations === "boolean"
                ? matched.proctoringSummary.hasSeriousViolations
                : null,
          }
        : null,
    };

    return {
      ready: true,
      report: {
        id: detailed.id,
        candidateId: detailed.candidateId,
        overallScore: detailed.overallScore,
        hiringRecommendation: detailed.hiringRecommendation,
        overallReview: detailed.overallReview,
        strengths: detailed.strengths,
        weaknesses: detailed.weaknesses,
        recommendationReason: detailed.recommendationReason,
        generatedAt: detailed.generatedAt,
      },
      detailedReport: detailed,
    };
  }

  /**
   * Employee hub: sanitized InterviewX prep sessions + reports for the org JWT email.
   * InterviewX must allow the call via {@code BLUEPRINT_INTERVIEWX_TRACKING_KEY} (same value on both sides).
   */
  async getMeInterviewPrepTracking(me: {
    email?: string;
    accountType?: string;
    currentRole?: string;
  }): Promise<{
    trackingEnabled: boolean;
    sessions: Array<Record<string, unknown>>;
    reports: Array<Record<string, unknown>>;
  }> {
    if (me?.accountType !== "EMPLOYEE" || me?.currentRole !== "EMPLOYEE") {
      throw new UnauthorizedException("Only employees can view interview preparation tracking");
    }
    const email = String(me?.email || "").trim().toLowerCase();
    if (!email) throw new BadRequestException("Missing email in token");

    const key = String(this.config.get<string>("BLUEPRINT_INTERVIEWX_TRACKING_KEY") || "").trim();
    if (!key) {
      return { trackingEnabled: false, sessions: [], reports: [] };
    }

    const interviewXBackendOrigin = this.normalizeOrigin(
      this.config.get<string>("INTERVIEWX_BACKEND_ORIGIN") ||
        this.config.get<string>("NEXT_PUBLIC_INTERVIEWX_ORIGIN") ||
        "http://host.docker.internal:8180",
    );

    const url = `${interviewXBackendOrigin}/api/interview-preparation/internal/blueprint-tracking?email=${encodeURIComponent(email)}`;
    try {
      const data = await this.requestJson<any>(url, {
        method: "GET",
        headers: { "X-Blueprint-Tracking-Key": key },
      });
      return {
        trackingEnabled: Boolean(data?.trackingEnabled),
        sessions: Array.isArray(data?.sessions) ? data.sessions : [],
        reports: Array.isArray(data?.reports) ? data.reports : [],
      };
    } catch {
      return { trackingEnabled: true, sessions: [], reports: [] };
    }
  }
}

