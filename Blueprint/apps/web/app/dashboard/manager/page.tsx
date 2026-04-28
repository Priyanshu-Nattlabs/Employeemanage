"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getOrgAuthFromStorage,
  orgGetEmployeesActivity,
  orgListEmployeesManagerSummary,
  orgManagerBulkInviteEmployees,
  type OrgBulkInviteResult,
  type OrgManagerActivity,
} from "@/lib/orgAuth";
import { SiteFooter } from "@/app/components/SiteFooter";

type EmployeeRow = {
  employee: any;
  ongoing: Array<{ roleName: string; pct: number; startedAt?: string | null }>;
  avgPct: number;
  latestTest: { roleName?: string; skillName?: string; score?: number | null; passed?: boolean; completedAt?: string | null } | null;
};

const REFRESH_MS = 30_000;
const ACTIVITY_FEED_PREVIEW = 5;
const LEADERBOARD_PREVIEW = 3;
const DEPARTMENT_COMPARE_PREVIEW = 6;

export default function ManagerDashboardPage() {
  const [{ token, user }, setAuth] = useState<{ token: string; user: any | null }>({ token: "", user: null });
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [activity, setActivity] = useState<OrgManagerActivity | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "NOT_STARTED">("ALL");
  const [sortKey, setSortKey] = useState<"NAME" | "PROGRESS_DESC" | "PROGRESS_ASC" | "RECENT_TEST">("PROGRESS_DESC");

  const [inviteFile, setInviteFile] = useState<File | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteResult, setInviteResult] = useState<OrgBulkInviteResult | null>(null);

  // Success banner shown after a recommendation has been sent (we redirect back here).
  const router = useRouter();
  const searchParams = useSearchParams();
  const recommendedRole = searchParams?.get("recommended") || "";
  const recommendedFor = searchParams?.get("for") || "";
  const [recoBanner, setRecoBanner] = useState<{ role: string; employee: string } | null>(null);
  useEffect(() => {
    if (recommendedRole) {
      setRecoBanner({ role: recommendedRole, employee: recommendedFor });
      // Clear query string so the banner doesn't re-appear on refresh.
      router.replace("/dashboard/manager");
      const t = window.setTimeout(() => setRecoBanner(null), 8000);
      return () => window.clearTimeout(t);
    }
  }, [recommendedRole, recommendedFor, router]);

  const openRecommendFlow = (e: any) => {
    const params = new URLSearchParams();
    params.set("recommendFor", String(e?._id || e?.id || ""));
    if (e?.fullName) params.set("recommendName", String(e.fullName));
    if (e?.email) params.set("recommendEmail", String(e.email));
    if (e?.department) params.set("recommendDept", String(e.department));
    router.push(`/role?${params.toString()}`);
  };

  useEffect(() => {
    const onChange = () => setAuth(getOrgAuthFromStorage());
    setMounted(true);
    onChange();
    window.addEventListener("jbv2-org-auth-changed", onChange);
    return () => window.removeEventListener("jbv2-org-auth-changed", onChange);
  }, []);

  useEffect(() => {
    if (mounted && !token) window.location.href = "/auth/manager/login";
  }, [mounted, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchAll = async (silent = false) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const [summary, act] = await Promise.all([
          orgListEmployeesManagerSummary(token),
          orgGetEmployeesActivity(token),
        ]);
        if (cancelled) return;
        setRows(Array.isArray(summary) ? summary : []);
        setActivity(act || null);
        setLastRefreshed(new Date());
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load dashboard");
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    };
    void fetchAll();
    const id = window.setInterval(() => void fetchAll(true), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [token]);

  const isHR = user?.currentRole === "HR";
  const myDepartment: string = (user?.department || "").trim();
  const scopeLabel = isHR ? "All departments (HR)" : myDepartment ? `${myDepartment} department` : "Your department";

  // ==== Aggregations / comparison stats ====
  const stats = useMemo(() => computeStats(rows), [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => {
      const e = r.employee || {};
      const ongoing = Array.isArray(r.ongoing) ? r.ongoing : [];
      if (statusFilter === "ACTIVE" && ongoing.length === 0) return false;
      if (statusFilter === "NOT_STARTED" && ongoing.length > 0) return false;
      if (!q) return true;
      const hay = [e.fullName, e.email, e.designation, e.department, e.employeeId]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });

    out = out.slice().sort((a, b) => {
      switch (sortKey) {
        case "NAME":
          return String(a.employee?.fullName || "").localeCompare(String(b.employee?.fullName || ""));
        case "PROGRESS_ASC":
          return (a.avgPct || 0) - (b.avgPct || 0);
        case "RECENT_TEST": {
          const ad = a.latestTest?.completedAt ? new Date(a.latestTest.completedAt).getTime() : 0;
          const bd = b.latestTest?.completedAt ? new Date(b.latestTest.completedAt).getTime() : 0;
          return bd - ad;
        }
        case "PROGRESS_DESC":
        default:
          return (b.avgPct || 0) - (a.avgPct || 0);
      }
    });

    return out;
  }, [rows, query, statusFilter, sortKey]);

  if (!mounted) return null;
  if (!user) return null;

  const firstName = (user.fullName || "").trim().split(/\s+/)[0] || (user.email ? String(user.email).split("@")[0] : "there");
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();
  const initials = (() => {
    const fn = (user.fullName || user.email || "").trim();
    if (!fn) return "U";
    const parts = fn.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || (fn[0] || "U").toUpperCase();
  })();

  return (
    <div style={wrap}>
      {recoBanner ? (
        <div style={recoBannerStyle}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#065f46" }}>
              Role recommendation sent
            </div>
            <div style={{ fontSize: 12, color: "#047857", marginTop: 2 }}>
              <b>{recoBanner.role}</b>
              {recoBanner.employee ? <> has been suggested to <b>{recoBanner.employee}</b></> : null}
              . They'll see a notification on their portal.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRecoBanner(null)}
            aria-label="Dismiss"
            style={{ background: "transparent", border: "none", color: "#065f46", fontWeight: 900, fontSize: 18, cursor: "pointer", padding: 4 }}
          >×</button>
        </div>
      ) : null}
      {/* Soft page-level tinted background */}
      <div aria-hidden style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        background: "radial-gradient(900px 500px at 100% -10%, rgba(99,102,241,0.07), transparent 60%), radial-gradient(700px 400px at -10% 10%, rgba(14,165,233,0.06), transparent 60%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
        pointerEvents: "none",
      }} />

      {/* ─── Hero banner (matches /dashboard/manager/track/[role] banner) ─── */}
      <div style={banner}>
        <div style={blobA} />
        <div style={blobB} />

        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 240px", maxWidth: "100%" }}>
            <div style={iconTile} title={user.fullName || user.email}>{initials}</div>
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <div style={breadcrumb}>
                <span style={crumbCur}>Dashboard</span>
                <span style={crumbSep}>›</span>
                <span style={crumbCur}>{isHR ? "HR view" : "Manager view"}</span>
                <span style={crumbSep}>›</span>
                <span style={crumbCur}>{scopeLabel}</span>
              </div>
              <h1 style={bannerTitle}>
                {greeting}, <span style={{ color: "#fef3c7" }}>{firstName}</span> <span style={{ marginLeft: 4 }}>👋</span>
              </h1>
              <div style={bannerSub}>
                {isHR ? "HR view · " : "Manager view · "}
                Viewing <b style={{ color: "#fff" }}>{scopeLabel}</b>
                <span style={{ opacity: 0.6 }}> · {stats.total} employees · {stats.active} actively preparing</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flex: "0 1 auto", minWidth: 0, justifyContent: "flex-end" }}>
            <span style={chipManager}>{isHR ? "HR view" : "Manager view"}</span>
            {lastRefreshed ? (
              <span style={chipLive}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                Live · {lastRefreshed.toLocaleTimeString()}
              </span>
            ) : null}
            <button
              onClick={() => window.location.reload()}
              style={btnSolid}
              title="Refresh"
              aria-label="Refresh"
            >↻ Refresh</button>
          </div>
        </div>
      </div>

      {error ? <div style={errorStyle}>{error}</div> : null}

      {/* KPI cards */}
      <div className="manager-kpi-grid">
        <KpiCard label="Employees"           value={String(stats.total)}                                hint={isHR ? "All departments" : myDepartment || "Your department"} icon="👥" accent="#3b82f6" />
        <KpiCard label="Actively preparing"  value={`${stats.active}`}                                  hint={`${stats.activePct}% of team`}                                  icon="🔥" accent="#16a34a" />
        <KpiCard label="Average progress"    value={`${stats.avgProgress}%`}                            hint="Across active prep plans"                                       icon="📈" accent="#8b5cf6" />
        <KpiCard label="Avg. test score"     value={stats.avgScore == null ? "—" : `${stats.avgScore}%`} hint={`${stats.testCount} tests recorded`}                           icon="🎯" accent="#f97316" />
      </div>

      {/* Comparison + Distribution */}
      <div className="manager-two-col">
        <div style={{ ...card, minWidth: 0, maxWidth: "100%" }}>
          <div style={cardTitle}><span style={titleIcon("#6366f1")}>📊</span>Progress distribution</div>
          <div style={cardSub}>How active learners are spread across progress bands.</div>
          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {stats.buckets.map((b) => (
              <BucketBar key={b.label} label={b.label} count={b.count} total={Math.max(stats.active, 1)} color={b.color} />
            ))}
            {stats.active === 0 ? (
              <div style={emptyHint}>No active learners yet — once employees start a role, you'll see the distribution here.</div>
            ) : null}
          </div>
        </div>

        <div style={{ ...card, minWidth: 0, maxWidth: "100%" }}>
          <div style={cardTitle}>
            <span style={titleIcon("#3b82f6")}>{isHR ? "🏢" : "🏆"}</span>
            {isHR ? "Department comparison" : "Top vs. lagging in your team"}
          </div>
          <div style={cardSub}>
            {isHR
              ? "Average preparation progress per department."
              : "Quickly spot top performers and those who need a nudge."}
          </div>

          {isHR ? (
            <DepartmentCompare rows={rows} />
          ) : (
            <TopVsLagging rows={rows} />
          )}
        </div>
      </div>

      {/* Engagement strip */}
      <EngagementStrip activity={activity} />

      {/* Bulk invite (manager: dept inherited; HR: Department column per row) */}
      <div style={{ ...card, minWidth: 0, maxWidth: "100%" }}>
        <div style={cardTitle}><span style={titleIcon("#10b981")}>📤</span>Invite employees from Excel</div>
        <div style={cardSub}>
          Upload a spreadsheet with <b>Email</b> and <b>Name</b> columns (first sheet).
          {isHR ? (
            <> Each row must also include a <b>Department</b> column.</>
          ) : (
            <> New accounts are created in <b>{myDepartment || "your"}</b> department and report to you.</>
          )}{" "}
          Each person receives an email with a temporary password and must complete their profile after first login.
        </div>
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(e) => {
              setInviteResult(null);
              setInviteError("");
              const f = e.target.files?.[0] || null;
              setInviteFile(f);
            }}
            style={{ fontSize: 13 }}
          />
          <button
            type="button"
            disabled={!inviteFile || inviteLoading || !token}
            onClick={async () => {
              if (!inviteFile || !token) return;
              setInviteLoading(true);
              setInviteError("");
              setInviteResult(null);
              try {
                const r = await orgManagerBulkInviteEmployees(token, inviteFile);
                setInviteResult(r);
                void (async () => {
                  try {
                    const summary = await orgListEmployeesManagerSummary(token);
                    setRows(Array.isArray(summary) ? summary : []);
                  } catch {
                    /* ignore */
                  }
                })();
              } catch (e: any) {
                setInviteError(e?.message || "Upload failed");
              } finally {
                setInviteLoading(false);
              }
            }}
            style={{ ...btnSolid, opacity: !inviteFile || inviteLoading ? 0.6 : 1 }}
          >
            {inviteLoading ? "Uploading…" : "Upload & invite"}
          </button>
        </div>
        {inviteError ? <div style={{ ...errorStyle, marginTop: 12 }}>{inviteError}</div> : null}
        {inviteResult ? (
          <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6, color: "#0f172a" }}>
            <div style={{ fontWeight: 900, color: "#065f46" }}>
              Created {inviteResult.created} account{inviteResult.created === 1 ? "" : "s"}
            </div>
            {inviteResult.errors?.length ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 800, color: "#991b1b" }}>Row errors ({inviteResult.errors.length})</div>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#475569" }}>
                  {inviteResult.errors.slice(0, 12).map((err, i) => (
                    <li key={i}>
                      Row {err.row}
                      {err.email ? ` · ${err.email}` : ""}: {err.message}
                    </li>
                  ))}
                </ul>
                {inviteResult.errors.length > 12 ? (
                  <div style={{ color: "#64748b", marginTop: 6 }}>…and {inviteResult.errors.length - 12} more</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Trend chart + Activity feed */}
      <div className="manager-two-col">
        <div style={{ ...card, minWidth: 0, maxWidth: "100%" }}>
          <div style={cardTitle}><span style={titleIcon("#16a34a")}>📈</span>Test activity (last 14 days)</div>
          <div style={cardSub}>Daily test attempts split by pass / fail, with average score line.</div>
          <TrendChart series={activity?.dailySeries || []} />
        </div>

        <div style={{ ...card, minWidth: 0, maxWidth: "100%" }}>
          <div style={cardTitle}><span style={titleIcon("#db2777")}>⚡</span>Live activity feed</div>
          <div style={cardSub}>Latest preparation actions and test results across {isHR ? "the company" : "your department"}.</div>
          <ActivityFeed feed={activity?.activityFeed || []} />
        </div>
      </div>

      {/* Top skills + Role distribution */}
      <div className="manager-two-col">
        <div style={{ ...card, minWidth: 0, maxWidth: "100%" }}>
          <div style={cardTitle}><span style={titleIcon("#f59e0b")}>🧠</span>Skill mastery — most attempted</div>
          <div style={cardSub}>Where the team is strong and where they struggle. Pass rate is across all attempts.</div>
          <TopSkills items={activity?.topSkills || []} />
        </div>

        <div style={{ ...card, minWidth: 0, maxWidth: "100%" }}>
          <div style={cardTitle}><span style={titleIcon("#7c3aed")}>🎯</span>Roles being prepared for</div>
          <div style={cardSub}>How many active learners per role, and how far along they are.</div>
          <RoleAggregateChart items={activity?.roleAggregates || []} />
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ ...card, minWidth: 0, maxWidth: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={cardTitle}><span style={titleIcon("#0ea5e9")}>👥</span>Employee preparation database</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, designation…"
              style={{ ...inputStyle, minWidth: "min(100%, 240px)" }}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={inputStyle}>
              <option value="ALL">All employees</option>
              <option value="ACTIVE">Actively preparing</option>
              <option value="NOT_STARTED">Not started</option>
            </select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} style={inputStyle}>
              <option value="PROGRESS_DESC">Sort: progress (high → low)</option>
              <option value="PROGRESS_ASC">Sort: progress (low → high)</option>
              <option value="NAME">Sort: name (A → Z)</option>
              <option value="RECENT_TEST">Sort: recent test</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Employee", "Department", "Designation", "Active prep", "Avg progress", "Latest test", "Track", "Recommend"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 14, color: "#64748b" }}>Loading…</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 14, color: "#64748b" }}>
                  {rows.length === 0
                    ? `No employees found yet for ${scopeLabel}.`
                    : "No employees match the current filters."}
                </td></tr>
              ) : (
                filteredRows.map((r) => {
                  const e = r.employee || {};
                  const ongoing = Array.isArray(r.ongoing) ? r.ongoing : [];
                  const latest = r.latestTest;
                  const pick = ongoing.slice(0, 2);
                  const more = Math.max(0, ongoing.length - pick.length);
                  const openAnalytics = (roleName: string) => {
                    const qs = new URLSearchParams();
                    qs.set("studentId", String(e._id || e.id || ""));
                    if (e.email) qs.set("employeeEmail", String(e.email));
                    if (e.fullName) qs.set("employeeName", String(e.fullName));
                    // Manager-scoped tracking page (separate URL from /role/.../analytics, same data underneath).
                    window.open(`/dashboard/manager/track/${encodeURIComponent(roleName)}?${qs.toString()}`, "_blank", "noopener,noreferrer");
                  };
                  return (
                    <tr key={e._id || e.email} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>{e.fullName || "—"}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{e.email || "—"}</div>
                      </td>
                      <td style={td}>{e.department || <span style={{ color: "#94a3b8" }}>—</span>}</td>
                      <td style={td}>{e.designation || "—"}</td>
                      <td style={td}>{ongoing.length ? `${ongoing.length} role(s)` : <span style={{ color: "#94a3b8" }}>None</span>}</td>
                      <td style={{ ...td, minWidth: 200 }}>
                        {ongoing.length ? <ProgressBar pct={r.avgPct || 0} /> : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                      <td style={td}>
                        {latest ? (
                          <div>
                            <div style={{ fontWeight: 800 }}>{latest.skillName || "—"}</div>
                            <div style={{ fontSize: 12, color: latest.passed ? "#15803d" : "#b91c1c" }}>
                              {latest.score == null ? "—" : `${latest.score}%`} · {latest.passed ? "Passed" : "Failed"}
                            </div>
                          </div>
                        ) : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                      <td style={td}>
                        {ongoing.length === 0 ? (
                          <button disabled style={{ ...btnMini, opacity: 0.5, cursor: "not-allowed" }} title="Employee hasn’t started preparation yet">
                            View analytics
                          </button>
                        ) : (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {pick.map((o: any) => (
                              <button
                                key={o.roleName}
                                onClick={() => openAnalytics(o.roleName)}
                                style={btnMini}
                                title={`Open analytics for ${o.roleName}`}
                              >
                                {o.roleName.length > 18 ? `${o.roleName.slice(0, 18)}…` : o.roleName}
                              </button>
                            ))}
                            {more > 0 ? <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", padding: "6px 6px" }}>+{more}</span> : null}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <button
                          onClick={() => openRecommendFlow(e)}
                          style={btnRecommend}
                          title="Pick a role to recommend to this employee"
                        >
                          💡 Recommend role
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer — parent is already full-bleed; avoid a second 100vw (prevents horizontal overflow). */}
      <div style={{ width: "100%", marginTop: 28 }}>
        <SiteFooter />
      </div>
    </div>
  );
}

// ===================== Components =====================

function KpiCard({ label, value, hint, icon, accent }: { label: string; value: string; hint?: string; icon?: string; accent: string }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 18,
      padding: 18,
      display: "flex",
      alignItems: "center",
      gap: 14,
      boxShadow: "0 6px 20px -10px rgba(15,23,42,0.10)",
      position: "relative",
      overflow: "hidden",
      minWidth: 0,
      maxWidth: "100%",
    }}>
      {/* top gradient stripe */}
      <div aria-hidden style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 4,
        background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
      }} />
      {/* soft accent blob in the corner */}
      <div aria-hidden style={{
        position: "absolute", top: -36, right: -36, width: 120, height: 120, borderRadius: "50%",
        background: `${accent}12`,
        pointerEvents: "none",
      }} />

      {icon ? (
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: `linear-gradient(135deg, ${accent}26, ${accent}10)`,
          border: `1px solid ${accent}22`,
          color: accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
          flex: "0 0 auto",
          boxShadow: `0 6px 16px -8px ${accent}55`,
          position: "relative",
          zIndex: 1,
        }}>{icon}</div>
      ) : null}
      <div style={{ minWidth: 0, position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.01em" }}>{value}</div>
        <div style={{ fontSize: 13, color: "#334155", fontWeight: 800, marginTop: 6 }}>{label}</div>
        {hint ? <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, fontWeight: 600 }}>{hint}</div> : null}
      </div>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(pct)));
  const color = safe >= 75 ? "#16a34a" : safe >= 40 ? "#0b5fe8" : "#ea580c";
  return (
    <div>
      <div style={{ height: 9, background: "#f1f5f9", borderRadius: 999, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(15,23,42,0.05)" }}>
        <div style={{
          width: `${safe}%`,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          height: "100%",
          transition: "width .35s ease",
          borderRadius: 999,
        }} />
      </div>
      <div style={{ fontSize: 12, color: "#0f172a", marginTop: 4, fontWeight: 800 }}>{safe}%</div>
    </div>
  );
}

function BucketBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#0f172a", fontWeight: 800, marginBottom: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: color, boxShadow: `0 0 0 3px ${color}22` }} />
          {label}
        </span>
        <span style={{ color: "#475569", fontWeight: 700 }}>
          <b style={{ color: "#0f172a" }}>{count}</b> <span style={{ color: "#94a3b8" }}>·</span> {pct}%
        </span>
      </div>
      <div style={{ height: 12, background: "#f1f5f9", borderRadius: 999, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(15,23,42,0.04)" }}>
        <div style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          height: "100%", transition: "width .35s ease",
          borderRadius: 999,
          boxShadow: `0 1px 4px ${color}66`,
        }} />
      </div>
    </div>
  );
}

function TopVsLagging({ rows }: { rows: EmployeeRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const active = rows.filter((r) => Array.isArray(r.ongoing) && r.ongoing.length > 0);
  const sorted = active.slice().sort((a, b) => (b.avgPct || 0) - (a.avgPct || 0));
  const top = sorted.slice(0, LEADERBOARD_PREVIEW);
  const lag = sorted.slice(-LEADERBOARD_PREVIEW).reverse();
  const canExpand = sorted.length > LEADERBOARD_PREVIEW;

  if (active.length === 0) {
    return <div style={emptyHint}>No active preparation in your team yet.</div>;
  }

  if (expanded) {
    return (
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <div style={{ maxHeight: "min(70vh, 520px)", overflowY: "auto", paddingRight: 4 }}>
          <RankedList
            title="All active learners (by progress)"
            rows={sorted}
            accent="#16a34a"
            icon="🏆"
            tone="positive"
          />
        </div>
        <button type="button" onClick={() => setExpanded(false)} style={btnViewMore}>
          Show less
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
      <RankedList title="Top performers" rows={top} accent="#16a34a" icon="🏆" tone="positive" />
      {sorted.length > LEADERBOARD_PREVIEW ? (
        <RankedList title="Needs attention" rows={lag} accent="#ea580c" icon="⚠️" tone="warn" />
      ) : null}
      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={btnViewMore}
        >
          View more · all {sorted.length} active learners
        </button>
      ) : null}
    </div>
  );
}

function RankedList({
  title, rows, accent, icon, tone,
}: { title: string; rows: EmployeeRow[]; accent: string; icon?: string; tone?: "positive" | "warn" }) {
  // Medal palette for top performers, warm palette for needs-attention.
  const medals = tone === "warn"
    ? ["#ea580c", "#f97316", "#fb923c"]
    : ["#f59e0b", "#94a3b8", "#b45309"];

  return (
    <div>
      <div style={{
        fontSize: 12, fontWeight: 900, color: "#0f172a",
        letterSpacing: 0.4, textTransform: "uppercase",
        marginBottom: 8,
        display: "inline-flex", alignItems: "center", gap: 8,
      }}>
        {icon ? (
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 22, borderRadius: 8,
            background: `${accent}18`, border: `1px solid ${accent}33`,
            fontSize: 12,
          }}>{icon}</span>
        ) : null}
        {title}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r, i) => {
          const e = r.employee || {};
          const medal = medals[i] || accent;
          return (
            <div
              key={(e._id || e.email || i) + title}
              style={{
                ...rankRow,
                background: `linear-gradient(180deg, #ffffff 0%, ${accent}07 100%)`,
                borderColor: `${accent}22`,
              }}
            >
              <div style={{
                ...rankBadge,
                background: `linear-gradient(135deg, ${medal}, ${medal}cc)`,
                boxShadow: `0 4px 10px -4px ${medal}99`,
              }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.fullName || e.email || "—"}</div>
                <div style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.designation || "—"}</div>
              </div>
              <div style={{ flex: "0 1 120px", minWidth: 0, maxWidth: "42%" }}><ProgressBar pct={r.avgPct || 0} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DepartmentCompare({ rows }: { rows: EmployeeRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const groups = new Map<string, { sum: number; count: number; active: number; total: number }>();
  for (const r of rows) {
    const dept = String((r.employee?.department || "Unassigned")).trim() || "Unassigned";
    const g = groups.get(dept) || { sum: 0, count: 0, active: 0, total: 0 };
    g.total += 1;
    const ongoing = Array.isArray(r.ongoing) ? r.ongoing : [];
    if (ongoing.length > 0) {
      g.active += 1;
      g.sum += r.avgPct || 0;
      g.count += 1;
    }
    groups.set(dept, g);
  }
  const list = Array.from(groups.entries())
    .map(([dept, g]) => ({
      dept,
      avgPct: g.count > 0 ? Math.round(g.sum / g.count) : 0,
      active: g.active,
      total: g.total,
    }))
    .sort((a, b) => b.avgPct - a.avgPct);

  if (list.length === 0) {
    return <div style={emptyHint}>No employees yet.</div>;
  }

  const max = Math.max(1, ...list.map((x) => x.avgPct));
  const hasMore = list.length > DEPARTMENT_COMPARE_PREVIEW;
  const visible = expanded || !hasMore ? list : list.slice(0, DEPARTMENT_COMPARE_PREVIEW);
  const hiddenCount = list.length - DEPARTMENT_COMPARE_PREVIEW;

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      <div
        style={{
          display: "grid",
          gap: 10,
          maxHeight: expanded ? "min(70vh, 520px)" : undefined,
          overflowY: expanded ? "auto" : "visible",
          paddingRight: expanded ? 4 : 0,
        }}
      >
        {visible.map((d) => {
          const widthPct = Math.round((d.avgPct / max) * 100);
          const color = d.avgPct >= 75 ? "#16a34a" : d.avgPct >= 40 ? "#0b5fe8" : "#ea580c";
          return (
            <div key={d.dept}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
                <span>{d.dept}</span>
                <span style={{ color: "#475569", fontWeight: 700 }}>
                  {d.avgPct}% avg · {d.active}/{d.total} active
                </span>
              </div>
              <div style={{ height: 10, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${widthPct}%`, background: color, height: "100%", transition: "width .3s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={btnViewMore}
        >
          {expanded
            ? "Show less"
            : `View more · ${hiddenCount} more department${hiddenCount === 1 ? "" : "s"}`}
        </button>
      ) : null}
    </div>
  );
}

function EngagementStrip({ activity }: { activity: OrgManagerActivity | null }) {
  const e = activity?.engagement;
  const total = e?.total ?? 0;
  const a7 = e?.active7d ?? 0;
  const a30 = e?.active30d ?? 0;
  const dormant = e?.dormant ?? 0;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return (
    <div className="manager-engagement-grid">
      <EngagementCard label="Active in last 7 days"  value={`${a7}`}      sub={`${pct(a7)}% of team`}                        accent="#16a34a" icon="⚡" />
      <EngagementCard label="Active in last 30 days" value={`${a30}`}     sub={`${pct(a30)}% of team`}                       accent="#0b5fe8" icon="📅" />
      <EngagementCard label="Dormant"                value={`${dormant}`} sub={`${pct(dormant)}% no activity in 30d`}        accent="#ea580c" icon="💤" />
      <EngagementCard label="Team size"              value={`${total}`}   sub={total > 0 ? "Across visible scope" : "—"}     accent="#7c3aed" icon="👥" />
    </div>
  );
}

function EngagementCard({ label, value, sub, accent, icon }: { label: string; value: string; sub: string; accent: string; icon?: string }) {
  return (
    <div style={{
      ...engagementCard,
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 6px 18px -10px rgba(15,23,42,0.10)",
      minWidth: 0,
      maxWidth: "100%",
    }}>
      {/* gradient stripe at the top */}
      <div aria-hidden style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
      }} />
      <div aria-hidden style={{
        position: "absolute", top: -28, right: -28, width: 90, height: 90, borderRadius: "50%",
        background: `${accent}10`,
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: `linear-gradient(135deg, ${accent}26, ${accent}10)`,
          border: `1px solid ${accent}22`,
          color: accent,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 15,
          flex: "0 0 auto",
          boxShadow: `0 4px 10px -6px ${accent}66`,
        }}>{icon || "•"}</div>
        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginTop: 8, position: "relative", zIndex: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#475569", position: "relative", zIndex: 1 }}>{sub}</div>
    </div>
  );
}

function TrendChart({ series }: { series: OrgManagerActivity["dailySeries"] }) {
  if (!series || series.length === 0) {
    return <div style={emptyHint}>No test activity yet — once employees take tests, daily trends appear here.</div>;
  }
  const W = 560;
  const H = 200;
  const padX = 28;
  const padY = 24;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const maxCount = Math.max(1, ...series.map((d) => d.count));
  const barW = innerW / series.length;

  const scoresWithIdx = series.map((d, i) => ({ i, score: d.avgScore }));
  const linePoints = scoresWithIdx
    .filter((p) => p.score != null)
    .map((p) => {
      const x = padX + p.i * barW + barW / 2;
      const y = padY + innerH - ((p.score as number) / 100) * innerH;
      return { x, y, score: p.score as number };
    });

  return (
    <div style={{ marginTop: 12, overflowX: "auto" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {/* baseline */}
        <line x1={padX} y1={padY + innerH} x2={padX + innerW} y2={padY + innerH} stroke="#e2e8f0" />
        {/* gridlines (25/50/75/100) */}
        {[25, 50, 75, 100].map((g) => {
          const y = padY + innerH - (g / 100) * innerH;
          return <line key={g} x1={padX} y1={y} x2={padX + innerW} y2={y} stroke="#f1f5f9" />;
        })}

        {/* bars: passed (green) stacked on failed (red) */}
        {series.map((d, i) => {
          const totalH = (d.count / maxCount) * innerH;
          const passedH = d.count > 0 ? (d.passed / d.count) * totalH : 0;
          const failedH = totalH - passedH;
          const x = padX + i * barW + 4;
          const w = Math.max(2, barW - 8);
          const yPassed = padY + innerH - passedH;
          const yFailed = padY + innerH - passedH - failedH;
          return (
            <g key={d.date}>
              {failedH > 0 ? <rect x={x} y={yFailed} width={w} height={failedH} fill="#fecaca" rx={3} /> : null}
              {passedH > 0 ? <rect x={x} y={yPassed} width={w} height={passedH} fill="#86efac" rx={3} /> : null}
            </g>
          );
        })}

        {/* avg score line */}
        {linePoints.length > 1 ? (
          <polyline
            fill="none"
            stroke="#0b5fe8"
            strokeWidth={2}
            points={linePoints.map((p) => `${p.x},${p.y}`).join(" ")}
          />
        ) : null}
        {linePoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#0b5fe8" />
        ))}

        {/* x labels — every 2nd day */}
        {series.map((d, i) => {
          if (i % 2 !== 0) return null;
          const x = padX + i * barW + barW / 2;
          const label = d.date.slice(5); // MM-DD
          return (
            <text key={d.date + "-x"} x={x} y={H - 6} fontSize={10} textAnchor="middle" fill="#64748b">{label}</text>
          );
        })}
      </svg>

      <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
        <LegendDot color="#86efac" label="Passed" />
        <LegendDot color="#fecaca" label="Failed" />
        <LegendDot color="#0b5fe8" label="Avg score" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 10, height: 10, background: color, borderRadius: 3, display: "inline-block" }} />
      {label}
    </span>
  );
}

function ActivityFeed({ feed }: { feed: OrgManagerActivity["activityFeed"] }) {
  const [expanded, setExpanded] = useState(false);
  if (!feed || feed.length === 0) {
    return <div style={emptyHint}>No activity yet. As employees take tests or complete skills, events will appear here.</div>;
  }

  const hasMore = feed.length > ACTIVITY_FEED_PREVIEW;
  const visible = expanded || !hasMore ? feed : feed.slice(0, ACTIVITY_FEED_PREVIEW);
  const hiddenCount = feed.length - ACTIVITY_FEED_PREVIEW;

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      <div
        style={{
          display: "grid",
          gap: 8,
          maxHeight: expanded ? "min(70vh, 560px)" : 360,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {visible.map((evt, i) => {
          const meta = eventMeta(evt.type);
          return (
            <div key={i} style={feedRow}>
              <div style={{ ...feedDot, background: meta.color }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#0f172a" }}>
                  <b>{evt.employeeName}</b>{" "}
                  <span style={{ color: "#475569" }}>{meta.verb}</span>{" "}
                  {evt.skillName ? <b>{evt.skillName}</b> : null}
                  {evt.skillName && evt.roleName ? <span style={{ color: "#64748b" }}> · {evt.roleName}</span> : null}
                  {!evt.skillName && evt.roleName ? <b>{evt.roleName}</b> : null}
                  {typeof evt.score === "number" ? (
                    <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 800, color: meta.color }}>{evt.score}%</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  {evt.employeeDepartment ? <>{evt.employeeDepartment} · </> : null}
                  {timeAgo(evt.at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={btnViewMore}
        >
          {expanded ? "Show less" : `View more · ${hiddenCount} more event${hiddenCount === 1 ? "" : "s"}`}
        </button>
      ) : null}
    </div>
  );
}

function eventMeta(type: OrgManagerActivity["activityFeed"][number]["type"]): { color: string; verb: string } {
  switch (type) {
    case "TEST_PASSED": return { color: "#16a34a", verb: "passed test on" };
    case "TEST_FAILED": return { color: "#dc2626", verb: "failed test on" };
    case "SKILL_COMPLETED": return { color: "#0b5fe8", verb: "completed skill" };
    case "PREP_STARTED": return { color: "#7c3aed", verb: "started preparing for" };
    default: return { color: "#64748b", verb: "did something on" };
  }
}

function timeAgo(at: string | null | undefined): string {
  if (!at) return "—";
  const t = new Date(at).getTime();
  if (!t) return String(at);
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function TopSkills({ items }: { items: OrgManagerActivity["topSkills"] }) {
  if (!items || items.length === 0) {
    return <div style={emptyHint}>No skill tests yet.</div>;
  }
  const maxAttempts = Math.max(1, ...items.map((s) => s.attempts));
  return (
    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      {items.map((s) => {
        const attemptsW = Math.round((s.attempts / maxAttempts) * 100);
        const passColor = s.passRate >= 70 ? "#16a34a" : s.passRate >= 40 ? "#0b5fe8" : "#dc2626";
        return (
          <div key={s.name} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              <span style={{ color: passColor }}>{s.passRate}% pass</span>
            </div>
            <div style={{ height: 6, background: "#f1f5f9", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
              <div style={{ width: `${attemptsW}%`, background: "#0b5fe8", height: "100%" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginTop: 4 }}>
              <span>{s.attempts} attempt{s.attempts === 1 ? "" : "s"}</span>
              <span>{s.avgScore == null ? "" : `Avg score ${s.avgScore}%`}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoleAggregateChart({ items }: { items: OrgManagerActivity["roleAggregates"] }) {
  if (!items || items.length === 0) {
    return <div style={emptyHint}>No active role preparations yet.</div>;
  }
  const maxLearners = Math.max(1, ...items.map((r) => r.learners));
  return (
    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      {items.map((r) => {
        const lw = Math.round((r.learners / maxLearners) * 100);
        const progColor = r.avgPct >= 75 ? "#16a34a" : r.avgPct >= 40 ? "#0b5fe8" : "#ea580c";
        return (
          <div key={r.name}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{r.name}</span>
              <span style={{ color: "#475569", fontWeight: 700 }}>{r.learners} learner{r.learners === 1 ? "" : "s"} · {r.avgPct}% avg</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div style={{ height: 8, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }} title="Learners">
                <div style={{ width: `${lw}%`, background: "#7c3aed", height: "100%" }} />
              </div>
              <div style={{ height: 8, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }} title="Avg progress">
                <div style={{ width: `${r.avgPct}%`, background: progColor, height: "100%" }} />
              </div>
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 11, color: "#64748b" }}>
        <LegendDot color="#7c3aed" label="Learners (relative)" />
        <LegendDot color="#0b5fe8" label="Avg progress" />
      </div>
    </div>
  );
}

// ===================== Math helpers =====================

function computeStats(rows: EmployeeRow[]) {
  const total = rows.length;
  const active = rows.filter((r) => Array.isArray(r.ongoing) && r.ongoing.length > 0);
  const activeCount = active.length;
  const activePct = total > 0 ? Math.round((activeCount / total) * 100) : 0;
  const avgProgress = activeCount > 0
    ? Math.round(active.reduce((s, r) => s + (r.avgPct || 0), 0) / activeCount)
    : 0;

  const scores: number[] = [];
  for (const r of rows) {
    const sc = r.latestTest?.score;
    if (typeof sc === "number") scores.push(sc);
  }
  const avgScore = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : null;

  const buckets = [
    { label: "0–25%", count: 0, color: "#ef4444" },
    { label: "25–50%", count: 0, color: "#f59e0b" },
    { label: "50–75%", count: 0, color: "#0b5fe8" },
    { label: "75–100%", count: 0, color: "#16a34a" },
  ];
  for (const r of active) {
    const p = r.avgPct || 0;
    if (p < 25) buckets[0].count += 1;
    else if (p < 50) buckets[1].count += 1;
    else if (p < 75) buckets[2].count += 1;
    else buckets[3].count += 1;
  }

  return {
    total,
    active: activeCount,
    activePct,
    avgProgress,
    avgScore,
    testCount: scores.length,
    buckets,
  };
}

// ===================== Styles =====================

const wrap: React.CSSProperties = {
  /* Stay inside <main>; avoid calc(50% - 50vw) breakout — it misaligns with max-width main + overflow-x:hidden and clips the left edge. */
  marginTop: 2,
  padding: 0,
  display: "grid",
  gap: 14,
  position: "relative",
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
};

// ─── Hero banner (matches /dashboard/manager/track/[role] banner) ───
const banner: React.CSSProperties = {
  borderRadius: 22,
  padding: "22px clamp(16px, 3vw, 24px)",
  background: "linear-gradient(135deg,#0f172a 0%,#1e293b 30%,#312e81 65%,#7c3aed 100%)",
  color: "#fff",
  position: "relative",
  overflow: "hidden",
  boxShadow: "0 16px 36px -22px rgba(99,102,241,0.55)",
  maxWidth: "100%",
  boxSizing: "border-box",
};
const blobA: React.CSSProperties = {
  position: "absolute", top: -50, right: -30, width: 200, height: 200,
  borderRadius: "50%", background: "rgba(168,85,247,0.28)", filter: "blur(2px)",
  pointerEvents: "none",
};
const blobB: React.CSSProperties = {
  position: "absolute", bottom: -60, right: 110, width: 140, height: 140,
  borderRadius: "50%", background: "rgba(236,72,153,0.20)",
  pointerEvents: "none",
};
const iconTile: React.CSSProperties = {
  width: 50, height: 50, borderRadius: 14,
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.28)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: 0.4,
  flex: "0 0 auto",
};
const breadcrumb: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
  fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 700,
  marginBottom: 6,
};
const crumbSep: React.CSSProperties = { color: "rgba(255,255,255,0.5)" };
const crumbCur: React.CSSProperties = { color: "#fff" };
const bannerTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: "-0.01em",
  lineHeight: 1.15,
  color: "#fff",
};
const bannerSub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "rgba(255,255,255,0.78)",
};
const chipManager: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "5px 12px", borderRadius: 999,
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.28)",
  color: "#fff", fontWeight: 800, fontSize: 12,
  letterSpacing: 0.3,
};
const chipLive: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "5px 12px", borderRadius: 999,
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.28)",
  color: "#fff", fontWeight: 700, fontSize: 12,
};
const btnSolid: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "8px 14px", borderRadius: 10,
  background: "#fff", color: "#0f172a",
  border: "none", fontWeight: 800, fontSize: 13,
  cursor: "pointer", boxShadow: "0 1px 4px rgba(15,23,42,0.18)",
};

const headerCard: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 18, boxShadow: "0 4px 18px -10px rgba(15,23,42,0.08)" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18, boxShadow: "0 4px 18px -10px rgba(15,23,42,0.08)" };
const h1: React.CSSProperties = { margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" };
const sub: React.CSSProperties = { marginTop: 6, color: "#475569", fontSize: 13 };
const cardTitle: React.CSSProperties = { fontSize: 15, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 10 };
function titleIcon(accent: string): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 10,
    background: `${accent}14`,
    color: accent,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: 14,
    flex: "0 0 auto",
  };
}
const cardSub: React.CSSProperties = { fontSize: 12, color: "#64748b", marginTop: 4 };
const btnOutline: React.CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", padding: "9px 12px", borderRadius: 10, fontWeight: 800, cursor: "pointer", fontSize: 13 };
const btnViewMore: React.CSSProperties = {
  ...btnOutline,
  width: "100%",
  marginTop: 2,
  color: "#312e81",
  borderColor: "#c7d2fe",
  background: "linear-gradient(180deg, #f5f3ff 0%, #fff 100%)",
};
const btnMini: React.CSSProperties = { border: "1px solid rgba(15,23,42,0.16)", background: "white", padding: "6px 10px", borderRadius: 10, fontWeight: 800, cursor: "pointer", color: "#0f172a", fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const th: React.CSSProperties = { textAlign: "left", padding: "12px 12px", fontWeight: 900, color: "#0f172a", whiteSpace: "nowrap", fontSize: 12, letterSpacing: 0.3, textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "12px 12px", color: "#0f172a", verticalAlign: "top" };
const errorStyle: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13 };
const inputStyle: React.CSSProperties = { minHeight: 40, borderRadius: 10, border: "1px solid #cbd5e1", padding: "8px 12px", outline: "none", fontSize: 13, background: "#fff" };
const rankRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "8px 10px",
  background: "#fff",
  minWidth: 0,
  maxWidth: "100%",
};
const rankBadge: React.CSSProperties = { width: 24, height: 24, borderRadius: 999, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, flex: "0 0 auto" };
const emptyHint: React.CSSProperties = { fontSize: 13, color: "#64748b", padding: "10px 12px", border: "1px dashed #e2e8f0", borderRadius: 10, background: "#f8fafc" };
const engagementCard: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 14 };
const feedRow: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", border: "1px solid #f1f5f9", borderRadius: 10, background: "#fff" };
const feedDot: React.CSSProperties = { width: 8, height: 8, borderRadius: 999, marginTop: 6, flex: "0 0 auto" };

const btnRecommend: React.CSSProperties = {
  border: "1px solid rgba(124, 58, 237, 0.35)",
  background: "linear-gradient(135deg, #ede9fe 0%, #fae8ff 100%)",
  color: "#5b21b6",
  padding: "8px 12px",
  borderRadius: 10,
  fontWeight: 900,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
  boxShadow: "0 2px 8px -4px rgba(124, 58, 237, 0.4)",
};

const recoBannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 14px",
  borderRadius: 12,
  background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
  border: "1px solid #6ee7b7",
  marginBottom: 14,
  boxShadow: "0 4px 16px -10px rgba(16,185,129,0.5)",
};
