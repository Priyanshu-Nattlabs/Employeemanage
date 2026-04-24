"use client";

import { useEffect, useState } from "react";
import { clearOrgAuthInStorage, getOrgAuthFromStorage, orgListEmployeesManagerSummary } from "@/lib/orgAuth";

export default function ManagerDashboardPage() {
  const [{ token, user }, setAuth] = useState<{ token: string; user: any | null }>({ token: "", user: null });
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const onChange = () => setAuth(getOrgAuthFromStorage());
    setMounted(true);
    onChange();
    window.addEventListener("jbv2-org-auth-changed", onChange);
    return () => window.removeEventListener("jbv2-org-auth-changed", onChange);
  }, []);

  useEffect(() => {
    if (mounted && !token) window.location.href = "/auth/login";
  }, [mounted, token]);

  useEffect(() => {
    const run = async () => {
      if (!token) return;
      setLoading(true);
      setError("");
      try {
        const r = await orgListEmployeesManagerSummary(token);
        setRows(Array.isArray(r) ? r : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load employees");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [token]);

  if (!mounted) return null;
  if (!user) return null;

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={h1}>Manager dashboard</h1>
            <div style={sub}>
              <b>{user.companyName}</b> — <span style={{ color: "#64748b" }}>{user.companyDomain}</span>
            </div>
          </div>
          <button onClick={() => { clearOrgAuthInStorage(); window.location.href = "/"; }} style={btnOutline}>Logout</button>
        </div>

        <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
            Employees in your company
          </div>
          <button onClick={() => window.location.reload()} style={btnOutline}>Refresh</button>
        </div>

        {error ? <div style={errorStyle}>{error}</div> : null}

        <div style={{ marginTop: 12, overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Name", "Email", "Designation", "Employee ID", "Role", "Active prep", "Avg progress", "Last test"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
                <th style={th}>Track</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 14, color: "#64748b" }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 14, color: "#64748b" }}>No employees found yet for {user.companyDomain}.</td></tr>
              ) : (
                rows.map((r) => {
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
                    window.open(`/role/${encodeURIComponent(roleName)}/analytics?${qs.toString()}`, "_blank", "noopener,noreferrer");
                  };
                  return (
                    <tr key={e._id || e.email} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={td}>{e.fullName || "—"}</td>
                      <td style={td}>{e.email || "—"}</td>
                      <td style={td}>{e.designation || "—"}</td>
                      <td style={td}>{e.employeeId || "—"}</td>
                      <td style={td}>{e.currentRole || "EMPLOYEE"}</td>
                      <td style={td}>{ongoing.length ? `${ongoing.length} role(s)` : "—"}</td>
                      <td style={td}>{ongoing.length ? `${r.avgPct || 0}%` : "—"}</td>
                      <td style={td}>
                        {latest ? `${latest.skillName} (${latest.score ?? "—"}%)` : "—"}
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
                                📊 {o.roleName.length > 18 ? `${o.roleName.slice(0, 18)}…` : o.roleName}
                              </button>
                            ))}
                            {more > 0 ? <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", padding: "6px 6px" }}>+{more}</span> : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { maxWidth: 1150, margin: "24px auto", padding: "0 12px" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18 };
const h1: React.CSSProperties = { margin: 0, fontSize: 22, fontWeight: 900 };
const sub: React.CSSProperties = { marginTop: 6, color: "#475569", fontSize: 13 };
const btnOutline: React.CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", padding: "10px 12px", borderRadius: 10, fontWeight: 800, cursor: "pointer" };
const btnMini: React.CSSProperties = { border: "1px solid rgba(15,23,42,0.16)", background: "white", padding: "6px 10px", borderRadius: 10, fontWeight: 950, cursor: "pointer", color: "#0f172a", fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const th: React.CSSProperties = { textAlign: "left", padding: "12px 12px", fontWeight: 900, color: "#0f172a", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "12px 12px", color: "#0f172a", whiteSpace: "nowrap" };
const errorStyle: React.CSSProperties = { marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13 };

