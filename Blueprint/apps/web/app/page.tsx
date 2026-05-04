"use client";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { appPath, getApiPrefix, publicAssetUrl } from "@/lib/apiBase";
import { getOrgAuthFromStorage, isOrgManagerOrHr } from "@/lib/orgAuth";
import { SiteFooter } from "@/app/components/SiteFooter";
import { PublicHomePage } from "@/app/components/PublicHomePage";

function normalizeSearch(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Small Levenshtein distance for typo-tolerant matching. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const row = new Uint16Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n];
}

function isSubsequence(q: string, r: string): boolean {
  let i = 0;
  for (let j = 0; j < r.length && i < q.length; j++) {
    if (r[j] === q[i]) i++;
  }
  return i === q.length;
}

function scoreRoleMatch(role: string, rawQ: string): number {
  const r = normalizeSearch(role);
  const q = normalizeSearch(rawQ);
  if (!q.length) return 0;
  if (r === q) return 1_000_000;
  if (r.startsWith(q)) return 500_000 + Math.min(80_000, q.length * 3_000);
  const at = r.indexOf(q);
  if (at >= 0) return 300_000 - at * 50 + Math.min(20_000, q.length * 400);
  const tokens = r.split(/[/\s,+\-|_&]+/).filter(Boolean);
  for (const t of tokens) {
    if (t === q) return 280_000;
    if (t.startsWith(q)) return 250_000 + Math.min(30_000, q.length * 500);
    if (t.includes(q)) return 130_000;
    if (q.length >= 3 && t.length <= q.length + 10 && t.length >= 2) {
      const d = levenshtein(q, t);
      const maxD = q.length <= 4 ? 2 : q.length <= 10 ? 3 : 4;
      if (d <= maxD) return 90_000 - d * 12_000;
    }
  }
  if (isSubsequence(q, r)) return 75_000 - Math.min(40_000, r.length * 200);
  if (q.length >= 3 && r.length <= 56) {
    const maxD = Math.min(5, Math.floor(q.length / 2) + 2);
    if (Math.abs(r.length - q.length) <= maxD + 8) {
      const d = levenshtein(q, r);
      if (d <= maxD) return 55_000 - d * 8_000;
    }
  }
  return 0;
}

/** Rank roles by relevance; falls back to closest edit distance when nothing scores. */
function rankRolesForSearch(roles: string[], rawQ: string, limit: number): string[] {
  const q = normalizeSearch(rawQ);
  if (!q.length) return [];
  const scored = roles.map(r => ({ r, s: scoreRoleMatch(r, q) }));
  const hits = scored.filter(x => x.s > 0).sort((a, b) => b.s - a.s || a.r.length - b.r.length || a.r.localeCompare(b.r));
  if (hits.length > 0) return hits.slice(0, limit).map(x => x.r);
  const byDist = roles
    .map(r => {
      const norm = normalizeSearch(r);
      const tokenDists = norm.split(/[/\s,+\-|_&]+/).filter(t => t.length > 0).map(t => levenshtein(q, t));
      const d = Math.min(levenshtein(q, norm.slice(0, Math.min(norm.length, 48))), ...tokenDists);
      return { r, d };
    })
    .sort((a, b) => a.d - b.d || a.r.length - b.r.length || a.r.localeCompare(b.r));
  const best = byDist[0]?.d ?? 99;
  const threshold = Math.min(12, best + Math.max(2, Math.floor(q.length / 3)));
  return byDist.filter(x => x.d <= threshold).slice(0, limit).map(x => x.r);
}

export default function HomePage() {
  const [resuming, setResuming] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activePreparations, setActivePreparations] = useState<
    Array<{ roleName: string; preparationStartDate?: string; targetCompletionDate?: string }>
  >([]);
  const [testReportCards, setTestReportCards] = useState<
    Array<{ roleName: string; tests: number; passed: number; failed: number; latestCompletedAt: string | null }>
  >([]);

  useEffect(() => {
    const refreshAuth = () => {
      const auth = getOrgAuthFromStorage();
      setIsAuthenticated(Boolean(auth?.token && auth?.user?.id));
    };
    refreshAuth();
    window.addEventListener("jbv2-org-auth-changed", refreshAuth);
    window.addEventListener("storage", refreshAuth);
    return () => {
      window.removeEventListener("jbv2-org-auth-changed", refreshAuth);
      window.removeEventListener("storage", refreshAuth);
    };
  }, []);

  /** `/` is the employee role-explorer; managers/HR should land on the portal chooser instead. */
  useLayoutEffect(() => {
    if (!isAuthenticated) return;
    const { user } = getOrgAuthFromStorage();
    if (isOrgManagerOrHr(user)) {
      window.location.replace(appPath("/dashboard/manager/home"));
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    const loadReports = async () => {
      const auth = getOrgAuthFromStorage();
      const userId = auth?.user?.id;
      if (!auth?.token || !userId) {
        if (!cancelled) {
          setTestReportCards([]);
          setActivePreparations([]);
        }
        return;
      }
      try {
        const ongoingRes = await fetch(`${getApiPrefix()}/api/role-preparation/ongoing?studentId=${encodeURIComponent(userId)}`);
        const ongoing = await ongoingRes.json().catch(() => []);
        if (!cancelled) {
          const active = (Array.isArray(ongoing) ? ongoing : [])
            .filter((x: any) => x?.roleName)
            .map((x: any) => ({
              roleName: String(x.roleName),
              preparationStartDate: String(x?.preparationStartDate || ""),
              targetCompletionDate: String(x?.targetCompletionDate || ""),
            }));
          setActivePreparations(active);
        }
        const roleNames = Array.from(
          new Set(
            (Array.isArray(ongoing) ? ongoing : [])
              .map((x: any) => String(x?.roleName || "").trim())
              .filter(Boolean)
          )
        ).slice(0, 6);
        if (!roleNames.length) {
          if (!cancelled) setTestReportCards([]);
          return;
        }
        const summaries = await Promise.all(
          roleNames.map(async (roleName) => {
            const testsRes = await fetch(
              `${getApiPrefix()}/api/skill-test/all-by-role?studentId=${encodeURIComponent(userId)}&roleName=${encodeURIComponent(roleName)}`
            );
            const tests = await testsRes.json().catch(() => []);
            const latest = (Array.isArray(tests) ? tests : []).filter((t: any) => t?.isLatest);
            const passed = latest.filter((t: any) => t?.passed).length;
            const failed = latest.filter((t: any) => !t?.passed).length;
            const latestCompletedAt =
              latest
                .map((t: any) => String(t?.completedAt || ""))
                .filter(Boolean)
                .sort()
                .slice(-1)[0] || null;
            return { roleName, tests: latest.length, passed, failed, latestCompletedAt };
          })
        );
        if (!cancelled) {
          setTestReportCards(summaries.filter((s) => s.tests > 0));
        }
      } catch {
        if (!cancelled) {
          setTestReportCards([]);
          setActivePreparations([]);
        }
      }
    };
    void loadReports();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const goToPreparation = async () => {
    if (resuming) return;
    setResuming(true);
    try {
      const auth = getOrgAuthFromStorage();
      const userId = auth?.user?.id;
      if (!auth?.token || !userId) {
        window.location.href = appPath("/auth/employee/login");
        return;
      }
      const r = await fetch(`${getApiPrefix()}/api/role-preparation/ongoing?studentId=${encodeURIComponent(userId)}`);
      const ongoing = await r.json().catch(() => []);
      if (Array.isArray(ongoing) && ongoing.length > 0) {
        const latest = [...ongoing]
          .filter((x: any) => x?.roleName)
          .sort((a: any, b: any) => {
            const ta = new Date(String(a?.preparationStartDate || "")).getTime();
            const tb = new Date(String(b?.preparationStartDate || "")).getTime();
            return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
          })[0];
        if (latest?.roleName) {
          window.location.href = appPath(`/role/${encodeURIComponent(latest.roleName)}`);
          return;
        }
      }
      window.location.href = appPath("/target-role");
    } finally {
      setResuming(false);
    }
  };

  const goToTargetNewRole = () => {
    window.location.href = appPath("/target-role");
  };

  if (!isAuthenticated) {
    return <PublicHomePage />;
  }

  return (
    <div
      style={{
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
        marginRight: "calc(50% - 50vw)",
        marginTop: -18,
        fontFamily: "Inter, 'Segoe UI', sans-serif",
        overflowX: "hidden",
        background: "#fff",
      }}
    >
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .jb-fade1 { animation: fadeUp 0.55s ease-out forwards; }
        .jb-fade2 { opacity:0; animation: fadeUp 0.55s ease-out 0.12s forwards; }
        .jb-fade3 { opacity:0; animation: fadeUp 0.55s ease-out 0.24s forwards; }
        :root {
          --bg: #f6f8fc;
          --surface: rgba(255,255,255,0.86);
          --ink: #0b1220;
          --muted: #475467;
          --border: rgba(15, 23, 42, 0.10);
          --border-strong: rgba(15, 23, 42, 0.14);
          --shadow: 0 18px 45px rgba(15, 23, 42, 0.10);
          --shadow-soft: 0 10px 26px rgba(15, 23, 42, 0.07);
          --brandA: #054a90;
          --brandC: #4f46e5;
          --brandMint: #00bfa6;
        }
        .jb-explore-card { transition: box-shadow 0.2s, transform 0.2s; }
        .jb-explore-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.13) !important; transform: translateY(-3px); }
        .jb-explore-btn { transition: background 0.18s, color 0.18s; }
        .jb-explore-btn:hover { background: #3f1d8f !important; color: #fff !important; border-color: #3f1d8f !important; }
        .jb-feature-row { transition: background 0.18s; }
        .jb-feature-row:hover { background: #f3e8ff !important; }
        .jb-cta-btn { transition: background 0.18s, color 0.18s, transform 0.18s; }
        .jb-cta-btn:hover { background: #f3f4f6 !important; transform: scale(1.03); }
        .jb-hero-ref-panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 22px;
          box-shadow: var(--shadow);
          backdrop-filter: blur(12px);
        }
        .jb-hero-ref-panel::before{
          content:"";
          position:absolute;
          inset:-30%;
          background:
            radial-gradient(circle at 18% 24%, rgba(56, 189, 248, 0.22) 0%, transparent 46%),
            radial-gradient(circle at 82% 18%, rgba(99, 102, 241, 0.16) 0%, transparent 44%),
            radial-gradient(circle at 70% 82%, rgba(34, 197, 94, 0.12) 0%, transparent 46%);
          filter: blur(26px);
          opacity: 0.75;
          pointer-events:none;
        }
        .jb-hero-ref-title { background:linear-gradient(90deg,var(--brandC) 0%,var(--brandA) 55%,var(--brandMint) 100%); -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
        .jb-hero-visual {
          position: relative;
          border-radius: 22px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.70);
          backdrop-filter: blur(10px);
          box-shadow: var(--shadow);
          padding: 14px;
          overflow: hidden;
        }
        .jb-hero-visual::after{
          content:"";
          position:absolute;
          inset:0;
          pointer-events:none;
          opacity:0.10;
          mix-blend-mode: overlay;
          background-image:
            repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 3px),
            repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.04) 0 1px, transparent 1px 3px);
          mask-image: radial-gradient(circle at 30% 35%, rgba(0, 0, 0, 0.9), transparent 70%);
        }
        .jb-hero-growth-img {
          width: min(460px, 30.2vw);
          height: auto;
          display: block;
          border-radius: 16px;
          border: 1px solid var(--border);
          box-shadow: 0 16px 36px rgba(15,23,42,0.16);
          background: #fff;
        }
        @media (max-width: 900px) {
          .jb-hero-ref-row { flex-direction:column !important; align-items:stretch !important; }
          .jb-hero-ref-images { justify-content:center !important; margin-top:8px; pointer-events:none; }
          .jb-hero-ref-img-right { margin-left:0 !important; }
          .jb-hero-growth-img { width: 100% !important; max-width: 760px; margin: 0 auto; }
        }
      `}</style>

      {/* ══ HERO (matches UI Reference / Job Blue Print.svg) ═══════════ */}
      <div
        style={{
          background: "linear-gradient(125deg, #dff1ff 0%, #e4e8ff 50%, #e8fff5 100%)",
          overflow: "hidden",
          minHeight: 392,
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: "clamp(10px, 2.6vw, 38px) clamp(10px, 2.6vw, 38px) clamp(16px, 2.9vw, 34px)",
            boxSizing: "border-box",
          }}
        >
          <div
            className="jb-hero-ref-panel jb-hero-ref-row jb-fade1"
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 9,
              minHeight: 324,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                flex: "1 1 0",
                minWidth: 0,
                padding: "clamp(20px, 3.6vw, 40px) clamp(11px, 2.9vw, 40px) clamp(20px, 2.9vw, 29px)",
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              <h1
                className="jb-hero-ref-title"
                style={{
                  margin: "0 0 9px",
                  fontSize: "clamp(24px, 3.624vw, 48px)",
                  fontWeight: 800,
                  lineHeight: 1.12,
                  letterSpacing: "-0.03em",
                }}
              >
                Employee Growth,
                <br />
                Clearly Tracked
              </h1>
              <p className="jb-fade2" style={{ margin: "0 0 16px", fontSize: 13.2, color: "rgba(71,84,103,0.92)", lineHeight: 1.68, maxWidth: 446 }}>
                This platform helps every employee plan their next role, learn required skills, complete assessments, and track progress with clear visibility for both employee and company authority.
              </p>
              <div className="jb-fade3" style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  onClick={() => { void goToPreparation(); }}
                  style={{
                    display: "inline-block",
                    padding: "7px 14px",
                    borderRadius: 9,
                    border: "2px solid #4f46e5",
                    background: "linear-gradient(90deg,#4f46e5 0%,#054a90 55%,#00bfa6 100%)",
                    color: "#fff",
                    fontSize: 13.2,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {resuming ? "Opening..." : "Go to your preparation"}
                </button>
                <button
                  onClick={goToTargetNewRole}
                  style={{
                    display: "inline-block",
                    padding: "7px 14px",
                    borderRadius: 9,
                    border: "2px solid #054a90",
                    background: "#054a90",
                    color: "#fff",
                    fontSize: 13.2,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Target New Role
                </button>
                <a
                  href={appPath("/role/")}
                  style={{
                    display: "inline-block",
                    padding: "7px 14px",
                    borderRadius: 9,
                    border: "2px solid #4f46e5",
                    background: "#fff",
                    color: "#4f46e5",
                    fontSize: 13.2,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Browse Roles
                </a>
              </div>
            </div>

            <div
              className="jb-hero-ref-images jb-fade2"
              style={{
                flex: "0 0 auto",
                padding: "clamp(12px, 2.2vw, 26px)",
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-hidden
            >
              <div className="jb-hero-visual">
                <img
                  src={publicAssetUrl("/ui-images/employee-growth-steps.png")}
                  alt=""
                  className="jb-hero-growth-img"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      

      {/* ══ WHY CHOOSE JOB BLUEPRINT? ════════════════════════════════ */}
      <div style={{ background: "#f6f8fc", padding: "72px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", margin: "0 0 40px", fontSize: 30, fontWeight: 800, color: "#054a90", letterSpacing: "-0.5px" }}>
            Why Teams Choose This Platform
          </h2>

          {/* Feature visual / placeholder */}
          <div style={{
            width: "100%",
            maxWidth: 760,
            margin: "0 auto 40px",
            background: "#fff",
            borderRadius: 16,
            border: "1.5px solid #d1d5db",
            overflow: "hidden",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}>
            <div style={{ height: 8, background: "linear-gradient(90deg,#7c3aed,#14b8a6,#f59e0b)" }} />
            <div style={{ padding: "40px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#6d28d9", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Your Personalized Path</div>
                <h3 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 800, color: "#312e81" }}>From current role to next role with clarity</h3>
                <p style={{ margin: 0, fontSize: 14, color: "#6b7280", lineHeight: 1.7 }}>Set a target role, identify skill gaps, complete assessments, and follow a tracked development plan that aligns employee ambition with company growth goals.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { color: "#dbeafe", text: "Stage 1", sub: "Role Selection" },
                  { color: "#dcfce7", text: "Stage 2", sub: "Skill Assessment" },
                  { color: "#fef9c3", text: "Stage 3", sub: "Learning Plan" },
                  { color: "#fce7f3", text: "Stage 4", sub: "Promotion Readiness" },
                ].map(block => (
                  <div key={block.text} style={{ background: block.color, borderRadius: 10, padding: "14px 12px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>{block.text}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{block.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2-row × 3-col features */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="12" width="4" height="9" rx="1" fill="#374151"/><rect x="10" y="7" width="4" height="14" rx="1" fill="#374151"/><rect x="17" y="3" width="4" height="18" rx="1" fill="#374151"/></svg>
                ),
                title: "Role-Based Development Roadmap",
                desc: "Every employee gets a dynamic roadmap based on target role and skill gap.",
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 17L9 11L13 15L21 7" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 7H21V11" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ),
                title: "Progress Tracking",
                desc: "Track learning completion, tests, and readiness milestones in one place.",
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="5" stroke="#374151" strokeWidth="2"/><path d="M12 13v8M9 18l3 3 3-3" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ),
                title: "Assessment & Badges",
                desc: "Validate known skills through tests and reward successful outcomes.",
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#374151" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="#374151" strokeWidth="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#374151" strokeWidth="2" strokeLinecap="round"/></svg>
                ),
                title: "Leadership Visibility",
                desc: "Managers and company authority can monitor employee growth and outcomes.",
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#374151" strokeWidth="2"/><path d="M12 7v5l3 3" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ),
                title: "Timeline-Based Planning",
                desc: "Set target dates and complete role transition plans within defined timelines.",
              },
              {
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#374151" strokeWidth="2"/><circle cx="12" cy="12" r="5" stroke="#374151" strokeWidth="2"/><circle cx="12" cy="12" r="1.5" fill="#374151"/></svg>
                ),
                title: "Interview Readiness",
                desc: "Prepare for internal assessments and interviews for higher or new roles.",
              },
            ].map(f => (
              <div key={f.title} className="jb-feature-row" style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px", background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#312e81", marginBottom: 4 }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ HOW IT WORKS ═════════════════════════════════════════════ */}
      <div style={{ background: "#fff", padding: "72px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48, justifyContent: "center" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a6.97 6.97 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="#0d1b2a"/>
            </svg>
            <h2 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: "#312e81", letterSpacing: "-0.5px" }}>How It Works</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
            {[
              {
                step: "01",
                title: "Choose Current & Target Role",
                desc: "Employee selects the role they want to move into and defines completion timeline.",
                color: "#ede9fe",
                accent: "#6d28d9",
              },
              {
                step: "02",
                title: "Assess, Learn, and Improve",
                desc: "Known skills go to assessment, unknown skills go to learning blueprint with clear milestones.",
                color: "#ccfbf1",
                accent: "#0f766e",
              },
              {
                step: "03",
                title: "Track Growth with Leadership",
                desc: "Progress, test outcomes, badges, and readiness are tracked for employee and company authority.",
                color: "#fee2e2",
                accent: "#b91c1c",
              },
            ].map(s => (
              <div key={s.step} style={{ padding: "32px 28px", borderRadius: 16, background: s.color, border: `1.5px solid ${s.color}` }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: s.accent, marginBottom: 16, lineHeight: 1 }}>{s.step}</div>
                <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 700, color: "#312e81" }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: "#4b5563", lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ CTA BANNER ═══════════════════════════════════════════════ */}
      <div style={{ padding: "0 32px 64px" }}>
        <div style={{
          maxWidth: 1100,
          margin: "0 auto",
          background: "#5b21b6",
          borderRadius: 20,
          padding: "56px 48px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* subtle glow blobs */}
          <div style={{ position:"absolute", top:-60, right:-40, width:200, height:200, borderRadius:"50%", background:"rgba(255,255,255,0.06)", pointerEvents:"none" }} />
          <div style={{ position:"absolute", bottom:-40, left:-30, width:160, height:160, borderRadius:"50%", background:"rgba(255,255,255,0.06)", pointerEvents:"none" }} />
          <div style={{ position:"relative", zIndex:1 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
              Ready to Build Stronger Employees and Future Leaders?
            </h2>
            <p style={{ margin: "0 0 32px", fontSize: 15, color: "rgba(255,255,255,0.85)", maxWidth: 520, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
              Start structured employee development with role-based learning, assessments, and leadership-level tracking.
            </p>
            <a
              href={appPath("/role/")}
              className="jb-cta-btn"
              style={{
                display: "inline-block",
                padding: "12px 36px",
                borderRadius: 9,
                border: "2px solid #fff",
                background: "#fff",
                color: "#4c1d95",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              Start Employee Development
            </a>
            <button
              onClick={() => { void goToPreparation(); }}
              className="jb-cta-btn"
              style={{
                display: "inline-block",
                marginLeft: 12,
                padding: "12px 28px",
                borderRadius: 9,
                border: "2px solid rgba(255,255,255,.9)",
                background: "transparent",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {resuming ? "Opening..." : "Go to your preparation"}
            </button>
            <button
              onClick={goToTargetNewRole}
              className="jb-cta-btn"
              style={{
                display: "inline-block",
                marginLeft: 12,
                padding: "12px 28px",
                borderRadius: 9,
                border: "2px solid #14b8a6",
                background: "#14b8a6",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Target New Role
            </button>
          </div>
        </div>
      </div>

      {/* ══ FOOTER (same as SomethingX StudentLanding + SiteFooter) ═════ */}
      <div
        style={{
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
        }}
      >
        <SiteFooter />
      </div>

    </div>
  );
}
