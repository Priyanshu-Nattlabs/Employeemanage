/**
 * InterviewX deep links used by TalentX UI.
 */
export type BuildInterviewXUrlInput = {
  prefillRole?: string;
  candidateName?: string;
  candidateEmail?: string;
};

function clean(v?: string) {
  return String(v || "").trim();
}

function normalizeOrigin(raw: string): string {
  return clean(raw).replace(/\/$/, "");
}

/**
 * Public origin for the InterviewX web app (deep links, “Open InterviewX”, etc.).
 * Order: explicit env → same public site as SaarthiX footer → browser origin on real hosts → local dev default.
 * Next.js inlines `NEXT_PUBLIC_*` at build time; VPS should set `NEXT_PUBLIC_SAARTHIX_URL` or `NEXT_PUBLIC_INTERVIEWX_ORIGIN`.
 */
function interviewXBase(): string {
  const explicit = normalizeOrigin(
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_INTERVIEWX_ORIGIN || "" : ""
  );
  if (explicit) return explicit;

  const fromSaarthix = normalizeOrigin(
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SAARTHIX_URL || "" : ""
  );
  if (fromSaarthix) return fromSaarthix;

  if (typeof window !== "undefined") {
    const { hostname, protocol, port } = window.location;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      const p = port ? `:${port}` : "";
      let o = normalizeOrigin(`${protocol}//${hostname}${p}`);
      // InterviewX is mounted at /interviewx on the public host; path-only fallbacks must include it.
      if (o && !o.endsWith("/interviewx")) o = `${o}/interviewx`;
      return o;
    }
  }

  return "http://localhost:3300/interviewx";
}

/**
 * Generic InterviewX deep-link builder.
 * - If NEXT_PUBLIC_INTERVIEWX_AI_INTERVIEW_URL / NEXT_PUBLIC_INTERVIEWX_URL is set, use legacy hosted URL.
 * - Otherwise use local InterviewX origin routes.
 */
export function buildInterviewXAiInterviewUrl(
  input:
    | (BuildInterviewXUrlInput & {
        department?: string;
        employeeId?: string;
        autoCreate?: boolean;
        prepAvgPct?: number | null;
        latestTestScore?: number | null;
      })
    | BuildInterviewXUrlInput
): string {
  const baseFromEnv =
    clean(typeof process !== "undefined" ? process.env.NEXT_PUBLIC_INTERVIEWX_AI_INTERVIEW_URL : "") ||
    clean(typeof process !== "undefined" ? process.env.NEXT_PUBLIC_INTERVIEWX_URL : "");

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
    url.searchParams.set("interviewType", "technical");
    url.searchParams.set("mode", "technical");
    url.searchParams.set("autoStart", "1");
    url.searchParams.set("start", "1");
    url.searchParams.set("skipForm", "1");
    return url.toString();
  }

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
  // Always open the InterviewX manager landing/dashboard page so all
  // manager entry points in TalentX are consistent.
  return `${base}/industry/ai-interview/dashboard`;
}

/**
 * AI Interview homepage for industry/manager users.
 * Used as the post-login redirect for Manager/HR accounts.
 */
export function buildInterviewXManagerLandingUrl(): string {
  return `${interviewXBase()}/industry/ai-interview`;
}

export function buildInterviewXCandidatesUrl(interviewConfigId: string): string {
  const base = interviewXBase();
  const id = clean(interviewConfigId);
  if (!id) return `${base}/industry/ai-interview`;
  return `${base}/industry/ai-interview/${encodeURIComponent(id)}/candidates`;
}

/**
 * Student InterviewX app: preparation hub (technical / HR / labs).
 * When a role is provided, lands directly on the Technical Round form pre-filled
 * with that role so the user doesn't have to type it in again.
 * Set `NEXT_PUBLIC_INTERVIEWX_ORIGIN` in production.
 */
export function buildInterviewXStudentPrepHomeUrl(opts?: { email?: string; name?: string; role?: string }): string {
  const base = interviewXBase();
  const role = clean(opts?.role);
  // Go straight to the technical form when a role is known; otherwise land on the hub.
  const path = role
    ? `${base}/students/interview-preparation/technical`
    : `${base}/students/interview-preparation`;
  const u = new URL(path);
  const email = clean(opts?.email);
  const name = clean(opts?.name);
  if (email) u.searchParams.set("email", email);
  if (name) u.searchParams.set("name", name);
  if (role) u.searchParams.set("role", role);
  return u.toString();
}
