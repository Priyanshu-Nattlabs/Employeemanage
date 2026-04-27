"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getApiPrefix, publicAssetUrl } from "@/lib/apiBase";
import { SiteFooter } from "@/app/components/SiteFooter";

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
  const [roles, setRoles] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const prefix = getApiPrefix();
      const r = await fetch(`${prefix}/api/blueprint/roles`);
      const rolesData = r.ok ? await r.json() : [];
      if (cancelled) return;
      setRoles(Array.isArray(rolesData) ? rolesData : []);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const rankedRoleMatches = useMemo(
    () => rankRolesForSearch(roles, search, 12),
    [roles, search],
  );
  const searchTrimmed = search.trim();

  return (
    <div style={{ margin: "-18px -20px 0", fontFamily: "Inter, 'Segoe UI', sans-serif", overflowX: "hidden", background: "#fff" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .jb-fade1 { animation: fadeUp 0.55s ease-out forwards; }
        .jb-fade2 { opacity:0; animation: fadeUp 0.55s ease-out 0.12s forwards; }
        .jb-fade3 { opacity:0; animation: fadeUp 0.55s ease-out 0.24s forwards; }
        .jb-explore-card { transition: box-shadow 0.2s, transform 0.2s; }
        .jb-explore-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.13) !important; transform: translateY(-3px); }
        .jb-explore-btn { transition: background 0.18s, color 0.18s; }
        .jb-explore-btn:hover { background: #3f1d8f !important; color: #fff !important; border-color: #3f1d8f !important; }
        .jb-feature-row { transition: background 0.18s; }
        .jb-feature-row:hover { background: #f3e8ff !important; }
        .jb-cta-btn { transition: background 0.18s, color 0.18s, transform 0.18s; }
        .jb-cta-btn:hover { background: #f3f4f6 !important; transform: scale(1.03); }
        .jb-search-dropdown { position:absolute; top:calc(100% + 4px); left:0; right:0; background:#fff; border:1.5px solid #e5e7eb; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.12); max-height:220px; overflow-y:auto; z-index:50; }
        .jb-search-item { padding:10px 14px; font-size:14px; color:#374151; cursor:pointer; }
        .jb-search-item:hover { background:#f5f3ff; }
        .jb-hero-ref-panel { background:rgba(217,217,217,0.2); border:1px solid rgba(0,0,0,0.1); border-radius:10px; }
        .jb-hero-ref-title { background:linear-gradient(90deg,#3f1d8f 0%,#0f766e 100%); -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; }
        @media (max-width: 900px) {
          .jb-hero-ref-row { flex-direction:column !important; align-items:stretch !important; }
          .jb-hero-ref-images { justify-content:center !important; margin-top:8px; pointer-events:none; }
          .jb-hero-ref-img-right { margin-left:0 !important; }
        }
      `}</style>

      {/* ══ HERO (matches UI Reference / Job Blue Print.svg) ═══════════ */}
      <div
        style={{
          background: "linear-gradient(180deg, #ddd6fe 0%, #cffafe 100%)",
          overflow: "hidden",
          minHeight: 545,
        }}
      >
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: "clamp(16px, 3.6vw, 52px) clamp(16px, 3.6vw, 52px) clamp(24px, 4vw, 48px)",
            boxSizing: "border-box",
          }}
        >
          <div
            className="jb-hero-ref-panel jb-hero-ref-row jb-fade1"
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 12,
              minHeight: 450,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                flex: "1 1 0",
                minWidth: 0,
                padding: "clamp(28px, 5vw, 56px) clamp(16px, 4vw, 56px) clamp(28px, 4vw, 40px)",
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
              }}
            >
              <h1
                className="jb-hero-ref-title"
                style={{
                  margin: "0 0 12px",
                  fontSize: "clamp(28px, 4.2vw, 56px)",
                  fontWeight: 800,
                  lineHeight: 1.12,
                  letterSpacing: "-0.03em",
                }}
              >
                Employee Growth,
                <br />
                Clearly Tracked
              </h1>
              <p className="jb-fade2" style={{ margin: "0 0 22px", fontSize: 15, color: "#2a2a2a", lineHeight: 1.65, maxWidth: 620 }}>
                This platform helps every employee plan their next role, learn required skills, complete assessments, and track progress with clear visibility for both employee and company authority.
              </p>
              <div className="jb-fade3" style={{ position: "relative", maxWidth: 400 }}>
                <input
                  type="text"
                  placeholder="Search target roles and growth paths..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 52,
                    padding: "16px 18px",
                    borderRadius: 10,
                    border: "2px solid #425D0C",
                    fontSize: 15,
                    background: "#fff",
                    outline: "none",
                    boxSizing: "border-box",
                    color: "#050F20",
                  }}
                />
                {searchTrimmed.length > 0 && rankedRoleMatches.length > 0 && (
                  <div className="jb-search-dropdown" role="listbox" aria-label="Matching roles">
                    {rankedRoleMatches.map(r => (
                      <Link
                        key={r}
                        href={`/role/${encodeURIComponent(r)}`}
                        style={{ textDecoration: "none", display: "block" }}
                        onClick={() => setSearch("")}
                      >
                        <div className="jb-search-item" role="option">{r}</div>
                      </Link>
                    ))}
                  </div>
                )}
                {searchTrimmed.length > 0 && roles.length > 0 && rankedRoleMatches.length === 0 && (
                  <div className="jb-search-dropdown" style={{ padding: "12px 14px", fontSize: 13, color: "#6b7280" }}>
                    No close role matches. Try keywords from the job title or browse{" "}
                    <Link href="/role/" style={{ color: "#2563eb", fontWeight: 600 }} onClick={() => setSearch("")}>all roles</Link>.
                  </div>
                )}
              </div>
            </div>

            {/* Reference: image2 @ ~347×505, image3 @ ~504×504, overlapping — extracted from Job Blue Print.svg */}
            <div
              className="jb-hero-ref-images"
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "flex-end",
                flex: "0 0 auto",
                marginRight: "clamp(-12px, -1vw, 0px)",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              <img
                src={publicAssetUrl("/ui-images/hero-ref-student-left.png")}
                alt=""
                width={414}
                height={603}
                style={{
                  width: "clamp(160px, 24vw, 347px)",
                  height: "auto",
                  maxHeight: 505,
                  objectFit: "contain",
                  objectPosition: "bottom",
                  zIndex: 1,
                }}
              />
              <img
                className="jb-hero-ref-img-right"
                src={publicAssetUrl("/ui-images/hero-ref-student-right.png")}
                alt=""
                width={500}
                height={500}
                style={{
                  width: "clamp(180px, 35vw, 504px)",
                  height: "auto",
                  maxHeight: 504,
                  objectFit: "contain",
                  objectPosition: "bottom",
                  zIndex: 2,
                  marginLeft: "clamp(-72px, -9vw, -32px)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ══ WHY CHOOSE JOB BLUEPRINT? ════════════════════════════════ */}
      <div style={{ background: "#f5f3ff", padding: "72px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", margin: "0 0 40px", fontSize: 30, fontWeight: 800, color: "#4c1d95", letterSpacing: "-0.5px" }}>
            Why Teams Choose Job Blueprint
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
            <Link
              href="/role/"
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
            </Link>
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
