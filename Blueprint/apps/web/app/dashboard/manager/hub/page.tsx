"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getOrgAuthFromStorage, clearOrgAuthInStorage, isOrgManagerOrHr } from "@/lib/orgAuth";
import { apiUrl, appPath } from "@/lib/apiBase";
import { buildInterviewXIndustryOpenUrl } from "@/lib/interviewx";

// ─── Types ───────────────────────────────────────────────────────────────────

type InterviewTotals = {
  scheduled: number; pending: number; appeared: number;
  completed: number; passed: number; failed: number; maybe: number; expired: number;
};
type HiringBreakdown = { MUST_HIRE: number; HIRE: number; MAYBE: number; NO_HIRE: number };
type MonthlyPoint = { month: string; count: number };
type RecentInterview = {
  candidateName: string; candidateEmail: string; status: string;
  scheduledAt: string; score: number | null; hiringRecommendation: string | null;
};
type InterviewAnalytics = {
  totals: InterviewTotals; hiringBreakdown: HiringBreakdown;
  monthlyTrend: MonthlyPoint[]; recentInterviews: RecentInterview[];
};

type LearningTotals = {
  employees: number; activelyPreparing: number; avgProgressPct: number; skillTestPassRate: number;
};
type RoleDistItem = { role: string; count: number };
type PersonItem = { id: string; name: string; email: string; avgPct: number; role: string };
type ProgressBands = { "0-25": number; "25-50": number; "50-75": number; "75-100": number };
type ActiveLearner = {
  id: string; name: string; email: string; avgPct: number;
  roles: { roleName: string; pct: number }[];
  latestTestPassed: boolean | null; latestTestScore: number | null;
};
type LearningAnalytics = {
  totals: LearningTotals; roleDistribution: RoleDistItem[];
  topPerformers: PersonItem[]; needsAttention: PersonItem[];
  progressBands: ProgressBands; recentActivity: ActiveLearner[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hi = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString());
const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}%`);

function scoreColor(s: number | null) {
  if (s == null) return "#64748b";
  return s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";
}
function recColor(r: string | null) {
  return r === "MUST_HIRE" ? "#10b981" : r === "HIRE" ? "#3b82f6" : r === "MAYBE" ? "#f59e0b" : r === "NO_HIRE" ? "#ef4444" : "#94a3b8";
}
function recLabel(r: string | null) {
  return r === "MUST_HIRE" ? "Must Hire" : r === "HIRE" ? "Hire" : r === "MAYBE" ? "Maybe" : r === "NO_HIRE" ? "No Hire" : "—";
}
function statusBadge(s: string): React.CSSProperties {
  const base: React.CSSProperties = { display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 };
  return s === "COMPLETED" ? { ...base, background: "#dcfce7", color: "#166534" }
    : s === "IN_PROGRESS" ? { ...base, background: "#dbeafe", color: "#1e40af" }
    : s === "EXPIRED" ? { ...base, background: "#fee2e2", color: "#991b1b" }
    : { ...base, background: "#f1f5f9", color: "#475569" };
}
function statusLabel(s: string) {
  return s === "COMPLETED" ? "Completed" : s === "IN_PROGRESS" ? "In Progress" : s === "EXPIRED" ? "Expired" : "Pending";
}
function fmtDate(raw: string) {
  if (!raw) return "—";
  try { const d = new Date(raw); return isNaN(d.getTime()) ? raw : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return raw; }
}
function progressColor(p: number) {
  return p >= 75 ? "#10b981" : p >= 50 ? "#3b82f6" : p >= 25 ? "#f59e0b" : "#ef4444";
}

async function fetchJson<T>(path: string, token: string): Promise<T> {
  const url = path.startsWith("http") ? path : apiUrl(path);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    if (res.status === 401) {
      clearOrgAuthInStorage();
      if (typeof window !== "undefined") {
        window.location.href = appPath("/auth/manager/login");
      }
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── SVG Donut Chart ─────────────────────────────────────────────────────────

function DonutChart({ data, size = 140 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - 28) / 2;
  const cx = size / 2, cy = size / 2;
  if (total === 0) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={20} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={14} fill="#94a3b8" fontWeight={700}>0</text>
      </svg>
      <span style={{ fontSize: 11, color: "#94a3b8" }}>No data yet</span>
    </div>
  );
  let cum = 0;
  const circ = 2 * Math.PI * r;
  const segs = data.map((d) => {
    const v = d.value / total;
    const seg = { ...d, dash: circ * v, offset: circ * (1 - cum) };
    cum += v; return seg;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={20} />
      {segs.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={20}
          strokeDasharray={`${s.dash} ${circ - s.dash}`} strokeDashoffset={s.offset} strokeLinecap="round" />
      ))}
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize={18} fill="#0f172a" fontWeight={800}
        style={{ transform: "rotate(90deg)", transformOrigin: `${cx}px ${cy}px` }}>{total}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize={9} fill="#64748b" fontWeight={600}
        style={{ transform: "rotate(90deg)", transformOrigin: `${cx}px ${cy}px` }}>Total</text>
    </svg>
  );
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────

function BarChart({ data, color = "#6366f1" }: { data: MonthlyPoint[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 104, paddingBottom: 20 }}>
      {data.map((d, i) => {
        const h = Math.max((d.count / max) * 80, d.count > 0 ? 4 : 2);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div title={`${d.month}: ${d.count}`} style={{ width: "100%", height: h, background: d.count > 0 ? color : "#e2e8f0", borderRadius: "4px 4px 0 0", transition: "height 0.4s ease" }} />
            <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>{d.month}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, max, color, label, count }: { value: number; max: number; color: string; label: string; count: number }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span style={{ width: 60, fontSize: 12, color: "#475569", fontWeight: 600 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ width: 28, fontSize: 12, color: "#0f172a", fontWeight: 700, textAlign: "right" }}>{count}</span>
      <span style={{ width: 34, fontSize: 11, color: "#94a3b8", textAlign: "right" }}>{w}%</span>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent, icon }: { label: string; value: string | number; sub?: string; accent: string; icon: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", borderLeft: `4px solid ${accent}`, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 22, opacity: 0.6 }}>{icon}</div>
      </div>
    </div>
  );
}

// ─── Split Dropdown Button ────────────────────────────────────────────────────

type DropdownOption = { label: string; sub?: string; icon: string; href: string; external?: boolean; color?: string };

function SplitButton({ label, icon, bg, options }: { label: string; icon: string; bg: string; options: DropdownOption[] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 6, left: r.left });
    }
    setOpen((o) => !o);
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{ background: bg, color: "#fff", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", border: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        {icon} {label} <span style={{ fontSize: 10, opacity: 0.8 }}>▾</span>
      </button>
      {open && (
        <div
          ref={dropRef}
          style={{
            position: "fixed", top: coords.top, left: coords.left,
            background: "#fff", border: "1px solid #e2e8f0",
            borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.16)", zIndex: 9999, minWidth: 260, overflow: "hidden",
          }}
        >
          {options.map((opt, i) => (
            <a
              key={i}
              href={opt.href}
              onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", textDecoration: "none",
                borderBottom: i < options.length - 1 ? "1px solid #f1f5f9" : "none",
                background: "#fff",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: (opt.color || bg) + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {opt.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{opt.label}</div>
                {opt.sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{opt.sub}</div>}
              </div>
              {opt.external && <span style={{ fontSize: 12, color: "#94a3b8" }}>↗</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ManagerHubPage() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string>("");
  const [ixData, setIxData] = useState<InterviewAnalytics | null>(null);
  const [learnData, setLearnData] = useState<LearningAnalytics | null>(null);
  const [ixLoading, setIxLoading] = useState(true);
  const [learnLoading, setLearnLoading] = useState(true);
  const [ixError, setIxError] = useState("");
  const [learnError, setLearnError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ixDashboardUrl = buildInterviewXIndustryOpenUrl();

  const loadData = useCallback(async (tok: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else { setIxLoading(true); setLearnLoading(true); }
    const [ixRes, learnRes] = await Promise.allSettled([
      fetchJson<InterviewAnalytics>("/api/interviewx/manager-analytics", tok),
      fetchJson<LearningAnalytics>("/api/org-auth/manager-hub-analytics", tok),
    ]);
    if (ixRes.status === "fulfilled") { setIxData(ixRes.value); setIxError(""); }
    else setIxError("Could not load interview data");
    if (learnRes.status === "fulfilled") { setLearnData(learnRes.value); setLearnError(""); }
    else setLearnError("Could not load learning data");
    setIxLoading(false); setLearnLoading(false); setRefreshing(false);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    const { token: tok, user: u } = getOrgAuthFromStorage();
    if (!tok || !u) { window.location.href = appPath("/auth/manager/login"); return; }
    if (!isOrgManagerOrHr(u)) {
      window.location.href = appPath("/auth/manager/login"); return;
    }
    setUser(u); setToken(tok); loadData(tok);
  }, [loadData]);

  useEffect(() => {
    if (!token) return;
    timerRef.current = setInterval(() => loadData(token, true), 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [token, loadData]);

  const ix = ixData;
  const lrn = learnData;
  const hours = new Date().getHours();
  const greeting = hours < 12 ? "Good morning" : hours < 17 ? "Good afternoon" : "Good evening";
  const donutData = ix ? [
    { label: "Must Hire", value: ix.hiringBreakdown.MUST_HIRE, color: "#10b981" },
    { label: "Hire", value: ix.hiringBreakdown.HIRE, color: "#3b82f6" },
    { label: "Maybe", value: ix.hiringBreakdown.MAYBE, color: "#f59e0b" },
    { label: "No Hire", value: ix.hiringBreakdown.NO_HIRE, color: "#ef4444" },
  ] : [];
  const maxRoleCount = lrn ? Math.max(...lrn.roleDistribution.map((r) => r.count), 1) : 1;
  const maxBandCount = lrn ? Math.max(lrn.progressBands["0-25"], lrn.progressBands["25-50"], lrn.progressBands["50-75"], lrn.progressBands["75-100"], 1) : 1;

  const scheduleOptions: DropdownOption[] = [
    { label: "Internal Employees", sub: "Schedule AI interview for your team", icon: "👨‍💼", href: appPath("/dashboard/manager/interviews"), color: "#6366f1" },
    { label: "External Candidates", sub: "Open InterviewX manager dashboard", icon: "🌐", href: ixDashboardUrl, color: "#0ea5e9" },
  ];
  const viewInterviewsOptions: DropdownOption[] = [
    { label: "Internal Interviews", sub: "View scheduled employee interviews", icon: "📋", href: appPath("/dashboard/manager/interviews"), color: "#6366f1" },
    { label: "External Interviews", sub: "Open InterviewX manager dashboard", icon: "🔗", href: ixDashboardUrl, color: "#0ea5e9" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* ─── Hero Banner ─────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e3a5f 45%,#312e81 100%)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 260, height: 260, borderRadius: "50%", background: "rgba(99,102,241,0.15)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, left: "30%", width: 180, height: 180, borderRadius: "50%", background: "rgba(59,130,246,0.1)", pointerEvents: "none" }} />

        {/* Top nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a href={appPath("/dashboard/manager/home")} style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.55)", textDecoration: "none", letterSpacing: 0.3 }}>← Portals</a>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>•</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 0.5 }}>OVERVIEW HUB</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>•</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{user?.companyName || "—"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Loading…"}
            </span>
            <div style={{ background: refreshing ? "#f59e0b" : "#10b981", width: 8, height: 8, borderRadius: "50%" }} />
            <button onClick={() => loadData(token, true)} disabled={refreshing}
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#fff", padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {refreshing ? "…" : "↺ Refresh"}
            </button>
            <button onClick={() => { clearOrgAuthInStorage(); window.location.href = appPath("/auth/manager/login"); }}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "rgba(255,255,255,0.7)", padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Logout
            </button>
          </div>
        </div>

        {/* Greeting + stats + CTAs */}
        <div style={{ padding: "24px 24px 28px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#fff" }}>
                {(user?.fullName || "?")[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{greeting}, {user?.fullName?.split(" ")[0] || "—"}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>{user?.currentRole} · {user?.department || "All departments"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: "Interviews Scheduled", value: ix ? hi(ix.totals.scheduled) : "…", icon: "📋" },
                { label: "Candidates Appeared", value: ix ? hi(ix.totals.appeared) : "…", icon: "👥" },
                { label: "Employees Learning", value: lrn ? hi(lrn.totals.activelyPreparing) : "…", icon: "📚" },
                { label: "Avg Progress", value: lrn ? pct(lrn.totals.avgProgressPct) : "…", icon: "📈" },
              ].map((s) => (
                <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "10px 16px", minWidth: 120, backdropFilter: "blur(8px)" }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{s.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600, marginTop: 1 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA strip with split buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap", alignItems: "center" }}>
            <a href={appPath("/dashboard/manager")} style={solidBtn("#6366f1")}>👨‍💼 View Employees</a>
            <SplitButton label="Schedule Interview" icon="📅" bg="#0ea5e9" options={scheduleOptions} />
            <a href={ixDashboardUrl} style={solidBtn("#8b5cf6")}>🔗 InterviewX Dashboard</a>
          </div>
        </div>
      </div>

      {/* ─── Main Content Grid ─────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* ════ LEFT — Interview Analytics ════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionHeader accent="linear-gradient(#6366f1,#8b5cf6)" title="Interview Analytics" sub="— from InterviewX" />

          {ixLoading ? <LoadingCard label="Loading interview data…" />
            : ixError ? <ErrorCard msg={ixError} />
            : ix ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <KpiCard label="Total Scheduled" value={hi(ix.totals.scheduled)} icon="📋" accent="#6366f1" sub="All time" />
                <KpiCard label="Appeared" value={hi(ix.totals.appeared)} icon="👤" accent="#3b82f6" sub={`${ix.totals.completed} completed`} />
                <KpiCard label="Pending" value={hi(ix.totals.pending)} icon="⏳" accent="#f59e0b" sub="Awaiting interview" />
                <KpiCard label="Passed (Hire)" value={hi(ix.totals.passed)} icon="✅" accent="#10b981" sub={`${ix.totals.failed} not hired`} />
              </div>

              {/* Status strip */}
              <div style={card}>
                <CardTitle>Status Breakdown</CardTitle>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "Pending", val: ix.totals.pending, color: "#f59e0b" },
                    { label: "In Progress", val: Math.max(ix.totals.appeared - ix.totals.completed, 0), color: "#3b82f6" },
                    { label: "Completed", val: ix.totals.completed, color: "#10b981" },
                    { label: "Expired", val: ix.totals.expired, color: "#ef4444" },
                    { label: "Maybe", val: ix.totals.maybe, color: "#8b5cf6" },
                  ].map((s) => (
                    <div key={s.label} style={{ background: "#f8fafc", border: `1px solid ${s.color}30`, borderRadius: 8, padding: "6px 10px", textAlign: "center", flex: 1, minWidth: 70 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.val}</div>
                      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly trend */}
              <div style={card}>
                <CardTitle>Monthly Interview Trend</CardTitle>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>Interviews scheduled — last 6 months</div>
                <BarChart data={ix.monthlyTrend} color="#6366f1" />
              </div>

              {/* Hiring donut */}
              <div style={card}>
                <CardTitle>Hiring Recommendations</CardTitle>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <DonutChart data={donutData} size={130} />
                  <div style={{ flex: 1 }}>
                    {donutData.map((d) => (
                      <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#475569", flex: 1 }}>{d.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{d.value}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8", width: 36, textAlign: "right" }}>
                          {ix.totals.completed > 0 ? `${Math.round((d.value / Math.max(ix.totals.completed, 1)) * 100)}%` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent interviews */}
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <CardTitle noMargin>Recent Interviews</CardTitle>
                  <SplitButton label="View All" icon="📋" bg="#6366f1" options={viewInterviewsOptions} />
                </div>
                {ix.recentInterviews.length === 0 ? (
                  <div style={{ padding: "16px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No interviews scheduled yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {ix.recentInterviews.slice(0, 6).map((ri, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < 5 ? "1px solid #f1f5f9" : "none" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff", flexShrink: 0 }}>
                          {(ri.candidateName || "?")[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ri.candidateName || ri.candidateEmail}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDate(ri.scheduledAt)}</div>
                        </div>
                        <span style={statusBadge(ri.status)}>{statusLabel(ri.status)}</span>
                        {ri.score != null && <span style={{ fontSize: 12, fontWeight: 800, color: scoreColor(ri.score), background: scoreColor(ri.score) + "18", borderRadius: 6, padding: "2px 6px" }}>{ri.score}</span>}
                        {ri.hiringRecommendation && <span style={{ fontSize: 10, fontWeight: 700, color: recColor(ri.hiringRecommendation), background: recColor(ri.hiringRecommendation) + "18", borderRadius: 6, padding: "2px 6px" }}>{recLabel(ri.hiringRecommendation)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* InterviewX Dashboard CTA — matches the style shown by the user */}
              <div style={{ background: "linear-gradient(135deg,#ede9fe,#ddd6fe)", border: "1px solid #c4b5fd", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#4c1d95" }}>View Interview Dashboard on InterviewX</div>
                  <div style={{ fontSize: 12, color: "#6d28d9", marginTop: 2 }}>Manage external candidates, reports & AI assessments</div>
                </div>
                <a href={ixDashboardUrl}
                  style={{ background: "#7c3aed", color: "#fff", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Open InterviewX
                </a>
              </div>
            </>
          ) : null}
        </div>

        {/* ════ RIGHT — Candidate Development ════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionHeader accent="linear-gradient(#10b981,#059669)" title="Candidate Development" sub="— learning analytics" />

          {learnLoading ? <LoadingCard label="Loading learning data…" />
            : learnError ? <ErrorCard msg={learnError} />
            : lrn ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <KpiCard label="Total Employees" value={hi(lrn.totals.employees)} icon="👥" accent="#10b981" />
                <KpiCard label="Actively Preparing" value={hi(lrn.totals.activelyPreparing)} icon="📚" accent="#6366f1"
                  sub={`${lrn.totals.employees > 0 ? Math.round((lrn.totals.activelyPreparing / lrn.totals.employees) * 100) : 0}% of team`} />
                <KpiCard label="Avg Progress" value={pct(lrn.totals.avgProgressPct)} icon="📊" accent="#3b82f6" sub="Across active plans" />
                <KpiCard label="Test Pass Rate" value={pct(lrn.totals.skillTestPassRate)} icon="🎯" accent="#f59e0b" sub="Skill tests" />
              </div>

              {/* Progress distribution */}
              <div style={card}>
                <CardTitle>Progress Distribution</CardTitle>
                {[
                  { label: "0–25%", count: lrn.progressBands["0-25"], color: "#ef4444" },
                  { label: "25–50%", count: lrn.progressBands["25-50"], color: "#f59e0b" },
                  { label: "50–75%", count: lrn.progressBands["50-75"], color: "#3b82f6" },
                  { label: "75–100%", count: lrn.progressBands["75-100"], color: "#10b981" },
                ].map((b) => (
                  <ProgressBar key={b.label} label={b.label} value={b.count} max={maxBandCount} color={b.color} count={b.count} />
                ))}
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Active learners only</div>
              </div>

              {/* Role distribution */}
              {lrn.roleDistribution.length > 0 && (
                <div style={card}>
                  <CardTitle>Top Preparation Roles</CardTitle>
                  {lrn.roleDistribution.map((r, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: `hsl(${(i * 51) % 360},65%,55%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 800, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <span style={{ flex: 1, fontSize: 12, color: "#0f172a", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.role}>{r.role}</span>
                      <div style={{ width: 80, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${Math.round((r.count / maxRoleCount) * 100)}%`, height: "100%", background: `hsl(${(i * 51) % 360},65%,55%)`, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", width: 24, textAlign: "right" }}>{r.count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Live Activity Feed */}
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 0 2px #d1fae5" }} />
                  <CardTitle noMargin>Live Activity</CardTitle>
                  <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 2 }}>— currently preparing</span>
                </div>
                {lrn.recentActivity.length === 0 ? (
                  <div style={{ padding: "12px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No active preparation yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {lrn.recentActivity.map((emp, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < lrn.recentActivity.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `hsl(${(emp.name.charCodeAt(0) * 7) % 360},60%,55%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff", flexShrink: 0 }}>
                          {(emp.name || "?")[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emp.name || emp.email}</div>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                            {emp.roles.slice(0, 2).map((r, ri) => (
                              <span key={ri} style={{ fontSize: 10, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "1px 6px", color: "#475569", fontWeight: 600 }}>
                                {r.roleName}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: progressColor(emp.avgPct) }}>{pct(emp.avgPct)}</span>
                          <div style={{ width: 52, height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${emp.avgPct}%`, height: "100%", background: progressColor(emp.avgPct), borderRadius: 2, transition: "width 0.5s ease" }} />
                          </div>
                        </div>
                        {emp.latestTestPassed != null && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: emp.latestTestPassed ? "#dcfce7" : "#fee2e2", color: emp.latestTestPassed ? "#166534" : "#991b1b", borderRadius: 6, padding: "2px 6px" }}>
                            {emp.latestTestPassed ? "✓ Test" : "✗ Test"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top performers + Needs attention */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#10b981", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>🏆 Top Performers</div>
                  {lrn.topPerformers.length === 0
                    ? <div style={{ fontSize: 12, color: "#94a3b8" }}>No active prep yet.</div>
                    : lrn.topPerformers.map((p, i) => <PeopleRow key={i} person={p} accent="#10b981" />)}
                </div>
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>⚠️ Needs Attention</div>
                  {lrn.needsAttention.length === 0
                    ? <div style={{ fontSize: 12, color: "#94a3b8" }}>Everyone is on track!</div>
                    : lrn.needsAttention.map((p, i) => <PeopleRow key={i} person={p} accent="#f59e0b" />)}
                </div>
              </div>

              {/* CTA to employees dashboard */}
              <div style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #bbf7d0", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#166534" }}>View Detailed Employee Progress</div>
                  <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>Skill tests, role analytics & activity feed</div>
                </div>
                <a href={appPath("/dashboard/manager")} style={{ background: "#16a34a", color: "#fff", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>
                  View Employees →
                </a>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SectionHeader({ accent, title, sub }: { accent: string; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 4, height: 20, borderRadius: 2, background: accent }} />
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{title}</h2>
      <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{sub}</span>
    </div>
  );
}

function CardTitle({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: noMargin ? 0 : 10, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</div>;
}

function PeopleRow({ person, accent }: { person: PersonItem; accent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: accent + "22", border: `2px solid ${accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: accent, flexShrink: 0 }}>
        {(person.name || "?")[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name || person.email}</div>
        <div style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.role}</div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 900, color: accent }}>{pct(person.avgPct)}</span>
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "28px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⟳</div>
      <div style={{ fontSize: 13, color: "#94a3b8" }}>{label}</div>
    </div>
  );
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 14, padding: "16px 20px" }}>
      <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>⚠️ {msg}</div>
      <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 4 }}>Check that the service is reachable and try refreshing.</div>
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px" };
const solidBtn = (bg: string): React.CSSProperties => ({
  background: bg, color: "#fff", borderRadius: 10, padding: "8px 16px", fontSize: 13,
  fontWeight: 800, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
});
