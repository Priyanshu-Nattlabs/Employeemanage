"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { getApiPrefix } from "@/lib/apiBase";
import { getOrgAuthFromStorage } from "@/lib/orgAuth";

const API = getApiPrefix();

const card: React.CSSProperties = { background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: 20, boxShadow: "0 1px 6px rgba(0,0,0,.06)" };

function diffColor(d?: string) {
  const m: Record<string, { bg: string; text: string }> = {
    beginner: { bg: "#dcfce7", text: "#166534" },
    intermediate: { bg: "#fef9c3", text: "#854d0e" },
    advanced: { bg: "#fee2e2", text: "#991b1b" },
  };
  return m[(d || "").toLowerCase()] ?? { bg: "#f1f5f9", text: "#64748b" };
}

function chip(bg: string, text: string): React.CSSProperties {
  return { display:"inline-block", padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, background:bg, color:text };
}

/* ── Learning Progress Line Chart ─────────────────────────── */
const CHART_COLORS = [
  "#6366f1","#22c55e","#f59e0b","#ef4444","#a855f7",
  "#14b8a6","#f97316","#3b82f6","#84cc16","#ec4899",
];

function LearningProgressChart({
  skills,
  prep,
  testResults,
  topicsCache,
  taskKeyBySkill,
}: {
  skills: any[];
  prep: any;
  testResults: any[];
  topicsCache: Record<string, any>;
  taskKeyBySkill: Record<string, string>;
}) {
  const W = 900, H = 320;
  const PAD = { t: 24, r: 24, b: 58, l: 54 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;

  const prepStartMs: number | null = prep?.startedAt ? new Date(prep.startedAt).getTime() : null;
  const nowMs = Date.now();

  /* ── per-skill data ─────────────────────────── */
  const skillData = skills.slice(0, 10).map((s: any, i: number) => {
    const done   = !!prep?.skillProgress?.[s.skillName]?.completed;
    const sp     = prep?.skillProgress?.[s.skillName] || {};
    const key    = taskKeyBySkill[s.skillName];
    const byMonth: Record<string, any[]> = key ? (topicsCache[key] || {}) : {};
    const sub: Record<string, boolean>   = sp?.subtopicCompletion || {};

    let total = 0, doneCnt = 0;
    for (const [month, arr] of Object.entries(byMonth)) {
      const topics = Array.isArray(arr) ? arr as any[] : [];
      topics.forEach((_, idx) => {
        total++;
        if (sub[`month_${month}_topic_${idx}`]) doneCnt++;
      });
    }
    if (done) { doneCnt = total || 1; total = total || 1; }
    const currentPct  = done ? 100 : (total > 0 ? Math.round((doneCnt / total) * 100) : 0);

    /* skill tests sorted chronologically */
    const skillTests = testResults
      .filter((t: any) => t.skillName === s.skillName && t.completedAt)
      .sort((a: any, b: any) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

    const startMs = prepStartMs
      ?? (skillTests[0] ? new Date(skillTests[0].completedAt).getTime() - 7 * 86400_000 : nowMs - 14 * 86400_000);
    const skillCompletedAt = done && sp.completedAt ? new Date(sp.completedAt).getTime() : null;
    const endMs = skillCompletedAt ?? nowMs;
    const duration = Math.max(endMs - startMs, 1);

    /* build chart points */
    type Pt = { ts: number; pct: number; test?: any; isEnd?: boolean };
    const pts: Pt[] = [{ ts: startMs, pct: 0 }];

    for (const t of skillTests) {
      const ts      = new Date(t.completedAt).getTime();
      const frac    = Math.max(0, Math.min(1, (ts - startMs) / duration));
      const interpPct = Math.round(frac * currentPct);
      pts.push({ ts, pct: interpPct, test: t });
    }

    /* ensure end point exists and isn't a duplicate */
    if (!pts.some(p => p.ts === endMs)) {
      pts.push({ ts: endMs, pct: currentPct, isEnd: true });
    } else {
      const last = pts[pts.length - 1];
      if (last.ts === endMs) last.pct = currentPct;
    }

    /* dedup & sort */
    const seen = new Set<number>();
    const points = pts
      .filter(p => { const ok = !seen.has(p.ts); seen.add(p.ts); return ok; })
      .sort((a, b) => a.ts - b.ts);

    return { skill: s, color: CHART_COLORS[i % CHART_COLORS.length], points, done, currentPct, total, doneCnt };
  });

  /* ── time range ─────────────────────────── */
  const allTs: number[] = [nowMs];
  if (prepStartMs) allTs.push(prepStartMs);
  for (const sd of skillData) for (const p of sd.points) allTs.push(p.ts);
  const minTs   = Math.min(...allTs);
  const maxTs   = Math.max(...allTs);
  const tsRange = Math.max(maxTs - minTs, 1);

  const xS = (ts: number)  => PAD.l + ((ts - minTs) / tsRange) * cW;
  const yS = (pct: number) => PAD.t + cH - (pct / 100) * cH;

  /* ── bezier path ─────────────────────────── */
  const makePath = (pts: Array<{ ts: number; pct: number }>) =>
    pts.map((p, i) => {
      const px = xS(p.ts).toFixed(1), py = yS(p.pct).toFixed(1);
      if (i === 0) return `M${px},${py}`;
      const prev = pts[i - 1];
      const mx = ((xS(prev.ts) + xS(p.ts)) / 2).toFixed(1);
      return `C${mx},${yS(prev.pct).toFixed(1)} ${mx},${py} ${px},${py}`;
    }).join(" ");

  /* ── x-axis ticks ─────────────────────────── */
  const dayMs = 86_400_000;
  const rangeInDays = tsRange / dayMs;
  const tickInterval = rangeInDays <= 7 ? dayMs
    : rangeInDays <= 30 ? 7 * dayMs
    : rangeInDays <= 90 ? 14 * dayMs
    : 30 * dayMs;
  const xTicks: number[] = [];
  { let t = minTs; while (t <= maxTs + tickInterval) { if (t <= maxTs) xTicks.push(t); t += tickInterval; } }
  if (!xTicks.includes(maxTs)) xTicks.push(maxTs);

  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`;
  };

  const hasData = prepStartMs !== null || testResults.length > 0;
  if (!hasData) {
    return (
      <div style={{ ...card, marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>📈 Learning Progress</h3>
        <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", padding: "32px 0" }}>
          Start preparation and take tests to see your progress chart here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ ...card, marginBottom: 24, padding: "20px 20px 16px" }}>
      <h3 style={{ margin: "0 0 2px", fontSize: 16, color: "#0f172a" }}>📈 Learning Progress</h3>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748b" }}>
        Topics covered (%) per skill over time&ensp;·&ensp;
        <span style={{ color:"#22c55e", fontWeight:700 }}>●✓ passed test</span>
        &ensp;
        <span style={{ color:"#ef4444", fontWeight:700 }}>✗ failed test</span>
      </p>

      <div style={{ overflowX: "auto" }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 380, display: "block" }}>

          {/* dashed grid + y labels */}
          {[0, 25, 50, 75, 100].map(tick => (
            <g key={tick}>
              <line
                x1={PAD.l} y1={yS(tick)} x2={PAD.l + cW} y2={yS(tick)}
                stroke={tick === 0 ? "#cbd5e1" : "#f1f5f9"}
                strokeWidth={tick === 0 ? 1.5 : 1}
                strokeDasharray={tick === 0 ? undefined : "4,3"}
              />
              <text x={PAD.l - 7} y={yS(tick) + 4} textAnchor="end" fontSize={10} fill="#94a3b8">
                {tick}%
              </text>
            </g>
          ))}

          {/* 75% pass-threshold guide */}
          <line
            x1={PAD.l} y1={yS(75)} x2={PAD.l + cW} y2={yS(75)}
            stroke="#f59e0b" strokeWidth={1.2} strokeDasharray="6,3" opacity={0.55}
          />
          <text x={PAD.l + cW + 3} y={yS(75) + 4} fontSize={9} fill="#f59e0b" opacity={0.8}>75%</text>

          {/* x-axis baseline */}
          <line x1={PAD.l} y1={PAD.t + cH} x2={PAD.l + cW} y2={PAD.t + cH} stroke="#cbd5e1" strokeWidth={1.5} />

          {/* x ticks */}
          {xTicks.map((ts, xi) => (
            <g key={xi}>
              <line x1={xS(ts)} y1={PAD.t + cH} x2={xS(ts)} y2={PAD.t + cH + 5} stroke="#94a3b8" strokeWidth={1} />
              <text x={xS(ts)} y={PAD.t + cH + 18} textAnchor="middle" fontSize={9} fill="#94a3b8">{fmtDate(ts)}</text>
            </g>
          ))}

          {/* y-axis label */}
          <text
            transform={`translate(13,${PAD.t + cH / 2}) rotate(-90)`}
            textAnchor="middle" fontSize={10} fill="#64748b"
          >Topics Covered</text>

          {/* area fills */}
          {skillData.map(({ skill, color, points }) => {
            if (points.length < 2) return null;
            const baseY = yS(0).toFixed(1);
            const p0x   = xS(points[0].ts).toFixed(1);
            const pLx   = xS(points[points.length - 1].ts).toFixed(1);
            return (
              <path
                key={`area-${skill.skillName}`}
                d={`${makePath(points)} L${pLx},${baseY} L${p0x},${baseY} Z`}
                fill={color} opacity={0.07}
              />
            );
          })}

          {/* lines */}
          {skillData.map(({ skill, color, points }) => (
            points.length >= 2 ? (
              <path
                key={`line-${skill.skillName}`}
                d={makePath(points)}
                fill="none" stroke={color} strokeWidth={2.5}
                strokeLinejoin="round" strokeLinecap="round"
              />
            ) : null
          ))}

          {/* markers */}
          {skillData.map(({ skill, color, points }) =>
            points.map((p, idx) => {
              const cx = xS(p.ts), cy = yS(p.pct);

              if (p.test) {
                if (p.test.passed) {
                  /* green filled circle + ✓ */
                  return (
                    <g key={`mk-${skill.skillName}-${idx}`}>
                      <circle cx={cx} cy={cy} r={11} fill="#22c55e" stroke="white" strokeWidth={2.5} />
                      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fill="white" fontWeight="bold">✓</text>
                      <title>{skill.skillName} — Passed {p.test.score}% on {fmtDate(p.ts)}</title>
                    </g>
                  );
                } else {
                  /* white circle + red ✗ */
                  return (
                    <g key={`mk-${skill.skillName}-${idx}`}>
                      <circle cx={cx} cy={cy} r={10} fill="white" stroke="#ef4444" strokeWidth={2.5} />
                      <line x1={cx-5} y1={cy-5} x2={cx+5} y2={cy+5} stroke="#ef4444" strokeWidth={2.2} strokeLinecap="round" />
                      <line x1={cx+5} y1={cy-5} x2={cx-5} y2={cy+5} stroke="#ef4444" strokeWidth={2.2} strokeLinecap="round" />
                      <title>{skill.skillName} — Failed {p.test.score}% on {fmtDate(p.ts)}</title>
                    </g>
                  );
                }
              }

              /* start / end dots */
              if (idx === 0 || idx === points.length - 1 || p.isEnd) {
                return (
                  <circle
                    key={`dot-${skill.skillName}-${idx}`}
                    cx={cx} cy={cy} r={4}
                    fill={color} stroke="white" strokeWidth={2}
                    opacity={0.85}
                  >
                    <title>{skill.skillName} — {Math.round(p.pct)}% on {fmtDate(p.ts)}</title>
                  </circle>
                );
              }
              return null;
            })
          )}
        </svg>
      </div>

      {/* legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
        {skillData.map(({ skill, color, currentPct, done }) => (
          <div key={skill.skillName} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <div style={{ width: 22, height: 3, background: color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ color: "#374151", fontWeight: done ? 700 : 400, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {skill.skillName}
            </span>
            <span style={{ color: done ? "#16a34a" : "#64748b", fontWeight: 700 }}>{currentPct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Donut ring SVG helper ─────────────────────────── */
function DonutRing({ pct, size = 110, stroke = 14 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (circ * pct) / 100;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#grad)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={dashOffset}
        strokeLinecap="round" style={{ transition:"stroke-dashoffset .8s ease" }}
      />
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1"/>
          <stop offset="100%" stopColor="#a855f7"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function AnalyticsPage() {
  const params   = useParams<{ roleName: string }>();
  const router   = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || "";
  // When this component is mounted via the manager tracking route, suppress the
  // employee-facing breadcrumb and destructive "Leave Preparation" action.
  const inManagerTrack = pathname.startsWith("/dashboard/manager/track");
  const roleName = decodeURIComponent(params.roleName);

  const [me, setMe] = useState<any>(null);
  const [isViewingOther, setIsViewingOther] = useState(false);
  const [userId,      setUserId]      = useState("demo-student-1");
  const [viewingLabel, setViewingLabel] = useState<string>("");
  const [analytics,   setAnalytics]   = useState<any>(null);
  const [prep,        setPrep]        = useState<any>(null);
  const [role,        setRole]        = useState<any>(null);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [leaving,     setLeaving]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");

  useEffect(() => {
    const auth = getOrgAuthFromStorage();
    const me = auth?.user || null;
    setMe(me);
    const meId = me?.id || "demo-student-1";

    const requested = (searchParams?.get("studentId") || "").trim();
    const isOther = !!requested && requested !== meId;
    setIsViewingOther(isOther);
    const canViewOther = me?.accountType === "ADMIN" || me?.currentRole === "MANAGER" || me?.currentRole === "HR";

    const uid = isOther
      ? (canViewOther ? requested : meId)
      : meId;

    if (isOther && !canViewOther) {
      // silently drop the override + keep user on their own analytics
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("studentId");
        window.history.replaceState({}, "", url.toString());
      } catch { /* ignore */ }
    }

    const email = (searchParams?.get("employeeEmail") || "").trim();
    const name = (searchParams?.get("employeeName") || "").trim();
    const label = isOther && canViewOther
      ? (name || email || `Employee ${requested}`)
      : (me?.fullName || me?.email || "");

    setViewingLabel(label);
    setUserId(uid);
    let cancelled = false;

    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
    const safeJson = async (url: string, attempts = 3) => {
      let lastErr: any = null;
      for (let i = 0; i < attempts; i++) {
        try {
          const r = await fetch(url, { cache: "no-store" });
          if (!r.ok) {
            lastErr = new Error(`HTTP ${r.status}`);
          } else {
            return await r.json();
          }
        } catch (e) {
          lastErr = e;
        }
        // small backoff helps avoid transient gateway/container warmups
        await sleep(250 * (i + 1));
      }
      return null;
    };

    (async () => {
      setLoading(true);
      setError("");

      const [a, p, roleData, tr] = await Promise.all([
        safeJson(`${API}/api/role-preparation/analytics/${encodeURIComponent(roleName)}?studentId=${encodeURIComponent(uid)}`),
        safeJson(`${API}/api/role-preparation/${encodeURIComponent(roleName)}?studentId=${encodeURIComponent(uid)}`),
        safeJson(`${API}/api/blueprint/role/${encodeURIComponent(roleName)}`),
        safeJson(`${API}/api/skill-test/all-by-role?studentId=${encodeURIComponent(uid)}&roleName=${encodeURIComponent(roleName)}`),
      ]);

      if (cancelled) return;

      // Avoid “fluctuating” UI by only committing a snapshot when
      // we have the key pieces we need.
      if (!a || !roleData) {
        setError("Unable to load analytics data right now. Please refresh.");
        setLoading(false);
        return;
      }

      setAnalytics(a);
      setRole(roleData);
      setPrep(p); // prep may be null if user never started preparation
      setTestResults(Array.isArray(tr) ? tr : []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [roleName, searchParams]);

  const canTakeTests = !inManagerTrack && me?.currentRole === "EMPLOYEE" && !isViewingOther;

  const skills = useMemo(() => role?.skillRequirements || [], [role]);

  const techSkills = skills.filter((s: any) => s.skillType === "technical");
  const softSkills = skills.filter((s: any) => s.skillType !== "technical");
  const techDone = techSkills.filter((s: any) => prep?.skillProgress?.[s.skillName]?.completed).length;
  const softDone = softSkills.filter((s: any) => prep?.skillProgress?.[s.skillName]?.completed).length;
  const pct = analytics?.completionPercentage ?? 0;

  /* kept for backward-compat with skill table column */
  const skillScoresMap: Record<string, number> = analytics?.skillScores ?? {};

  const topicsCache = (prep?.ganttChartData as any)?.topicsCache || {};
  const taskKeyBySkill = useMemo(() => {
    const out: Record<string, string> = {};
    const tasks: any[] = (prep?.ganttChartData as any)?.plan?.tasks || [];
    for (const t of tasks) out[t.name] = `${t.name}_${t.start}_${t.end}`;
    return out;
  }, [prep?.ganttChartData]);
  const skillTopicPct = (skillName: string, doneFallback: boolean) => {
    if (doneFallback) return 100;
    const key = taskKeyBySkill[skillName];
    if (!key) return 0;
    const byMonth = topicsCache[key] || {};
    const sub = prep?.skillProgress?.[skillName]?.subtopicCompletion || {};
    let total = 0, done = 0;
    for (const [month, arr] of Object.entries(byMonth)) {
      const topics = Array.isArray(arr) ? arr : [];
      topics.forEach((_, i) => {
        total++;
        if (sub[`month_${month}_topic_${i}`]) done++;
      });
    }
    return total ? Math.round((done * 100) / total) : 0;
  };

  if (loading) return (
    <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
      <div style={{ textAlign:"center" }}>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ width:48, height:48, border:"4px solid #e9d5ff", borderTop:"4px solid #8b5cf6", borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto 12px" }}/>
        <p style={{ color:"#6366f1", fontWeight:600 }}>Loading analytics…</p>
      </div>
    </div>
  );
  if (!analytics) return (
    <div style={{ maxWidth:700, margin:"50px auto", textAlign:"center" }}>
      <p style={{ color:"#dc2626", fontWeight:700, marginBottom:8 }}>Analytics unavailable</p>
      <p style={{ color:"#64748b", fontSize:14, marginBottom:16 }}>{error || "Please refresh and try again."}</p>
      <Link href={`/role/${encodeURIComponent(roleName)}`} style={{ color:"#6366f1", fontWeight:700, textDecoration:"none" }}>
        ← Back to Role
      </Link>
    </div>
  );

  return (
    <div style={{ padding: "8px 0 0 4px", marginRight: -20 }}>
      {/* breadcrumb (hidden in manager-tracking mode — that route has its own header) */}
      {!inManagerTrack && (
        <p style={{ color:"#64748b", fontSize:13, marginBottom:14 }}>
          <Link href="/" style={{ color:"#6366f1", fontWeight:700, textDecoration:"none" }}>Home</Link>
          <span style={{ color:"#cbd5e1", margin:"0 6px" }}>›</span>
          <Link href={`/role/${encodeURIComponent(roleName)}`} style={{ color:"#6366f1", fontWeight:700, textDecoration:"none" }}>{roleName}</Link>
          <span style={{ color:"#cbd5e1", margin:"0 6px" }}>›</span>
          <span style={{ color:"#0f172a", fontWeight:700 }}>Analytics</span>
        </p>
      )}

      {/* hero — colorful gradient with decorative blobs */}
      <div style={{
        background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 30%,#db2777 65%,#f59e0b 100%)",
        borderRadius: 24,
        padding: "30px 0 28px 32px",
        marginRight: 0,
        marginBottom: 24,
        color: "white",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 18px 40px -18px rgba(124,58,237,0.55)",
      }}>
        {/* decorative blobs */}
        <div style={{ position:"absolute", top:-60, right:-40, width:220, height:220, borderRadius:"50%", background:"rgba(255,255,255,0.14)", filter:"blur(2px)" }} />
        <div style={{ position:"absolute", bottom:-80, right:120, width:180, height:180, borderRadius:"50%", background:"rgba(255,255,255,0.08)" }} />
        <div style={{ position:"absolute", top:40, left:-50, width:120, height:120, borderRadius:"50%", background:"rgba(255,255,255,0.10)" }} />

        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:10, flexWrap:"wrap" }}>
            <div style={{
              width:54, height:54, borderRadius:16,
              background:"rgba(255,255,255,0.22)", backdropFilter:"blur(6px)",
              border:"1px solid rgba(255,255,255,0.35)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:26,
            }}>📊</div>
            <div>
              <h1 style={{ margin:0, fontSize:28, fontWeight:900, letterSpacing:"-0.02em" }}>Preparation Analytics</h1>
              <p style={{ margin:"4px 0 0", color:"rgba(255,255,255,0.85)", fontSize:14 }}>{roleName}</p>
            </div>
          </div>

          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:12 }}>
            {viewingLabel ? (
              <span style={{
                display:"inline-flex", alignItems:"center", gap:8,
                background:"rgba(255,255,255,0.22)",
                border:"1px solid rgba(255,255,255,0.35)",
                backdropFilter:"blur(6px)",
                borderRadius:999, padding:"6px 14px", fontSize:13, fontWeight:700,
              }}>
                <span style={{ fontSize:14 }}>👤</span> {viewingLabel}
              </span>
            ) : null}
            <span style={{
              display:"inline-flex", alignItems:"center", gap:8,
              background:"rgba(255,255,255,0.22)",
              border:"1px solid rgba(255,255,255,0.35)",
              backdropFilter:"blur(6px)",
              borderRadius:999, padding:"6px 14px", fontSize:13, fontWeight:800,
            }}>
              {pct}% complete
            </span>
            {analytics.totalSkills ? (
              <span style={{
                display:"inline-flex", alignItems:"center", gap:8,
                background:"rgba(255,255,255,0.22)",
                border:"1px solid rgba(255,255,255,0.35)",
                backdropFilter:"blur(6px)",
                borderRadius:999, padding:"6px 14px", fontSize:13, fontWeight:700,
              }}>
                {analytics.completedSkills ?? 0}/{analytics.totalSkills} skills done
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* stats grid — gradient accent cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
        {[
          { label:"Total Skills",     val: analytics.totalSkills ?? 0,                       icon:"🎯", from:"#3b82f6", to:"#0ea5e9" },
          { label:"Completed",        val: analytics.completedSkills ?? 0,                   icon:"✅", from:"#22c55e", to:"#16a34a" },
          { label:"Remaining",        val: analytics.remainingSkills ?? 0,                   icon:"⏳", from:"#f59e0b", to:"#ea580c" },
          { label:"Technical Done",   val: `${techDone}/${techSkills.length}`,               icon:"💻", from:"#6366f1", to:"#4f46e5" },
          { label:"Soft Skills Done", val: `${softDone}/${softSkills.length}`,               icon:"🌟", from:"#a855f7", to:"#db2777" },
        ].map(s => (
          <div key={s.label} style={{
            background:"#fff",
            borderRadius:16, border:"1px solid #e2e8f0",
            padding:"16px 14px",
            position:"relative", overflow:"hidden",
            boxShadow:"0 1px 6px rgba(0,0,0,.05)",
          }}>
            <div style={{ position:"absolute", inset:0, background:`linear-gradient(135deg, ${s.from}10, ${s.to}05 60%, transparent)`, pointerEvents:"none" }} />
            <div style={{ position:"absolute", left:0, top:0, bottom:0, width:4, background:`linear-gradient(180deg, ${s.from}, ${s.to})` }} />
            <div style={{ position:"relative", textAlign:"center" }}>
              <div style={{ fontSize:22 }}>{s.icon}</div>
              <div style={{ fontSize:26, fontWeight:900, marginTop:2, background:`linear-gradient(135deg, ${s.from}, ${s.to})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>{s.val}</div>
              <div style={{ fontSize:12, color:"#64748b", marginTop:2, fontWeight:700 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* donut + bar row */}
      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:16, marginBottom:24 }}>
        {/* donut */}
        <div style={{ ...card, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minWidth:160, padding:24 }}>
          <div style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
            <DonutRing pct={pct} size={120} stroke={16}/>
            <div style={{ position:"absolute", textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:900, color:"#0f172a" }}>{pct}%</div>
              <div style={{ fontSize:10, color:"#64748b", fontWeight:600 }}>DONE</div>
            </div>
          </div>
          <p style={{ margin:"10px 0 0", fontSize:12, color:"#64748b", textAlign:"center", fontWeight:600 }}>Role Readiness</p>
        </div>

        {/* horizontal progress bar per skill */}
        <div style={card}>
          <h3 style={{ margin:"0 0 14px", color:"#0f172a", fontSize:16 }}>Skill-by-Skill Progress</h3>
          <div style={{ display:"grid", gap:8 }}>
            {skills.slice(0, 10).map((s: any) => {
              const done = !!prep?.skillProgress?.[s.skillName]?.completed;
              const score = skillScoresMap[s.skillName] ?? prep?.skillProgress?.[s.skillName]?.score;
              const pctSkill = skillTopicPct(s.skillName, done);
              return (
                <div key={s.skillName}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3, fontSize:13 }}>
                    <span style={{ fontWeight:600, color: done ? "#15803d" : "#374151", textDecoration: done ? "line-through" : "none" }}>{s.skillName}</span>
                    <span style={{ color:"#64748b", fontSize:12 }}>
                      {done ? (typeof score==="number" ? `${score}%` : "✅") : `${pctSkill}%`}
                    </span>
                  </div>
                  <div style={{ height:8, borderRadius:999, background:"#f1f5f9", overflow:"hidden" }}>
                    <div style={{ height:"100%", width: `${done ? 100 : pctSkill}%`, borderRadius:999, background:"linear-gradient(90deg,#6366f1,#a855f7)", transition:"width .6s ease" }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Learning Progress Chart ─────────────────────── */}
      <LearningProgressChart
        skills={skills}
        prep={prep}
        testResults={testResults}
        topicsCache={topicsCache}
        taskKeyBySkill={taskKeyBySkill}
      />

      {/* ── Test Results — every attempt, every skill ─────── */}
      {(() => {
        // Group attempts by skill name for the UI
        const grouped: Record<string, any[]> = {};
        for (const t of testResults) {
          if (!grouped[t.skillName]) grouped[t.skillName] = [];
          grouped[t.skillName].push(t);
        }
        const skillNames = Object.keys(grouped).sort();
        const totalAttempts = testResults.length;
        const passedCount   = testResults.filter((t: any) => t.passed).length;
        const failedCount   = totalAttempts - passedCount;

        return (
          <div style={{ ...card, marginBottom: 24, padding: 0, overflow: "hidden" }}>
            {/* header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
            }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>🧠 Test Results</h3>
              {totalAttempts > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, background: "#dcfce7", color: "#15803d", borderRadius: 999, padding: "3px 10px" }}>
                    ✓ {passedCount} passed
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, background: "#fee2e2", color: "#b91c1c", borderRadius: 999, padding: "3px 10px" }}>
                    ✗ {failedCount} failed
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", padding: "3px 6px" }}>
                    across {skillNames.length} skill{skillNames.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            {totalAttempts === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                No tests submitted yet. Take a skill test from the role page to see results here.
              </div>
            ) : (
              <div style={{ padding: "16px" }}>
                {skillNames.map(skillName => {
                  const attempts: any[] = grouped[skillName];
                  // Latest attempt is attemptNo=1 (sorted by service)
                  const latest = attempts.find(a => a.isLatest) ?? attempts[attempts.length - 1];
                  const latestPassed = latest?.passed === true;

                  return (
                    <div key={skillName} style={{
                      marginBottom: 14,
                      border: `1.5px solid ${latestPassed ? "#bbf7d0" : "#fecaca"}`,
                      borderRadius: 16,
                      overflow: "hidden",
                    }}>
                      {/* Skill header row */}
                      <div style={{
                        padding: "12px 16px",
                        background: latestPassed ? "#f0fdf4" : "#fff1f2",
                        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                            background: latestPassed ? "#22c55e" : "#ef4444",
                            color: "white", fontSize: 13, fontWeight: 900,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {latestPassed ? "✓" : "✗"}
                          </span>
                          <span style={{ fontWeight: 900, fontSize: 14, color: "#0f172a" }}>{skillName}</span>
                          {attempts.length > 1 && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", background: "#f1f5f9", borderRadius: 999, padding: "2px 8px" }}>
                              {attempts.length} attempts
                            </span>
                          )}
                        </div>
                        {canTakeTests ? (
                          <Link href={`/role/${encodeURIComponent(roleName)}/test/${encodeURIComponent(skillName)}`} style={{ textDecoration: "none" }}>
                            <button style={{
                              padding: "5px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                              fontWeight: 700, fontSize: 12,
                              background: latestPassed ? "#dcfce7" : "#fee2e2",
                              color:      latestPassed ? "#15803d" : "#b91c1c",
                            }}>
                              {latestPassed ? "✓ Retake" : "🔄 Retake Test"}
                            </button>
                          </Link>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>Tests: employee only</span>
                        )}
                      </div>

                      {/* Each attempt row */}
                      {[...attempts].reverse().map((t: any, idx: number) => {
                        const passed  = t.passed === true;
                        const score   = typeof t.score === "number" ? t.score : null;
                        const dateStr = t.completedAt
                          ? new Date(t.completedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : null;
                        const attemptLabel = attempts.length > 1 ? `Attempt ${idx + 1}` : "Result";

                        return (
                          <div key={idx} style={{
                            padding: "10px 16px",
                            borderTop: "1px solid #f1f5f9",
                            background: t.isLatest ? (passed ? "#f9fef9" : "#fff8f8") : "white",
                            display: "flex", flexDirection: "column", gap: 6,
                          }}>
                            {/* row: attempt label + status + score */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{attemptLabel}</span>
                                {t.isLatest && (
                                  <span style={{ fontSize: 10, fontWeight: 800, background: "#dbeafe", color: "#1e40af", borderRadius: 999, padding: "1px 7px" }}>
                                    Latest
                                  </span>
                                )}
                                <span style={{
                                  fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "2px 9px",
                                  background: passed ? "#dcfce7" : "#fee2e2",
                                  color:      passed ? "#15803d" : "#dc2626",
                                }}>
                                  {passed ? "✓ Passed" : "✗ Failed"}
                                </span>
                              </div>
                              {score !== null && (
                                <span style={{ fontSize: 18, fontWeight: 900, color: passed ? "#15803d" : "#dc2626" }}>
                                  {score}%
                                </span>
                              )}
                            </div>

                            {/* score bar */}
                            {score !== null && (
                              <div style={{ height: 7, borderRadius: 999, background: "#f1f5f9", overflow: "hidden" }}>
                                <div style={{
                                  height: "100%", borderRadius: 999,
                                  width: `${score}%`,
                                  background: passed
                                    ? "linear-gradient(90deg,#22c55e,#16a34a)"
                                    : "linear-gradient(90deg,#f87171,#ef4444)",
                                  transition: "width .6s",
                                }} />
                              </div>
                            )}

                            {/* meta chips */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, color: "#64748b" }}>
                              {t.correctQ !== null && t.totalQ > 0 && (
                                <span>{t.correctQ}/{t.totalQ} correct</span>
                              )}
                              {dateStr && <span>📅 {dateStr}</span>}
                              {!passed && score !== null && (
                                <span style={{ color: "#b91c1c", fontWeight: 600 }}>
                                  Need ≥ 75% · {75 - score} marks short
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Full skill table */}
      <div style={{ ...card, marginBottom:24, padding:0, overflow:"hidden" }}>
        <div style={{
          padding:"14px 20px",
          background:"linear-gradient(135deg,#eef2ff,#fdf2f8)",
          borderBottom:"1px solid #e2e8f0",
          display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8,
        }}>
          <h3 style={{ margin:0, fontSize:16, color:"#0f172a", display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:18 }}>📚</span> All Skills Status
          </h3>
          <span style={{ fontSize:12, fontWeight:700, color:"#475569", background:"white", border:"1px solid #e2e8f0", borderRadius:999, padding:"4px 10px" }}>
            {skills.length} skill{skills.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f8fafc" }}>
                {["Skill","Type","Difficulty","Importance","Status","Score","Action"].map(h => (
                  <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:12, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:".06em", borderBottom:"1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {skills.map((s: any, i: number) => {
                const done = !!prep?.skillProgress?.[s.skillName]?.completed;
                const score = skillScoresMap[s.skillName] ?? prep?.skillProgress?.[s.skillName]?.score;
                const diff = diffColor(s.difficulty);
                return (
                  <tr key={s.skillName} style={{ borderBottom:"1px solid #f1f5f9", background: i%2===0 ? "white" : "#fafbff" }}>
                    <td style={{ padding:"14px 16px", fontWeight:600, color: done ? "#15803d" : "#0f172a", textDecoration: done ? "line-through" : "none" }}>{s.skillName}</td>
                    <td style={{ padding:"14px 16px" }}>
                      <span style={{ ...chip(s.skillType==="technical"?"#dbeafe":"#ede9fe", s.skillType==="technical"?"#1e40af":"#5b21b6"), fontSize:11 }}>
                        {s.skillType==="technical" ? "💻 Tech" : "🎯 Soft"}
                      </span>
                    </td>
                    <td style={{ padding:"14px 16px" }}><span style={chip(diff.bg, diff.text)}>{s.difficulty||"intermediate"}</span></td>
                    <td style={{ padding:"14px 16px", fontSize:13, color:"#475569" }}>{s.importance||"-"}</td>
                    <td style={{ padding:"14px 16px" }}>
                      <span style={chip(done?"#dcfce7":"#fef9c3", done?"#166534":"#854d0e")}>{done?"✅ Done":"⏳ Pending"}</span>
                    </td>
                    <td style={{ padding:"14px 16px", fontWeight:700, color: typeof score==="number" ? (score>=80?"#16a34a":"#dc2626") : "#94a3b8" }}>
                      {typeof score==="number" ? `${score}%` : "—"}
                    </td>
                    <td style={{ padding:"14px 16px" }}>
                      {canTakeTests ? (
                        typeof score === "number" ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span
                              title={score >= 80 ? "Passed" : "Failed"}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "5px 10px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 900,
                                background: score >= 80 ? "#dcfce7" : "#fee2e2",
                                color: score >= 80 ? "#15803d" : "#b91c1c",
                                border: `1px solid ${score >= 80 ? "#bbf7d0" : "#fecaca"}`,
                              }}
                            >
                              {score}% · {score >= 80 ? "Passed" : "Failed"}
                            </span>
                            <Link href={`/role/${encodeURIComponent(roleName)}/test/${encodeURIComponent(s.skillName)}`} style={{ textDecoration:"none" }}>
                              <button style={{ padding:"5px 12px", borderRadius:7, background:"#f1f5f9", color:"#0f172a", border:"1px solid #e2e8f0", cursor:"pointer", fontWeight:800, fontSize:12 }}>
                                🔄 Retake
                              </button>
                            </Link>
                          </div>
                        ) : (
                          <Link href={`/role/${encodeURIComponent(roleName)}/test/${encodeURIComponent(s.skillName)}`} style={{ textDecoration:"none" }}>
                            <button style={{ padding:"5px 12px", borderRadius:7, background:"#ede9fe", color:"#5b21b6", border:"none", cursor:"pointer", fontWeight:700, fontSize:12 }}>
                              🧠 Take test
                            </button>
                          </Link>
                        )
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8" }}>Blocked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
        <Link href={inManagerTrack ? "/dashboard/manager" : `/role/${encodeURIComponent(roleName)}`} style={{ textDecoration:"none" }}>
          <button style={{
            padding:"10px 20px", borderRadius:10,
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            color:"white", border:"none", cursor:"pointer", fontWeight:800,
            boxShadow:"0 6px 18px -8px rgba(99,102,241,0.6)",
          }}>
            {inManagerTrack ? "← Back to dashboard" : "← Back to Role"}
          </button>
        </Link>
        {prep?.isActive && !inManagerTrack && (
          <button
            onClick={async () => {
              if (!confirm("Leave this preparation? Your progress will be lost and the chart will be unlocked.")) return;
              setLeaving(true);
              const res = await fetch(
                `${API}/api/role-preparation/${encodeURIComponent(roleName)}?studentId=${encodeURIComponent(userId)}`,
                { method: "DELETE" }
              );
              router.push(`/role/${encodeURIComponent(roleName)}`);
            }}
            disabled={leaving}
            style={{ padding:"10px 20px", borderRadius:10, background:"#fef2f2", color:"#dc2626", border:"1.5px solid #fca5a5", cursor:"pointer", fontWeight:800 }}
          >
            {leaving ? "Leaving…" : "🚪 Leave Preparation"}
          </button>
        )}
      </div>

      {/* footer */}
      <div style={{
        marginTop: 28,
        borderRadius: 20,
        padding: "20px 24px",
        background: "linear-gradient(135deg,#0f172a 0%,#312e81 50%,#581c87 100%)",
        color: "white",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 10px 30px -16px rgba(15,23,42,0.6)",
      }}>
        <div style={{ position:"absolute", top:-40, right:-30, width:160, height:160, borderRadius:"50%", background:"rgba(168,85,247,0.25)", filter:"blur(2px)" }} />
        <div style={{ position:"absolute", bottom:-50, right:80, width:120, height:120, borderRadius:"50%", background:"rgba(236,72,153,0.18)" }} />

        <div style={{ position:"relative", display:"flex", justifyContent:"space-between", gap:16, flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{
              width:40, height:40, borderRadius:12,
              background:"rgba(255,255,255,0.15)",
              border:"1px solid rgba(255,255,255,0.25)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:20,
            }}>🚀</div>
            <div>
              <div style={{ fontWeight:900, fontSize:15 }}>Saarthi · Career Preparation</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>Track skills, take tests, and grow into the role you want.</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <span style={{
              display:"inline-flex", alignItems:"center", gap:8,
              padding:"6px 12px", borderRadius:999,
              background:"rgba(255,255,255,0.14)",
              border:"1px solid rgba(255,255,255,0.25)",
              fontSize:12, fontWeight:700,
            }}>
              {prep?.isActive ? "🟢 Preparation active" : "⚪ Not preparing yet"}
            </span>
            <span style={{
              display:"inline-flex", alignItems:"center", gap:8,
              padding:"6px 12px", borderRadius:999,
              background:"rgba(255,255,255,0.14)",
              border:"1px solid rgba(255,255,255,0.25)",
              fontSize:12, fontWeight:700,
            }}>
              📅 {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
