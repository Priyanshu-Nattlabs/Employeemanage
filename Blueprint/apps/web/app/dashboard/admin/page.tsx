"use client";

import { useEffect, useState } from "react";
import { clearOrgAuthInStorage, getOrgAuthFromStorage, orgListEmployeesAdminSummary } from "@/lib/orgAuth";

export default function AdminDashboardPage() {
  const [{ token, user }, setAuth] = useState<{ token: string; user: any | null }>({ token: "", user: null });
  const [mounted, setMounted] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "MANAGER" | "EMPLOYEE">("ALL");

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
        const r = await orgListEmployeesAdminSummary(token);
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

  const employees = rows.map((r) => r.employee);
  const filtered = rows.filter((r) => {
    const e = r.employee || {};
    if (roleFilter === "MANAGER" && e.currentRole !== "MANAGER") return false;
    if (roleFilter === "EMPLOYEE" && e.currentRole === "MANAGER") return false;
    const s = `${e.fullName || ""} ${e.email || ""} ${e.designation || ""} ${e.employeeId || ""}`.toLowerCase();
    return s.includes(q.trim().toLowerCase());
  });

  return (
    <div style={wrap}>
      <div style={hero}>
        <div>
          <div style={kicker}>Admin dashboard</div>
          <div style={title}>{user.companyName}</div>
          <div style={subtitle}>{user.email} • {user.companyDomain}</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => window.location.reload()} style={btnGhost}>Refresh</button>
          <button onClick={() => { clearOrgAuthInStorage(); window.location.href = "/"; }} style={btnDanger}>Logout</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
        <div style={statCard}>
          <div style={statLabel}>Total employees</div>
          <div style={statValue}>{rows.length}</div>
        </div>
        <div style={statCard}>
          <div style={statLabel}>Managers</div>
          <div style={statValue}>{employees.filter((e: any) => e.currentRole === "MANAGER").length}</div>
        </div>
        <div style={statCard}>
          <div style={statLabel}>Employees</div>
          <div style={statValue}>{employees.filter((e: any) => e.currentRole !== "MANAGER").length}</div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={cardTitle}>Employees registered under your company</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)} style={filterSelect}>
              <option value="ALL">All</option>
              <option value="MANAGER">Manager</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / email / id…" style={search} />
          </div>
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
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 14, color: "#64748b" }}>No matching employees.</td></tr>
              ) : (
                filtered.map((r) => {
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
                    <td style={td}><b>{e.fullName || "—"}</b></td>
                    <td style={td}>{e.email || "—"}</td>
                    <td style={td}>{e.designation || "—"}</td>
                    <td style={td}>{e.employeeId || "—"}</td>
                    <td style={td}><span style={pill(e.currentRole === "MANAGER" ? "#dcfce7" : "#e0f2fe", e.currentRole === "MANAGER" ? "#166534" : "#075985")}>{e.currentRole || "EMPLOYEE"}</span></td>
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
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "12px 12px", fontWeight: 900, color: "#0f172a", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "12px 12px", color: "#0f172a", whiteSpace: "nowrap" };
const errorStyle: React.CSSProperties = { marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13 };

const wrap: React.CSSProperties = { maxWidth: 1150, margin: "24px auto", padding: "0 12px" };
const hero: React.CSSProperties = {
  borderRadius: 18,
  padding: "20px 18px",
  border: "1px solid rgba(15,23,42,0.08)",
  background: "linear-gradient(180deg, rgba(171,223,231,0.65) 0%, rgba(240,211,211,0.65) 100%)",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center"
};
const kicker: React.CSSProperties = { fontSize: 12, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase", color: "#0f172a" };
const title: React.CSSProperties = { fontSize: 22, fontWeight: 950, marginTop: 6, color: "#0f172a" };
const subtitle: React.CSSProperties = { marginTop: 6, fontSize: 13, color: "#334155", fontWeight: 700 };

const btnGhost: React.CSSProperties = { border: "1px solid rgba(15,23,42,0.18)", background: "rgba(255,255,255,0.7)", padding: "10px 14px", borderRadius: 10, fontWeight: 950, cursor: "pointer", color: "#0f172a" };
const btnDanger: React.CSSProperties = { border: "1px solid #fecaca", background: "#fff", padding: "10px 14px", borderRadius: 10, fontWeight: 950, cursor: "pointer", color: "#991b1b" };
const btnMini: React.CSSProperties = { border: "1px solid rgba(15,23,42,0.16)", background: "white", padding: "6px 10px", borderRadius: 10, fontWeight: 950, cursor: "pointer", color: "#0f172a", fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const statCard: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 };
const statLabel: React.CSSProperties = { fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".06em" };
const statValue: React.CSSProperties = { marginTop: 8, fontSize: 22, fontWeight: 950, color: "#0f172a" };

const card: React.CSSProperties = { marginTop: 14, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18 };
const cardTitle: React.CSSProperties = { fontSize: 14, fontWeight: 950, color: "#0f172a" };
const search: React.CSSProperties = { width: 320, maxWidth: "100%", minHeight: 42, borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", outline: "none", fontSize: 13 };
const filterSelect: React.CSSProperties = { minHeight: 42, borderRadius: 12, border: "1px solid #cbd5e1", padding: "10px 12px", outline: "none", fontSize: 13, fontWeight: 800, color: "#0f172a", background: "#fff" };

function pill(bg: string, fg: string): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, background: bg, color: fg, fontWeight: 950, fontSize: 12 };
}

