"use client";

import Link from "next/link";
import { useState } from "react";
import { orgLogin, setOrgAuthInStorage } from "@/lib/orgAuth";

export default function LoginPage() {
  // Deprecated route: keep for old links, redirect to employee login UI.
  if (typeof window !== "undefined") {
    window.location.replace("/auth/employee/login");
  }
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
      setOrgAuthInStorage(r.token, r.user);
      if (r.user.accountType === "ADMIN") window.location.href = "/dashboard/admin";
      else window.location.href = r.user.currentRole === "MANAGER" || r.user.currentRole === "HR" ? "/dashboard/manager/hub" : "/";
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "24px auto", padding: "24px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Login</h1>
      <p style={{ margin: "8px 0 20px", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
        Login using your <b>company email</b> and password.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={labelStyle}>Email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" style={inputStyle} placeholder="name@company.com" />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={labelStyle}>Password</div>
          <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" style={inputStyle} placeholder="Your password" />
        </label>

        {error ? <div style={errorStyle}>{error}</div> : null}

        <button type="submit" disabled={loading} style={primaryBtn}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <div style={{ fontSize: 13, color: "#475569" }}>
          Don’t have an account?{" "}
          <Link href="/auth/register" style={{ color: "#2563eb", fontWeight: 800, textDecoration: "none" }}>
            Create account
          </Link>
        </div>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: "#0f172a" };

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  padding: "10px 12px",
  outline: "none",
  fontSize: 14
};

const primaryBtn: React.CSSProperties = {
  border: "none",
  background: "#0b5fe8",
  color: "#fff",
  padding: "10px 16px",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer"
};

const errorStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: 13
};

