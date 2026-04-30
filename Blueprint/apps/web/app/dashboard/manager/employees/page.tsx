"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { appPath } from "@/lib/apiBase";
import { SiteFooter } from "@/app/components/SiteFooter";
import { getOrgAuthFromStorage, orgListEmployeesManagerSummary } from "@/lib/orgAuth";

type EmployeeRow = {
  employee: any;
  ongoing: Array<{ roleName: string; pct: number; startedAt?: string | null }>;
  avgPct: number;
  latestTest: { roleName?: string; skillName?: string; score?: number | null; passed?: boolean; completedAt?: string | null } | null;
};

export default function ManagerEmployeesDashboardPage() {
  const router = useRouter();
  const [{ token, user }, setAuth] = useState<{ token: string; user: any | null }>({ token: "", user: null });
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "NOT_STARTED">("ALL");
  const [sortKey, setSortKey] = useState<"NAME" | "PROGRESS_DESC" | "PROGRESS_ASC" | "RECENT_TEST">("PROGRESS_DESC");

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

  // Role guard (Manager/HR only)
  useEffect(() => {
    if (!mounted || !token || !user) return;
    const isManagerOrHr =
      (user?.accountType === "EMPLOYEE" && (user?.currentRole === "MANAGER" || user?.currentRole === "HR")) ||
      user?.currentRole === "MANAGER" ||
      user?.currentRole === "HR";
    if (!isManagerOrHr) {
      window.location.href = appPath("/target-role");
    }
  }, [mounted, token, user]);

  useEffect(() => {
    if (!token) return;
    const isManagerOrHr =
      (user?.accountType === "EMPLOYEE" && (user?.currentRole === "MANAGER" || user?.currentRole === "HR")) ||
      user?.currentRole === "MANAGER" ||
      user?.currentRole === "HR";
    if (!isManagerOrHr) return;

    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      setError("");
      try {
        const summary = await orgListEmployeesManagerSummary(token);
        if (cancelled) return;
        setRows(Array.isArray(summary) ? summary : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load employees");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchAll();
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  const isHR = user?.currentRole === "HR";
  const myDepartment: string = (user?.department || "").trim();
  const scopeLabel = isHR ? "All departments" : myDepartment ? `${myDepartment} department` : "Your department";

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

  return (
    <div style={wrap}>
      <div style={header}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>
              Employee dashboard · {scopeLabel}
            </div>
            <div style={{ fontSize: 20, fontWeight: 950, color: "#0f172a", marginTop: 4 }}>
              All employees ({filteredRows.length})
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => router.push(appPath("/dashboard/manager"))} style={btnOutline}>
              ← Back
            </button>
            <button type="button" onClick={() => window.location.reload()} style={btnSolid}>
              ↻ Refresh
            </button>
          </div>
        </div>

        <div style={toolbar}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, designation…"
            style={{ ...inputStyle, width: "100%", minWidth: 0 }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ ...inputStyle, width: "100%", minWidth: 0 }}
          >
            <option value="ALL">All employees</option>
            <option value="ACTIVE">Actively preparing</option>
            <option value="NOT_STARTED">Not started</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
            style={{ ...inputStyle, width: "100%", minWidth: 0 }}
          >
            <option value="PROGRESS_DESC">Sort: progress (high → low)</option>
            <option value="PROGRESS_ASC">Sort: progress (low → high)</option>
            <option value="NAME">Sort: name (A → Z)</option>
            <option value="RECENT_TEST">Sort: recent test</option>
          </select>
          <Link
            href={appPath("/dashboard/manager")}
            style={{
              ...btnOutline,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              minHeight: 40,
              width: "100%",
              boxSizing: "border-box",
            }}
            title="Go back to dashboard"
          >
            Dashboard home
          </Link>
        </div>
      </div>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={tableWrap}>
        <table style={employeeTableStyle}>
          <colgroup>
            <col style={{ width: "19%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
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
                {rows.length === 0 ? `No employees found yet for ${scopeLabel}.` : "No employees match the current filters."}
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
                  window.open(`/dashboard/manager/track/${encodeURIComponent(roleName)}?${qs.toString()}`, "_blank", "noopener,noreferrer");
                };
                const openRecommendFlow = () => {
                  const params = new URLSearchParams();
                  params.set("recommendFor", String(e?._id || e?.id || ""));
                  if (e?.fullName) params.set("recommendName", String(e.fullName));
                  if (e?.email) params.set("recommendEmail", String(e.email));
                  if (isHR) {
                    if (e?.department) params.set("recommendDept", String(e.department));
                  } else if (myDepartment) {
                    params.set("recommendDept", String(myDepartment));
                  }
                  router.push(`${appPath("/role")}?${params.toString()}`);
                };
                return (
                  <tr key={e._id || e.email}>
                    <td style={td}>
                      <div style={{ fontWeight: 800, color: "#0f172a", wordBreak: "break-word" }}>{e.fullName || "—"}</div>
                      <div style={{ color: "#64748b", fontSize: 12, wordBreak: "break-all" }}>{e.email || "—"}</div>
                    </td>
                    <td style={td}>
                      {e.department ? <span style={tdMultiline}>{String(e.department)}</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>
                    <td style={td}>
                      {e.designation ? <span style={tdMultiline}>{String(e.designation)}</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>
                    <td style={td}>{ongoing.length ? `${ongoing.length} role(s)` : <span style={{ color: "#94a3b8" }}>None</span>}</td>
                    <td style={td}>
                      {ongoing.length ? <ProgressBar pct={r.avgPct || 0} /> : <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>
                    <td style={td}>
                      {latest ? (
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, wordBreak: "break-word", lineHeight: 1.35 }}>{latest.skillName || "—"}</div>
                          <div style={{ fontSize: 12, color: latest.passed ? "#15803d" : "#b91c1c", marginTop: 4 }}>
                            {latest.score == null ? "—" : `${latest.score}%`} · {latest.passed ? "Passed" : "Failed"}
                          </div>
                        </div>
                      ) : <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>
                    <td style={td}>
                      {ongoing.length === 0 ? (
                        <button
                          type="button"
                          disabled
                          style={{ ...btnMini, maxWidth: "100%", opacity: 0.5, cursor: "not-allowed", whiteSpace: "normal" }}
                          title="Employee hasn’t started preparation yet"
                        >
                          View analytics
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
                          {pick.map((o: any) => (
                            <button
                              type="button"
                              key={o.roleName}
                              onClick={() => openAnalytics(o.roleName)}
                              style={{ ...btnMini, maxWidth: "100%", whiteSpace: "normal" }}
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
                        type="button"
                        onClick={openRecommendFlow}
                        style={{ ...btnRecommend, width: "100%", maxWidth: "100%", boxSizing: "border-box", whiteSpace: "normal", textAlign: "center" }}
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

      <div style={{ width: "100%", marginTop: 28 }}>
        <SiteFooter />
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
        <div style={{ width: `${safe}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, height: "100%", transition: "width .35s ease", borderRadius: 999 }} />
      </div>
      <div style={{ fontSize: 12, color: "#0f172a", marginTop: 4, fontWeight: 800 }}>{safe}%</div>
    </div>
  );
}

// ===================== Styles =====================

const wrap: React.CSSProperties = {
  marginTop: 2,
  padding: 0,
  display: "grid",
  gap: 18,
  position: "relative",
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
};

const header: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 4px 18px -10px rgba(15,23,42,0.08)",
};

const toolbar: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
  gap: 12,
  alignItems: "stretch",
  padding: 14,
  borderRadius: 14,
  background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
  border: "1px solid #e2e8f0",
};

const btnOutline: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  padding: "9px 12px",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 13,
  color: "#0f172a",
};

const btnSolid: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "9px 12px",
  borderRadius: 10,
  background: "#0f172a",
  color: "#fff",
  border: "none",
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  padding: "8px 12px",
  outline: "none",
  fontSize: 13,
  background: "#fff",
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  maxWidth: "100%",
  boxShadow: "inset 0 1px 2px rgba(15,23,42,0.04)",
  background: "#fff",
};

const employeeTableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 1080,
  tableLayout: "fixed",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 12px",
  fontWeight: 900,
  color: "#0f172a",
  whiteSpace: "normal",
  fontSize: 12,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  verticalAlign: "bottom",
  borderBottom: "1px solid #e5e7eb",
  lineHeight: 1.25,
  wordBreak: "break-word",
};

const td: React.CSSProperties = {
  padding: "12px 12px",
  color: "#0f172a",
  verticalAlign: "top",
  textAlign: "left",
  borderBottom: "1px solid #f1f5f9",
  wordWrap: "break-word",
  overflowWrap: "break-word",
};

const tdMultiline: React.CSSProperties = { display: "block", wordBreak: "break-word", lineHeight: 1.35 };

const btnMini: React.CSSProperties = {
  border: "1px solid rgba(15,23,42,0.16)",
  background: "white",
  padding: "6px 10px",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
  color: "#0f172a",
  fontSize: 12,
  maxWidth: 220,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

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

const errorStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: 13,
};

