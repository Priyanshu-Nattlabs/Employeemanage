import { apiUrl } from "@/lib/apiBase";

export type OrgAccountType = "EMPLOYEE" | "ADMIN";
export type OrgCurrentRole = "EMPLOYEE" | "MANAGER" | "HR";

export type OrgUser = {
  id: string;
  email: string;
  fullName: string;
  companyName: string;
  companyDomain: string;
  accountType: OrgAccountType;
  currentRole: OrgCurrentRole;
  designation?: string;
  department?: string;
  employeeId?: string;
  mobileNo?: string;
  reportingManagerEmail?: string;
  /** Manager bulk invite: user must finish profile + new password */
  needsProfileCompletion?: boolean;
  mustChangePassword?: boolean;
};

export type OrgRegisterResponse =
  | { verificationRequired: true; email: string; debugOtp?: string }
  | { token: string; user: OrgUser };

const TOKEN_KEY = "jbv2_org_token";
const USER_KEY = "jbv2_org_user";

/** Manager/HR check tolerant of API casing and legacy payloads missing accountType. */
export function isOrgManagerOrHr(user: OrgUser | Record<string, unknown> | null | undefined): boolean {
  if (!user) return false;
  const role = String((user as any).currentRole ?? "").toUpperCase();
  if (role !== "MANAGER" && role !== "HR") return false;
  const acct = String((user as any).accountType ?? "").toUpperCase();
  return acct === "EMPLOYEE" || !acct;
}

export function getOrgAuthFromStorage(): { token: string; user: OrgUser | null } {
  if (typeof window === "undefined") return { token: "", user: null };
  const token = localStorage.getItem(TOKEN_KEY) || "";
  const raw = localStorage.getItem(USER_KEY) || "";
  if (!raw) return { token, user: null };
  try {
    return { token, user: JSON.parse(raw) as OrgUser };
  } catch {
    return { token, user: null };
  }
}

export function setOrgAuthInStorage(token: string, user: OrgUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("jbv2-org-auth-changed"));
}

export function clearOrgAuthInStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("jbv2-org-auth-changed"));
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), init);
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text) as any;
    } catch {
      throw new Error(text.trim().slice(0, 200) || `Bad response (${res.status})`);
    }
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(Array.isArray(msg) ? msg.join(", ") : String(msg));
  }
  return data as T;
}

export async function orgRegisterEmployee(body: {
  email: string;
  password: string;
  fullName: string;
  designation: string;
  department?: string;
  companyName: string;
  companyDomain?: string;
  employeeId: string;
  currentRole: OrgCurrentRole;
  mobileNo: string;
  reportingManagerEmail: string;
}) {
  return apiJson<OrgRegisterResponse>("/api/org-auth/register/employee", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function orgRegisterAdmin(body: { email: string; password: string; fullName: string; companyName: string; companyDomain?: string }) {
  return apiJson<OrgRegisterResponse>("/api/org-auth/register/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function orgVerifyEmailOtp(body: { email: string; otp: string }) {
  return apiJson<{ token: string; user: OrgUser }>("/api/org-auth/verify-email-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function orgResendEmailOtp(body: { email: string }) {
  return apiJson<{ ok: true; message?: string; debugOtp?: string }>("/api/org-auth/resend-email-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function orgLogin(body: { email: string; password: string }) {
  return apiJson<{ token: string; user: OrgUser }>("/api/org-auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

/** Manager/HR login: send password-reset OTP to the given email (no-op message if not a Manager/HR account). */
export async function orgRequestManagerHrPasswordResetOtp(body: { email: string }) {
  return apiJson<{ ok: true; message?: string }>("/api/org-auth/forgot-password/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Manager/HR login: verify OTP and set new password; returns a normal login session. */
export async function orgConfirmManagerHrPasswordReset(body: { email: string; otp: string; newPassword: string }) {
  return apiJson<{ token: string; user: OrgUser }>("/api/org-auth/forgot-password/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type OrgBulkInviteResult = {
  ok: true;
  created: number;
  invited: Array<{ email: string; employeeId: string }>;
  errors: Array<{ row: number; email: string; message: string }>;
};

export async function orgManagerBulkInviteEmployees(token: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(apiUrl("/api/org-auth/manager/invite-employees"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text) as any;
    } catch {
      throw new Error(text.trim().slice(0, 200) || `Bad response (${res.status})`);
    }
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(Array.isArray(msg) ? msg.join(", ") : String(msg));
  }
  return data as OrgBulkInviteResult;
}

export async function orgCompleteInvite(
  token: string,
  body: { newPassword: string; fullName?: string; designation: string; mobileNo: string; employeeId?: string },
) {
  return apiJson<{ token: string; user: OrgUser }>("/api/org-auth/me/complete-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export async function orgListEmployees(token: string, companyDomain?: string) {
  const q = companyDomain ? `?companyDomain=${encodeURIComponent(companyDomain)}` : "";
  return apiJson<any[]>(`/api/org-auth/employees${q}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function orgListEmployeesAdmin(token: string) {
  return apiJson<any[]>(`/api/org-auth/admin/employees`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function orgListEmployeesAdminSummary(token: string) {
  return apiJson<any[]>(`/api/org-auth/admin/employees-summary`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function orgListEmployeesManagerSummary(token: string) {
  return apiJson<any[]>(`/api/org-auth/employees-summary`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export type OrgManagerActivity = {
  activityFeed: Array<{
    type: "TEST_PASSED" | "TEST_FAILED" | "SKILL_COMPLETED" | "PREP_STARTED";
    at: string | null;
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    employeeDepartment: string | null;
    roleName?: string | null;
    skillName?: string | null;
    score?: number | null;
  }>;
  dailySeries: Array<{ date: string; count: number; avgScore: number | null; passed: number; failed: number }>;
  topSkills: Array<{ name: string; attempts: number; passRate: number; avgScore: number | null }>;
  roleAggregates: Array<{ name: string; learners: number; avgPct: number }>;
  engagement: { active7d: number; active30d: number; dormant: number; total: number };
};

export async function orgGetEmployeesActivity(token: string) {
  return apiJson<OrgManagerActivity>(`/api/org-auth/employees-activity`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function orgGetMyProfile(token: string) {
  return apiJson<any>(`/api/org-auth/me/profile`, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function orgUpdateMyProfile(token: string, patch: Partial<OrgUser>) {
  return apiJson<any>(`/api/org-auth/me/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch)
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Organization structure + role recommendations
// ──────────────────────────────────────────────────────────────────────────────

export type OrgDepartmentSection = {
  name: string;
  roles: string[];
  description?: string;
};

export type OrgStructure = {
  _id?: string;
  companyDomain: string;
  companyName?: string;
  setupByEmail?: string;
  setupByName?: string;
  departments: OrgDepartmentSection[];
  updatedAt?: string;
} | null;

export type RecommendableRolesResponse = {
  employee: {
    id: string;
    email: string;
    fullName: string;
    department: string | null;
    designation: string | null;
  };
  hasStructure: boolean;
  department: string | null;
  roles: string[];
  allDepartments: OrgDepartmentSection[];
};

export type RoleRecommendationStatus = "PENDING" | "SEEN" | "DISMISSED" | "ACCEPTED";

export type RoleRecommendation = {
  _id: string;
  companyDomain: string;
  recommendedById: string;
  recommendedByEmail: string;
  recommendedByName?: string;
  recommendedByRole?: OrgCurrentRole;
  recommendedToId: string;
  recommendedToEmail: string;
  recommendedToName?: string;
  recommendedToDepartment?: string;
  roleName: string;
  note?: string;
  status: RoleRecommendationStatus;
  seenAt?: string;
  respondedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function orgGetOrgStructure(token: string) {
  return apiJson<OrgStructure>(`/api/org-auth/org-structure`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function orgListPublicDepartments(companyDomain: string) {
  return apiJson<string[]>(
    `/api/org-auth/public/departments?companyDomain=${encodeURIComponent(companyDomain)}`,
  );
}

export async function orgUpsertOrgStructure(token: string, departments: OrgDepartmentSection[]) {
  return apiJson<OrgStructure>(`/api/org-auth/org-structure`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ departments }),
  });
}

export async function orgListRecommendableRoles(token: string, employeeId: string) {
  return apiJson<RecommendableRolesResponse>(
    `/api/org-auth/recommendable-roles?employeeId=${encodeURIComponent(employeeId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function orgCreateRecommendation(token: string, body: { employeeId: string; roleName: string; note?: string }) {
  return apiJson<RoleRecommendation>(`/api/org-auth/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export async function orgListSentRecommendations(token: string) {
  return apiJson<RoleRecommendation[]>(`/api/org-auth/recommendations/sent`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function orgListMyRecommendations(token: string) {
  return apiJson<RoleRecommendation[]>(`/api/org-auth/recommendations/inbox`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function orgUpdateRecommendationStatus(token: string, id: string, status: RoleRecommendationStatus) {
  return apiJson<RoleRecommendation>(`/api/org-auth/recommendations/${encodeURIComponent(id)}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
}

export type ScheduledInterviewEmployeeSummary = {
  id: string;
  status: string;
  scheduledAt?: string | null;
  targetRoleName?: string;
  reportUrl?: string;
};

export async function orgListScheduledInterviews(token: string) {
  return apiJson<any[]>(`/api/org-auth/scheduled-interviews`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function orgScheduledInterviewSummaryByEmployee(token: string) {
  return apiJson<Record<string, ScheduledInterviewEmployeeSummary>>(`/api/org-auth/scheduled-interviews/summary-by-employee`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function orgCreateScheduledInterview(
  token: string,
  body: {
    employeeId: string;
    targetRoleName: string;
    scheduledAt: string;
    durationMinutes?: number;
    location?: string;
    meetingLink?: string;
    notes?: string;
  }
) {
  return apiJson<any>(`/api/org-auth/scheduled-interviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export async function orgPatchScheduledInterview(
  token: string,
  id: string,
  patch: {
    status?: string;
    reportUrl?: string;
  }
) {
  return apiJson<any>(`/api/org-auth/scheduled-interviews/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  });
}

