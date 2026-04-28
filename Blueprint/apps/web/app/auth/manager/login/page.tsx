"use client";

import Link from "next/link";
import { useState } from "react";
import {
  orgConfirmManagerHrPasswordReset,
  orgLogin,
  orgRequestManagerHrPasswordResetOtp,
  setOrgAuthInStorage,
} from "@/lib/orgAuth";

export default function ManagerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [forgotMode, setForgotMode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [infoMsg, setInfoMsg] = useState("");

  const resetForgotUi = () => {
    setForgotMode(false);
    setCodeSent(false);
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setInfoMsg("");
    setError("");
  };

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

  const onSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMsg("");
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email first.");
      return;
    }
    setForgotLoading(true);
    try {
      const r = await orgRequestManagerHrPasswordResetOtp({ email: trimmed });
      setInfoMsg(r.message || "Check your inbox for the code.");
      setCodeSent(true);
    } catch (err: any) {
      setError(err?.message || "Could not send code.");
    } finally {
      setForgotLoading(false);
    }
  };

  const onConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfoMsg("");
    const trimmed = email.trim();
    const ot = otp.trim();
    if (!trimmed || ot.length !== 6) {
      setError("Enter your email and the 6-digit code.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setForgotLoading(true);
    try {
      const r = await orgConfirmManagerHrPasswordReset({
        email: trimmed,
        otp: ot,
        newPassword,
      });
      const role = r.user.currentRole;
      const allowed = r.user.accountType === "EMPLOYEE" && (role === "MANAGER" || role === "HR");
      if (!allowed) throw new Error("Session error for Manager / HR account.");
      setOrgAuthInStorage(r.token, r.user);
      window.location.href = "/dashboard/manager";
    } catch (err: any) {
      setError(err?.message || "Could not reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  if (forgotMode) {
    return (
      <div style={card}>
        <h1 style={h1}>Reset password</h1>
        <p style={sub}>We will email a verification code to the address below. Then choose a new password.</p>

        {infoMsg ? <div style={infoBox}>{infoMsg}</div> : null}
        {error ? <div style={errorBox}>{error}</div> : null}

        <form onSubmit={onSendResetCode} style={{ display: "grid", gap: 12 }}>
          <label style={labelWrap}>
            <div style={label}>Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              style={input}
              placeholder="manager@company.com"
              autoComplete="email"
            />
          </label>
          <button type="submit" disabled={forgotLoading} style={primaryBtn}>
            {forgotLoading && !codeSent ? "Sending…" : codeSent ? "Resend code" : "Send verification code"}
          </button>
        </form>

        {codeSent ? (
          <form onSubmit={onConfirmReset} style={{ display: "grid", gap: 12, marginTop: 20 }}>
            <label style={labelWrap}>
              <div style={label}>Verification code</div>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                inputMode="numeric"
                style={input}
                placeholder="6-digit code"
                autoComplete="one-time-code"
              />
            </label>
            <label style={labelWrap}>
              <div style={label}>New password</div>
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                type="password"
                minLength={8}
                style={input}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </label>
            <label style={labelWrap}>
              <div style={label}>Confirm new password</div>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                type="password"
                minLength={8}
                style={input}
                placeholder="Repeat password"
                autoComplete="new-password"
              />
            </label>
            <button type="submit" disabled={forgotLoading} style={primaryBtn}>
              {forgotLoading ? "Updating…" : "Update password & sign in"}
            </button>
          </form>
        ) : null}

        <button type="button" onClick={resetForgotUi} style={textLinkBtn}>
          ← Back to login
        </button>
      </div>
    );
  }

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
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -4 }}>
          <button
            type="button"
            onClick={() => {
              setError("");
              setInfoMsg("");
              setCodeSent(false);
              setOtp("");
              setNewPassword("");
              setConfirmPassword("");
              setForgotMode(true);
            }}
            style={linkButton}
          >
            Forgot password?
          </button>
        </div>

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
const infoBox: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", fontSize: 13 };
const link: React.CSSProperties = { color: "#2563eb", fontWeight: 900, textDecoration: "none" };
const linkButton: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  color: "#2563eb",
  fontWeight: 800,
  fontSize: 13,
  textDecoration: "underline",
};
const textLinkBtn: React.CSSProperties = {
  marginTop: 16,
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  color: "#475569",
  fontSize: 13,
  fontWeight: 700,
};
