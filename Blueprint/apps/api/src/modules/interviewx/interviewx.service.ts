import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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

    // For managers, Blueprint uses department scoping to prevent leakage.
    // OrgAuthService returns employees + their active prep summaries.
    const scopedDepartment = input.me?.currentRole === "HR" ? undefined : input.me?.department;
    const prepSummary = await this.orgAuth.getEmployeesPrepSummaryForManager(companyDomain, scopedDepartment);
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
    const interviewXFrontendOrigin = this.normalizeOrigin(
      this.config.get<string>("NEXT_PUBLIC_INTERVIEWX_ORIGIN") || "http://localhost:3300",
    );

    if (!interviewXBackendOrigin) throw new BadRequestException("Missing InterviewX backend origin");
    if (!interviewXFrontendOrigin) throw new BadRequestException("Missing InterviewX frontend origin");

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

    const loginLink = String(candidateCreated?.loginLink || "").trim();
    const password = String(candidateCreated?.password || "").trim();
    if (!loginLink || !password) {
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

    return {
      interviewConfigId: String((doc as any).interviewConfigId || ""),
      candidateId: (doc as any).candidateId ? String((doc as any).candidateId) : undefined,
      candidateName: String((doc as any).candidateName || ""),
      candidateEmail: String((doc as any).candidateEmail || ""),
      loginLink: String((doc as any).loginLink || ""),
      password: String((doc as any).password || ""),
      loginUrl: String((doc as any).loginUrl || ""),
      interviewStartDateTime: (doc as any).interviewStartDateTime ? String((doc as any).interviewStartDateTime) : undefined,
      interviewEndDateTime: (doc as any).interviewEndDateTime ? String((doc as any).interviewEndDateTime) : undefined,
    };
  }

  async getInterviewXReportForCandidate(input: { interviewConfigId: string; candidateId?: string }) {
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
}

