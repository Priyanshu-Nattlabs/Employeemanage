"use client";

import Link from "next/link";
import { useState } from "react";
import { orgLogin, setOrgAuthInStorage } from "@/lib/orgAuth";

export default function ManagerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await orgLogin({ email, password });
      const role = r.user.currentRole;
      const allowed = r.user.accountType === "EMPLOYEE" && (role === "MANAGER" || role === "HR");
      if (!allowed) throw new Error("This area is for Manager / HR accounts. Please use Employee login.");
      setOrgAuthInStorage(r.token, r.user);
      window.location.href = "/dashboard/manager";
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={card}>
      <h1 style={h1}>Manager/HR login</h1>
      <p style={sub}>Managers see their department. HR sees the full company.</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={labelWrap}>
          <div style={label}>Email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" style={input} placeholder="manager@company.com" />
        </label>
        <label style={labelWrap}>
          <div style={label}>Password</div>
          <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" style={input} placeholder="Your password" />
        </label>

        {error ? <div style={errorBox}>{error}</div> : null}
        {error?.toLowerCase?.().includes("not verified") ? (
          <div style={{ fontSize: 13, color: "#475569" }}>
            Need to verify?{" "}
            <Link href={`/auth/verify-otp?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/dashboard/manager")}`} style={link}>
              Enter OTP
            </Link>
          </div>
        ) : null}

        <button type="submit" disabled={loading} style={primaryBtn}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <div style={{ fontSize: 13, color: "#475569" }}>
          New Manager/HR?{" "}
          <Link href="/auth/manager/register" style={link}>
            Create account
          </Link>
        </div>
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
const link: React.CSSProperties = { color: "#2563eb", fontWeight: 900, textDecoration: "none" };

