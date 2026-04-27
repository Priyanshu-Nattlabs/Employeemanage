import { getApiPrefix } from "@/lib/apiBase";

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
};

export type OrgRegisterResponse = { verificationRequired: true; email: string };

const TOKEN_KEY = "jbv2_org_token";
const USER_KEY = "jbv2_org_user";

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
  const prefix = getApiPrefix();
  const res = await fetch(`${prefix}${path}`, init);
  const text = await res.text();
  const data = text ? (JSON.parse(text) as any) : null;
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
  return apiJson<{ ok: true; message?: string }>("/api/org-auth/resend-email-otp", {
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

