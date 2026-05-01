"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { orgResendEmailOtp, orgVerifyEmailOtp, setOrgAuthInStorage } from "@/lib/orgAuth";
import { appPath } from "@/lib/apiBase";

function domainFromEmail(email: string) {
  const v = email.trim().toLowerCase();
  const at = v.indexOf("@");
  if (at < 0) return "";
  return v.slice(at + 1);
}

export default function VerifyOtpPage() {
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [nextUrl, setNextUrl] = useState<string>("/");
  const [debugOtp, setDebugOtp] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    setEmail((url.searchParams.get("email") || "").trim());
    setNextUrl(url.searchParams.get("next") || "/");
    setDebugOtp((url.searchParams.get("debugOtp") || "").trim());
  }, []);

  const inferredDomain = useMemo(() => domainFromEmail(email), [email]);

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const r = await orgVerifyEmailOtp({ email, otp });
      setOrgAuthInStorage(r.token, r.user);
      if (r.user.accountType === "EMPLOYEE" && (r.user.needsProfileCompletion || r.user.mustChangePassword)) {
        window.location.href = appPath("/auth/employee/complete-profile");
        return;
      }
      window.location.href = nextUrl || "/";
    } catch (err: any) {
      setError(err?.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError("");
    setInfo("");
    setResending(true);
    try {
      const r = await orgResendEmailOtp({ email });
      setInfo(r.message || "Check your inbox for a new code.");
      setDebugOtp((r.debugOtp || "").trim());
    } catch (err: any) {
      setError(err?.message || "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "24px auto", padding: 24, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Verify email</h1>
      <p style={{ margin: "8px 0 18px", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
        We sent a 6-digit OTP to <b>{email || "your email"}</b>. Enter it below to verify your account.
      </p>
      {debugOtp ? (
        <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 13 }}>
          Development OTP: <b style={{ letterSpacing: 2 }}>{debugOtp}</b>
        </div>
      ) : null}

      <form onSubmit={onVerify} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" style={inputStyle} placeholder="name@company.com" />
          <div style={hintStyle}>
            Detected domain: <b>{inferredDomain || "—"}</b>
          </div>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>OTP</div>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
            required
            inputMode="numeric"
            style={{ ...inputStyle, letterSpacing: 6, fontWeight: 900, textAlign: "center", fontSize: 18 }}
            placeholder="••••••"
          />
        </label>

        {info ? (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", fontSize: 13 }}>
            {info}
          </div>
        ) : null}

        {error ? (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <button type="submit" disabled={loading} style={primaryBtn}>
            {loading ? "Verifying..." : "Verify"}
          </button>
          <button type="button" onClick={onResend} disabled={resending || !email.trim()} style={secondaryBtn}>
            {resending ? "Sending..." : "Resend OTP"}
          </button>
        </div>

        <div style={{ fontSize: 13, color: "#475569" }}>
          Back to <Link href="/auth/login" style={{ color: "#2563eb", fontWeight: 900, textDecoration: "none" }}>Login</Link>
        </div>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", minHeight: 44, borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px", outline: "none", fontSize: 14 };
const hintStyle: React.CSSProperties = { fontSize: 12, color: "#64748b", marginTop: 6 };
const primaryBtn: React.CSSProperties = { border: "none", background: "#0b5fe8", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 900, cursor: "pointer" };
const secondaryBtn: React.CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 900, cursor: "pointer" };

