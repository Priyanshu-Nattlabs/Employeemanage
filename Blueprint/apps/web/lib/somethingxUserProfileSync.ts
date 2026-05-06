/**
 * Pulls the student profile from SomethingX (Java API) and upserts into TalentX (Nest user_profiles).
 * Uses the same JWT stored at SSO handoff (somethingx_auth_token).
 */

import { getApiPrefix } from "./apiBase";

function getSomethingXApiBase(): string {
  if (typeof window === "undefined") return "";
  const fromEnv = process.env.NEXT_PUBLIC_SOMETHINGX_API_URL;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, "");
  const saarthixUrl = process.env.NEXT_PUBLIC_SAARTHIX_URL || "https://saarthix.com";
  return saarthixUrl.replace(/\/$/, "");
}

function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("somethingx_auth_token") ||
    localStorage.getItem("token") ||
    null
  );
}

/** Map SomethingX User JSON to JBV2 user-profile body */
export function mapSomethingXUserToJbv2(user: Record<string, unknown>, jbv2UserId: string): Record<string, string> {
  const edu = [user.course, user.stream, user.year].filter(Boolean).join(" - ");
  const name =
    (typeof user.name === "string" && user.name) ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    "";
  const y = user.expectedGraduationYear ?? user.graduationYear;
  const m = user.expectedGraduationMonth ?? user.graduationMonth;
  return {
    userId: jbv2UserId,
    fullName: name,
    email: typeof user.email === "string" ? user.email : "",
    education: edu || (typeof user.academicBackground === "string" ? user.academicBackground.slice(0, 500) : ""),
    expectedGraduationYear: y != null && String(y).trim() !== "" ? String(y).trim() : "",
    expectedGraduationMonth: m != null && String(m).trim() !== "" ? String(m).trim() : "",
    studentRollNumber:
      user.studentId != null && String(user.studentId).trim() !== "" ? String(user.studentId).trim() : "",
  };
}

async function fetchSomethingXUnifiedProfile(
  sxBase: string,
  token: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${sxBase}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const SYNC_THROTTLE_MS = 45_000;

/**
 * Fetches GET /api/auth/profile from SomethingX and PUTs merged fields to JBV2.
 * Throttled to avoid duplicate calls on React Strict Mode / rapid navigations.
 */
export async function syncSomethingXProfileToJbv2(options?: { force?: boolean }): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const token = getBearerToken();
  const jbv2UserId = localStorage.getItem("jbv2_userId");
  if (!token || !jbv2UserId) return false;

  const now = Date.now();
  if (!options?.force) {
    const last = Number(sessionStorage.getItem("jbv2_sx_profile_sync_ts") || "0");
    if (now - last < SYNC_THROTTLE_MS) return false;
  }

  const sxBase = getSomethingXApiBase();
  if (!sxBase) return false;

  try {
    const res = await fetch(`${sxBase}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const user = (await res.json()) as Record<string, unknown>;
    const sxId = user.id != null ? String(user.id) : "";
    if (!sxId) return false;

    if (sxId !== jbv2UserId) {
      console.warn("[JBv2] SomethingX user id does not match jbv2_userId; skipping sync.");
      return false;
    }

    const unifiedProfile = await fetchSomethingXUnifiedProfile(sxBase, token);
    const body = mapSomethingXUserToJbv2(
      {
        ...user,
        ...(unifiedProfile || {}),
      },
      jbv2UserId
    );
    const api = getApiPrefix();
    const put = await fetch(`${api}/api/user-profile/${encodeURIComponent(jbv2UserId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!put.ok) return false;

    if (body.expectedGraduationYear) localStorage.setItem("jbv2_expectedGraduationYear", body.expectedGraduationYear);
    if (body.expectedGraduationMonth) localStorage.setItem("jbv2_expectedGraduationMonth", body.expectedGraduationMonth);

    localStorage.setItem(
      "somethingx_auth_user",
      JSON.stringify({
        email: body.email || "",
        name: body.fullName || "User",
        userType: (user.userType as string) || "STUDENT",
      })
    );
    sessionStorage.setItem("jbv2_sx_profile_sync_ts", String(now));
    localStorage.setItem("jbv2_profileUpdatedAt", String(now));
    window.dispatchEvent(new CustomEvent("jbv2-profile-synced"));
    return true;
  } catch (e) {
    console.warn("[JBv2] SomethingX profile sync failed:", e);
    return false;
  }
}
