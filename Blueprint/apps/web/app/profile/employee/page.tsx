"use client";

import { useEffect, useMemo, useState } from "react";
import { clearOrgAuthInStorage, getOrgAuthFromStorage, orgGetMyProfile, orgUpdateMyProfile, setOrgAuthInStorage } from "@/lib/orgAuth";

export default function EmployeeProfilePage() {
  const [{ token, user }, setAuth] = useState<{ token: string; user: any | null }>({ token: "", user: null });
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const sync = () => setAuth(getOrgAuthFromStorage());
    setMounted(true);
    sync();
    window.addEventListener("jbv2-org-auth-changed", sync);
    return () => window.removeEventListener("jbv2-org-auth-changed", sync);
  }, []);

  useEffect(() => {
    if (mounted && !token) window.location.href = "/auth/employee/login";
  }, [mounted, token]);

  const isEmployee = useMemo(() => Boolean(user?.accountType === "EMPLOYEE"), [user]);
  useEffect(() => {
    if (mounted && token && !isEmployee) window.location.href = "/";
  }, [mounted, token, isEmployee]);

  useEffect(() => {
    const run = async () => {
      if (!token) return;
      setError("");
      try {
        const p = await orgGetMyProfile(token);
        setProfile(p);
      } catch (e: any) {
        setError(e?.message || "Failed to load profile");
      }
    };
    void run();
  }, [token]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setSaved("");
    setError("");
    try {
      const updated = await orgUpdateMyProfile(token, {
        fullName: profile?.fullName || "",
        designation: profile?.designation || "",
        employeeId: profile?.employeeId || "",
        currentRole: profile?.currentRole || "EMPLOYEE",
        mobileNo: profile?.mobileNo || "",
      } as any);
      setProfile(updated);
      if (user) setOrgAuthInStorage(token, { ...user, ...updated });
      setSaved("Saved");
      setTimeout(() => setSaved(""), 1200);
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;
  if (!user) return null;

  return (
    <div style={wrap}>
      <div style={hero}>
        <div>
          <div style={kicker}>Employee profile</div>
          <div style={title}>{user.fullName || "Employee"}</div>
          <div style={subtitle}>{user.email} • {user.companyName}</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => (window.location.href = "/")} style={btnGhost}>Go to Home</button>
          <button
            onClick={() => {
              clearOrgAuthInStorage();
              window.location.href = "/";
            }}
            style={btnDanger}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>Your details</div>
        <div style={grid}>
          <Field label="Full name">
            <input value={profile?.fullName || ""} onChange={(e) => setProfile({ ...(profile || {}), fullName: e.target.value })} style={input} />
          </Field>
          <Field label="Email (locked)">
            <input value={profile?.email || user.email || ""} readOnly style={{ ...input, background: "#f8fafc" }} />
          </Field>
          <Field label="Designation">
            <input value={profile?.designation || ""} onChange={(e) => setProfile({ ...(profile || {}), designation: e.target.value })} style={input} />
          </Field>
          <Field label="Employee ID">
            <input value={profile?.employeeId || ""} onChange={(e) => setProfile({ ...(profile || {}), employeeId: e.target.value })} style={input} />
          </Field>
          <Field label="Current role">
            <select value={profile?.currentRole || "EMPLOYEE"} onChange={(e) => setProfile({ ...(profile || {}), currentRole: e.target.value })} style={input}>
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
            </select>
          </Field>
          <Field label="Mobile no.">
            <input value={profile?.mobileNo || ""} onChange={(e) => setProfile({ ...(profile || {}), mobileNo: e.target.value })} style={input} />
          </Field>
          <Field label="Company (locked)">
            <input value={`${user.companyName} (${user.companyDomain})`} readOnly style={{ ...input, background: "#f8fafc" }} />
          </Field>
        </div>

        {error ? <div style={errorBox}>{error}</div> : null}
        {saved ? <div style={okBox}>{saved}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={save} disabled={saving} style={btnPrimary}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{props.label}</div>
      {props.children}
    </label>
  );
}

const wrap: React.CSSProperties = { maxWidth: 1100, margin: "24px auto", padding: "0 12px" };
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

const card: React.CSSProperties = { marginTop: 14, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 18 };
const cardTitle: React.CSSProperties = { fontSize: 14, fontWeight: 950, color: "#0f172a", marginBottom: 12 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

const input: React.CSSProperties = { width: "100%", minHeight: 44, borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px", outline: "none", fontSize: 14 };
const btnPrimary: React.CSSProperties = { border: "none", background: "#0b5fe8", color: "#fff", padding: "10px 14px", borderRadius: 10, fontWeight: 950, cursor: "pointer" };
const btnGhost: React.CSSProperties = { border: "1px solid rgba(15,23,42,0.18)", background: "rgba(255,255,255,0.7)", padding: "10px 14px", borderRadius: 10, fontWeight: 950, cursor: "pointer", color: "#0f172a" };
const btnDanger: React.CSSProperties = { border: "1px solid #fecaca", background: "#fff", padding: "10px 14px", borderRadius: 10, fontWeight: 950, cursor: "pointer", color: "#991b1b" };

const errorBox: React.CSSProperties = { marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13, fontWeight: 700 };
const okBox: React.CSSProperties = { marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#ecfeff", border: "1px solid #a5f3fc", color: "#155e75", fontSize: 13, fontWeight: 800 };

