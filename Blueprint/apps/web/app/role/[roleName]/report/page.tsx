"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getApiPrefix } from "@/lib/apiBase";
import { getOrgAuthFromStorage } from "@/lib/orgAuth";

const API = getApiPrefix();

type RoleTestResult = {
  skillName: string;
  testType?: string;
  selectedSkills?: string[];
  score: number | null;
  passed: boolean;
  status: string;
  completedAt: string | null;
  totalQ: number;
  correctQ: number | null;
  attemptNo: number;
  totalAttempts: number;
  isLatest: boolean;
};

function uniq(items: string[]) {
  return Array.from(new Set(items.map((s) => String(s || "").trim()).filter(Boolean)));
}

export default function RoleReportPage() {
  const params = useParams<{ roleName: string }>();
  const roleName = decodeURIComponent(params.roleName);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tests, setTests] = useState<RoleTestResult[]>([]);
  const [prep, setPrep] = useState<any>(null);
  const [roleDoc, setRoleDoc] = useState<any>(null);

  useEffect(() => {
    const uid = getOrgAuthFromStorage()?.user?.id;
    if (!uid) {
      window.location.href = "/auth/employee/login";
      return;
    }
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [tR, pR, rR] = await Promise.all([
          fetch(`${API}/api/skill-test/all-by-role?studentId=${encodeURIComponent(uid)}&roleName=${encodeURIComponent(roleName)}`),
          fetch(`${API}/api/role-preparation/${encodeURIComponent(roleName)}?studentId=${encodeURIComponent(uid)}`),
          fetch(`${API}/api/blueprint/role/${encodeURIComponent(roleName)}`),
        ]);
        setTests(await tR.json().catch(() => []));
        setPrep(await pR.json().catch(() => null));
        setRoleDoc(await rR.json().catch(() => null));
      } catch (e: any) {
        setError(e?.message || "Failed to load report.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [roleName]);

  const latestResults = useMemo(() => {
    return (Array.isArray(tests) ? tests : []).filter((t) => t.isLatest);
  }, [tests]);

  const totalQuestions = useMemo(() => latestResults.reduce((s, t) => s + (t.totalQ || 0), 0), [latestResults]);
  const totalCorrect = useMemo(() => latestResults.reduce((s, t) => s + (t.correctQ || 0), 0), [latestResults]);
  const totalIncorrect = Math.max(0, totalQuestions - totalCorrect);

  const passedSkills = uniq(Array.isArray(prep?.passedKnownSkills) ? prep.passedKnownSkills : []);
  const failedSkills = uniq(Array.isArray(prep?.failedKnownSkills) ? prep.failedKnownSkills : []);
  const testedSkills = useMemo(() => {
    const fromLatest = latestResults.flatMap((t) => {
      if (t.testType === "KNOWN_SKILLS" && Array.isArray(t.selectedSkills) && t.selectedSkills.length) return t.selectedSkills;
      if (t.skillName === "KNOWN_SKILLS_COMBINED") return [];
      return [t.skillName];
    });
    return uniq(fromLatest);
  }, [latestResults]);

  const roleSkillMap = useMemo(() => {
    const m = new Map<string, any>();
    const reqs = Array.isArray(roleDoc?.skillRequirements) ? roleDoc.skillRequirements : [];
    for (const r of reqs) {
      const key = String(r?.skillName || "").trim();
      if (key) m.set(key, r);
    }
    return m;
  }, [roleDoc]);

  const summaryRows = useMemo(() => {
    return testedSkills.map((skill) => {
      const related = latestResults.find((r) =>
        r.skillName === skill || (r.testType === "KNOWN_SKILLS" && (r.selectedSkills || []).includes(skill))
      );
      const score = related?.score ?? null;
      const status = passedSkills.includes(skill) ? "PASSED" : failedSkills.includes(skill) ? "FAILED" : related?.passed ? "PASSED" : "FAILED";
      const meta = roleSkillMap.get(skill);
      return {
        skill,
        score,
        status,
        description:
          String(meta?.description || "").trim() ||
          `Assessment summary for ${skill}: focus on practical implementation, debugging quality, and best-practice usage.`,
      };
    });
  }, [testedSkills, latestResults, passedSkills, failedSkills, roleSkillMap]);

  if (loading) return <div style={wrap}><p style={muted}>Loading report...</p></div>;

  return (
    <div style={wrap}>
      <div style={card}>
        <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 13 }}>
          <Link href={`/role/${encodeURIComponent(roleName)}`} style={link}>← Back to Role</Link>
        </p>
        <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 900, color: "#0f172a" }}>Skill Test Report</h1>
        <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
          Detailed performance report for <b>{roleName}</b>
        </p>
      </div>

      {error ? <div style={err}>{error}</div> : null}

      <div style={statsGrid}>
        <div style={stat("#1d4ed8")}><div style={num}>{totalQuestions}</div><div style={lbl}>Total Questions</div></div>
        <div style={stat("#15803d")}><div style={num}>{totalCorrect}</div><div style={lbl}>Correct</div></div>
        <div style={stat("#b91c1c")}><div style={num}>{totalIncorrect}</div><div style={lbl}>Incorrect</div></div>
        <div style={stat("#6d28d9")}><div style={num}>{summaryRows.length}</div><div style={lbl}>Skills Tested</div></div>
      </div>

      <div style={row2}>
        <div style={panel}>
          <h3 style={h3}>Passed Skills</h3>
          {passedSkills.length ? passedSkills.map((s) => <div key={s} style={pillGreen}>✓ {s}</div>) : <p style={muted}>No passed skills yet.</p>}
        </div>
        <div style={panel}>
          <h3 style={h3}>Failed Skills</h3>
          {failedSkills.length ? failedSkills.map((s) => <div key={s} style={pillRed}>✕ {s}</div>) : <p style={muted}>No failed skills.</p>}
        </div>
      </div>

      <div style={panel}>
        <h3 style={h3}>Skill-wise Detailed Summary</h3>
        {summaryRows.length === 0 ? (
          <p style={muted}>No test attempts found for this role yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {summaryRows.map((r) => (
              <div key={r.skill} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{r.skill}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={r.status === "PASSED" ? badgePass : badgeFail}>{r.status}</span>
                    <span style={badgeScore}>Score: {r.score ?? "N/A"}%</span>
                  </div>
                </div>
                <p style={{ margin: "8px 0 0", color: "#475569", fontSize: 13, lineHeight: 1.6 }}>{r.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { maxWidth: 1100, margin: "18px auto", padding: "0 12px", display: "grid", gap: 12 };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px" };
const panel: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px" };
const statsGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 };
const row2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const num: React.CSSProperties = { fontSize: 28, fontWeight: 900, color: "#0f172a", lineHeight: 1 };
const lbl: React.CSSProperties = { marginTop: 6, fontSize: 12, color: "#64748b", fontWeight: 700 };
const muted: React.CSSProperties = { margin: 0, color: "#64748b", fontSize: 13 };
const h3: React.CSSProperties = { margin: "0 0 8px", color: "#0f172a", fontSize: 16, fontWeight: 900 };
const err: React.CSSProperties = { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 10, padding: "10px 12px", fontSize: 13 };
const link: React.CSSProperties = { color: "#2563eb", textDecoration: "none", fontWeight: 700 };
const pillGreen: React.CSSProperties = { display: "inline-flex", marginRight: 8, marginBottom: 8, background: "#ecfdf5", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700 };
const pillRed: React.CSSProperties = { display: "inline-flex", marginRight: 8, marginBottom: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700 };
const badgePass: React.CSSProperties = { background: "#ecfdf5", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 800 };
const badgeFail: React.CSSProperties = { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 800 };
const badgeScore: React.CSSProperties = { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 800 };
const stat = (accent: string): React.CSSProperties => ({
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "12px 14px",
  borderTop: `3px solid ${accent}`,
});

