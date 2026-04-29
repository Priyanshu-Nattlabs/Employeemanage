/**
 * InterviewX deep links used by Blueprint Manager UI.
 *
 * - Preferred (local/dev + current integration): NEXT_PUBLIC_INTERVIEWX_ORIGIN (e.g. http://localhost:3300)
 * - Legacy hosted deep-link (kept for compatibility): NEXT_PUBLIC_INTERVIEWX_AI_INTERVIEW_URL / NEXT_PUBLIC_INTERVIEWX_URL
 */

export type BuildInterviewXUrlInput = {
  prefillRole?: string;
  candidateName?: string;
  candidateEmail?: string;
};

function clean(v?: string) {
  return String(v || "").trim();
}

function interviewXBase(): string {
  const raw = clean(
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_INTERVIEWX_ORIGIN ? process.env.NEXT_PUBLIC_INTERVIEWX_ORIGIN : "",
  ).replace(/\/$/, "");
  const origin = raw || "http://localhost:3300";
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

/**
 * Deep-link to InterviewX AI interview flow.
 *
 * If NEXT_PUBLIC_INTERVIEWX_AI_INTERVIEW_URL (or NEXT_PUBLIC_INTERVIEWX_URL) is set, we build the legacy hosted URL with query params.
 * Otherwise, we build the current InterviewX industry route URL using NEXT_PUBLIC_INTERVIEWX_ORIGIN.
 */
export function buildInterviewXAiInterviewUrl(
  input:
    | (BuildInterviewXUrlInput & {
        department?: string;
        /** Blueprint employee id (for traceability in URL; InterviewX may display or log). */
        employeeId?: string;
        /**
         * When true, InterviewX creates the interview + candidate in one step (no form).
         * Forces a new interview for the prep role; ignores NEXT_PUBLIC_INTERVIEWX_INTERVIEW_ID.
         */
        autoCreate?: boolean;
        /** Optional prep summary for the interview record (0–100). */
        prepAvgPct?: number | null;
        /** Optional latest skill test score for context. */
        latestTestScore?: number | null;
      })
    | BuildInterviewXUrlInput,
): string {
  const baseFromEnv =
    clean(process.env.NEXT_PUBLIC_INTERVIEWX_AI_INTERVIEW_URL) || clean(process.env.NEXT_PUBLIC_INTERVIEWX_URL);

  // Legacy hosted builder (restored snippet behavior)
  if (baseFromEnv) {
    const url = new URL(baseFromEnv);
    const role = clean((input as any)?.prefillRole);
    const candidateName = clean((input as any)?.candidateName);
    const candidateEmail = clean((input as any)?.candidateEmail);

    if (role) {
      url.searchParams.set("role", role);
      url.searchParams.set("targetRole", role);
    }
    if (candidateName) {
      url.searchParams.set("candidateName", candidateName);
      url.searchParams.set("name", candidateName);
    }
    if (candidateEmail) {
      url.searchParams.set("candidateEmail", candidateEmail);
      url.searchParams.set("email", candidateEmail);
    }

    // Force technical interview and skip pre-start form where supported.
    url.searchParams.set("interviewType", "technical");
    url.searchParams.set("mode", "technical");
    url.searchParams.set("autoStart", "1");
    url.searchParams.set("start", "1");
    url.searchParams.set("skipForm", "1");
    return url.toString();
  }

  // Current (origin-based) builder
  const base = interviewXBase();
  const autoCreate = Boolean((input as any)?.autoCreate);
  const interviewId =
    !autoCreate && typeof process !== "undefined" && process.env.NEXT_PUBLIC_INTERVIEWX_INTERVIEW_ID
      ? clean(process.env.NEXT_PUBLIC_INTERVIEWX_INTERVIEW_ID)
      : "";

  const email = clean((input as any)?.candidateEmail);
  const name = clean((input as any)?.candidateName);
  const role = clean((input as any)?.prefillRole);
  const department = clean((input as any)?.department);
  const employeeId = clean((input as any)?.employeeId);

  if (interviewId) {
    const u = new URL(`${base}/industry/ai-interview/${encodeURIComponent(interviewId)}/candidates`);
    u.searchParams.set("add", "1");
    u.searchParams.set("from", "blueprint");
    if (email) u.searchParams.set("email", email);
    if (name) u.searchParams.set("name", name);
    if (role) u.searchParams.set("role", role);
    if (department) u.searchParams.set("department", department);
    if (employeeId) u.searchParams.set("eid", employeeId);
    return u.toString();
  }

  const u = new URL(`${base}/industry/ai-interview`);
  if (autoCreate) {
    u.searchParams.set("from", "blueprint");
    u.searchParams.set("autoCreate", "1");
    if (role) u.searchParams.set("role", role);
    if (email) u.searchParams.set("email", email);
    if (name) u.searchParams.set("name", name);
    if (department) u.searchParams.set("department", department);
    if (employeeId) u.searchParams.set("eid", employeeId);
    const p = (input as any)?.prepAvgPct;
    if (typeof p === "number" && !Number.isNaN(p)) u.searchParams.set("prepAvg", String(Math.round(p)));
    const s = (input as any)?.latestTestScore;
    if (typeof s === "number" && !Number.isNaN(s)) u.searchParams.set("skillScore", String(s));
    return u.toString();
  }

  u.searchParams.set("type", "interview");
  u.searchParams.set("from", "blueprint");
  if (role) u.searchParams.set("role", role);
  if (email) u.searchParams.set("email", email);
  if (name) u.searchParams.set("name", name);
  if (department) u.searchParams.set("department", department);
  if (employeeId) u.searchParams.set("eid", employeeId);
  return u.toString();
}

export function buildInterviewXIndustryOpenUrl(): string {
  const base = interviewXBase();
  const interviewId =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_INTERVIEWX_INTERVIEW_ID
      ? clean(process.env.NEXT_PUBLIC_INTERVIEWX_INTERVIEW_ID)
      : "";

  if (interviewId) {
    return `${base}/industry/ai-interview/${encodeURIComponent(interviewId)}/candidates`;
  }

  const u = new URL(`${base}/industry/ai-interview`);
  u.searchParams.set("type", "interview");
  return u.toString();
}

export function buildInterviewXCandidatesUrl(interviewConfigId: string): string {
  const base = interviewXBase();
  const id = clean(interviewConfigId);
  if (!id) return `${base}/industry/ai-interview`;
  return `${base}/industry/ai-interview/${encodeURIComponent(id)}/candidates`;
}
