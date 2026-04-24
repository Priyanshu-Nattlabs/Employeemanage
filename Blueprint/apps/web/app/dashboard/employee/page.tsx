"use client";

import { useEffect, useState } from "react";
import { clearOrgAuthInStorage, getOrgAuthFromStorage } from "@/lib/orgAuth";

export default function EmployeeDashboardPage() {
  const [{ token, user }, setAuth] = useState(() => getOrgAuthFromStorage());

  useEffect(() => {
    const onChange = () => setAuth(getOrgAuthFromStorage());
    window.addEventListener("jbv2-org-auth-changed", onChange);
    return () => window.removeEventListener("jbv2-org-auth-changed", onChange);
  }, []);

  useEffect(() => {
    if (!token) window.location.href = "/auth/login";
  }, [token]);

  useEffect(() => {
    // Employees should land on the main page (home). Keep manager/admin dashboards separate.
    if (token && user?.accountType === "EMPLOYEE" && user?.currentRole !== "MANAGER") {
      window.location.href = "/";
    }
  }, [token, user]);

  if (!user) return null;

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={h1}>Employee dashboard</h1>
            <div style={sub}>Welcome, <b>{user.fullName}</b> ({user.email})</div>
          </div>
          <button onClick={() => { clearOrgAuthInStorage(); window.location.href = "/"; }} style={btnOutline}>Logout</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
          <Info label="Company" value={`${user.companyName} (${user.companyDomain})`} />
          <Info label="Designation" value={user.designation || "—"} />
          <Info label="Employee ID" value={user.employeeId || "—"} />
          <Info label="Current role" value={user.currentRole} />
          <Info label="Mobile no." value={user.mobileNo || "—"} />
          <Info label="Reporting manager" value={user.reportingManagerEmail || "—"} />
        </div>

        <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 12, background: "#f1f5f9", color: "#0f172a", fontSize: 13, lineHeight: 1.6 }}>
          This is a starter dashboard. You said you’ll share the Employee Development dashboard sections later — once you do, I’ll build them here.
        </div>
      </div>
    </div>
  );
}

function Info(props: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 12px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 6 }}>{props.label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{props.value}</div>
    </div>
  );
}

const wrap: React.CSSProperties = { maxWidth: 1000, margin: "24px auto", padding: "0 12px" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18 };
const h1: React.CSSProperties = { margin: 0, fontSize: 22, fontWeight: 900 };
const sub: React.CSSProperties = { marginTop: 6, color: "#475569", fontSize: 13 };
const btnOutline: React.CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", padding: "10px 12px", borderRadius: 10, fontWeight: 800, cursor: "pointer" };

