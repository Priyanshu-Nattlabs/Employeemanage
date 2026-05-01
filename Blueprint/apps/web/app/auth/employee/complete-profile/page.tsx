"use client";

import { useEffect, useState } from "react";
import { orgCompleteInvite, orgGetMyProfile, getOrgAuthFromStorage, setOrgAuthInStorage, type OrgUser } from "@/lib/orgAuth";
import { appPath } from "@/lib/apiBase";

export default function CompleteInviteProfilePage() {
  const [{ token, user }, setAuth] = useState(() => getOrgAuthFromStorage());
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onChange = () => setAuth(getOrgAuthFromStorage());
    window.addEventListener("jbv2-org-auth-changed", onChange);
    return () => window.removeEventListener("jbv2-org-auth-changed", onChange);
  }, []);

  useEffect(() => {
    if (!token) {
      window.location.href = appPath("/auth/employee/login");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const p = await orgGetMyProfile(token);
        if (cancelled) return;
        const raw = p as Record<string, unknown> & { _id?: unknown };
        const needs = Boolean(raw.needsProfileCompletion);
        const mustPw = Boolean(raw.mustChangePassword);
        if (!needs && !mustPw) {
          window.location.href = appPath("/");
          return;
        }
        setOrgAuthInStorage(token, {
          id: String(raw._id ?? raw.id ?? ""),
          email: String(raw.email || ""),
          fullName: String(raw.fullName || ""),
          companyName: String(raw.companyName || ""),
          companyDomain: String(raw.companyDomain || ""),
          accountType: raw.accountType as OrgUser["accountType"],
          currentRole: raw.currentRole as OrgUser["currentRole"],
          designation: raw.designation ? String(raw.designation) : undefined,
          department: raw.department ? String(raw.department) : undefined,
          employeeId: raw.employeeId ? String(raw.employeeId) : undefined,
          mobileNo: raw.mobileNo ? String(raw.mobileNo) : undefined,
          reportingManagerEmail: raw.reportingManagerEmail ? String(raw.reportingManagerEmail) : undefined,
          needsProfileCompletion: needs,
          mustChangePassword: mustPw,
        });
      } catch {
        /* stay on page */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (user?.fullName) setFullName(user.fullName);
    if (user?.employeeId) setEmployeeId(user.employeeId);
  }, [user?.fullName, user?.employeeId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const r = await orgCompleteInvite(token, {
        newPassword,
        fullName: fullName.trim() || undefined,
        designation: designation.trim(),
        mobileNo: mobileNo.trim(),
        employeeId: employeeId.trim() || undefined,
      });
      setOrgAuthInStorage(r.token, r.user);
      window.location.href = appPath("/");
    } catch (err: any) {
      setError(err?.message || "Could not save your profile");
    } finally {
      setLoading(false);
    }
  };

  if (!token || !user) return null;

  return (
    <div style={card}>
      <h1 style={h1}>Complete your profile</h1>
      <p style={sub}>
        Your manager added you to the portal. Confirm your details, add what’s missing, and choose a <b>new password</b> (do not reuse the temporary one from the email).
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={labelWrap}>
          <div style={label}>Full name</div>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required type="text" style={input} />
        </label>
        <label style={labelWrap}>
          <div style={label}>Designation</div>
          <input value={designation} onChange={(e) => setDesignation(e.target.value)} required type="text" style={input} placeholder="e.g. Software Engineer" />
        </label>
        <label style={labelWrap}>
          <div style={label}>Mobile number</div>
          <input value={mobileNo} onChange={(e) => setMobileNo(e.target.value)} required type="text" style={input} />
        </label>
        <label style={labelWrap}>
          <div style={label}>Employee ID (optional — change only if your company ID differs)</div>
          <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} type="text" style={input} />
        </label>
        <label style={labelWrap}>
          <div style={label}>New password</div>
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required type="password" style={input} minLength={8} autoComplete="new-password" />
        </label>
        <label style={labelWrap}>
          <div style={label}>Confirm new password</div>
          <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required type="password" style={input} minLength={8} autoComplete="new-password" />
        </label>

        {error ? <div style={errorBox}>{error}</div> : null}

        <button type="submit" disabled={loading} style={primaryBtn}>
          {loading ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </div>
  );
}

const card: React.CSSProperties = { maxWidth: 560, margin: "24px auto", padding: 24, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14 };
const h1: React.CSSProperties = { margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" };
const sub: React.CSSProperties = { margin: "8px 0 20px", color: "#475569", fontSize: 14, lineHeight: 1.6 };
const labelWrap: React.CSSProperties = { display: "grid", gap: 6 };
const label: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: "#0f172a" };
const input: React.CSSProperties = { width: "100%", minHeight: 44, borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px", outline: "none", fontSize: 14 };
const primaryBtn: React.CSSProperties = { border: "none", background: "#0b5fe8", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 900, cursor: "pointer" };
const errorBox: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13 };
