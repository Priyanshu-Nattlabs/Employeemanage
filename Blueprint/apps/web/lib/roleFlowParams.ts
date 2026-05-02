/**
 * Query params that define the learner's chosen timeline / level / context for a role blueprint.
 * Preserved across test navigation when the URL is stripped (e.g. router.replace without search).
 */
const FLOW_KEYS = [
  "targetDurationMonths",
  "targetStartDate",
  "targetCompletionDate",
  "employeeLevel",
  "industry",
  "education",
  "specialization",
] as const;

export type RoleFlowParamKey = (typeof FLOW_KEYS)[number];

export function roleFlowStorageKey(userId: string, roleName: string): string {
  return `jbv2-role-flow:${userId}:${roleName}`;
}

export function readRoleFlowParams(userId: string, roleName: string): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  try {
    const raw = sessionStorage.getItem(roleFlowStorageKey(userId, roleName));
    return raw ? new URLSearchParams(raw) : new URLSearchParams();
  } catch {
    return new URLSearchParams();
  }
}

export function writeRoleFlowParams(userId: string, roleName: string, params: URLSearchParams): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(roleFlowStorageKey(userId, roleName), params.toString());
  } catch {
    /* quota / private mode */
  }
}

export function pickRoleFlowParams(sp: { get: (key: string) => string | null }): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of FLOW_KEYS) {
    const v = sp.get(k);
    if (v != null && v !== "") p.set(k, v);
  }
  return p;
}

/** Stored values first; current URL overwrites per key so bookmarks / fresh picks win. */
export function mergeRoleFlowParams(userId: string, roleName: string, urlParams: URLSearchParams): URLSearchParams {
  const stored = readRoleFlowParams(userId, roleName);
  const out = new URLSearchParams(stored.toString());
  for (const k of FLOW_KEYS) {
    const v = urlParams.get(k);
    if (v != null && v !== "") out.set(k, v);
  }
  return out;
}

export function flowQueryString(sp: URLSearchParams): string {
  const s = pickRoleFlowParams(sp).toString();
  return s ? `?${s}` : "";
}
