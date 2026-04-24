/**
 * Mirror role-preparation mutations to the SomethingX Java API so the student
 * dashboard (which reads Mongo via SomethingX) stays in sync with JBV2 Nest.
 */

function getSomethingXApiBase(): string {
  if (typeof window === "undefined") return "";
  const fromEnv = process.env.NEXT_PUBLIC_SOMETHINGX_API_URL;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, "");
  // Fallback to Saarthix production domain instead of localhost
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

function jsonHeaders(): HeadersInit {
  const h: Record<string, string> = { "content-type": "application/json" };
  const t = getBearerToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

function bareHeaders(): HeadersInit {
  const h: Record<string, string> = {};
  const t = getBearerToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export async function syncSomethingXStartPreparation(
  roleName: string,
  studentId: string,
  ganttChartData: unknown
): Promise<void> {
  const base = getSomethingXApiBase();
  if (!base) return;
  const enc = encodeURIComponent;
  const url = `${base}/api/role-preparation/start/${enc(roleName)}?studentId=${enc(studentId)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ ganttChartData }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[JBv2] SomethingX sync start failed:", res.status, text);
    }
  } catch (e) {
    console.warn("[JBv2] SomethingX sync start error:", e);
  }
}

export async function syncSomethingXDeletePreparation(
  roleName: string,
  studentId: string
): Promise<void> {
  const base = getSomethingXApiBase();
  if (!base) return;
  const enc = encodeURIComponent;
  const url = `${base}/api/role-preparation/${enc(roleName)}?studentId=${enc(studentId)}`;
  try {
    const res = await fetch(url, { method: "DELETE", headers: bareHeaders() });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[JBv2] SomethingX sync delete failed:", res.status, text);
    }
  } catch (e) {
    console.warn("[JBv2] SomethingX sync delete error:", e);
  }
}

export async function syncSomethingXUpdateSkill(
  roleName: string,
  skillName: string,
  studentId: string,
  completed: boolean
): Promise<void> {
  const base = getSomethingXApiBase();
  if (!base) return;
  const enc = encodeURIComponent;
  const url = `${base}/api/role-preparation/skill/${enc(roleName)}/${enc(skillName)}?studentId=${enc(studentId)}&completed=${completed}`;
  try {
    const res = await fetch(url, { method: "PUT", headers: bareHeaders() });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[JBv2] SomethingX sync skill failed:", res.status, text);
    }
  } catch (e) {
    console.warn("[JBv2] SomethingX sync skill error:", e);
  }
}

export async function syncSomethingXToggleSubtopic(
  roleName: string,
  skillName: string,
  studentId: string,
  month: number,
  topicIndex: number,
  completed: boolean
): Promise<void> {
  const base = getSomethingXApiBase();
  if (!base) return;
  const enc = encodeURIComponent;
  const url = `${base}/api/role-preparation/subtopic/${enc(roleName)}/${enc(skillName)}?studentId=${enc(studentId)}&month=${month}&topicIndex=${topicIndex}&completed=${completed}`;
  try {
    const res = await fetch(url, { method: "PUT", headers: bareHeaders() });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[JBv2] SomethingX sync subtopic failed:", res.status, text);
    }
  } catch (e) {
    console.warn("[JBv2] SomethingX sync subtopic error:", e);
  }
}
