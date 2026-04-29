/**
 * Deep-link to InterviewX AI interview flow from Blueprint Manager.
 * Set NEXT_PUBLIC_INTERVIEWX_ORIGIN (e.g. http://localhost:3300).
 */

function interviewXBase(): string {
  const raw = (
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_INTERVIEWX_ORIGIN ? process.env.NEXT_PUBLIC_INTERVIEWX_ORIGIN : ""
  )
    .trim()
    .replace(/\/$/, "");
  const origin = raw || "http://localhost:3300";
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

export function buildInterviewXAiInterviewUrl(opts: {
  prefillRole?: string;
  candidateEmail?: string;
  candidateName?: string;
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
}): string {
  const base = interviewXBase();
  const autoCreate = Boolean(opts?.autoCreate);
  const interviewId =
    !autoCreate &&
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_INTERVIEWX_INTERVIEW_ID
      ? String(process.env.NEXT_PUBLIC_INTERVIEWX_INTERVIEW_ID).trim()
      : "";

  const email = String(opts?.candidateEmail || "").trim();
  const name = String(opts?.candidateName || "").trim();
  const role = String(opts?.prefillRole || "").trim();
  const department = String(opts?.department || "").trim();
  const employeeId = String(opts?.employeeId || "").trim();

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
    const p = opts?.prepAvgPct;
    if (typeof p === "number" && !Number.isNaN(p)) u.searchParams.set("prepAvg", String(Math.round(p)));
    const s = opts?.latestTestScore;
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
      ? String(process.env.NEXT_PUBLIC_INTERVIEWX_INTERVIEW_ID).trim()
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
  const id = String(interviewConfigId || "").trim();
  if (!id) {
    // Fallback to landing if config id missing.
    return `${base}/industry/ai-interview`;
  }
  return `${base}/industry/ai-interview/${encodeURIComponent(id)}/candidates`;
}
