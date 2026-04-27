"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { orgRegisterAdmin } from "@/lib/orgAuth";

function domainFromEmail(email: string) {
  const v = email.trim().toLowerCase();
  const at = v.indexOf("@");
  if (at < 0) return "";
  return v.slice(at + 1);
}

export default function AdminRegisterPage() {
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");

  const inferredDomain = useMemo(() => domainFromEmail(email), [email]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!inferredDomain) throw new Error("Please enter a valid company email");
      const r = await orgRegisterAdmin({ email, password, fullName, companyName, companyDomain: inferredDomain });
      window.location.href = `/auth/verify-otp?email=${encodeURIComponent(r.email)}&next=${encodeURIComponent("/dashboard/admin")}`;
    } catch (err: any) {
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: "24px auto", padding: 24, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Admin create account</h1>
      <p style={{ margin: "8px 0 20px", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
        Create an admin account using your <b>company email</b>.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Full name">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required style={inputStyle} placeholder="Admin name" />
        </Field>
        <Field label="Company name">
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required style={inputStyle} placeholder="Company" />
        </Field>

        <Field label="Company email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" style={inputStyle} placeholder="admin@company.com" />
          <div style={hintStyle}>Detected domain: <b>{inferredDomain || "—"}</b></div>
        </Field>
        <Field label="Password">
          <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" minLength={8} style={inputStyle} placeholder="Min 8 characters" />
        </Field>

        {error ? (
          <div style={{ gridColumn: "1 / -1", padding: "10px 12px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <button type="submit" disabled={loading} style={primaryBtn}>
            {loading ? "Creating..." : "Create account"}
          </button>
          <div style={{ fontSize: 13, color: "#475569" }}>
            Already have an admin account?{" "}
            <Link href="/auth/admin/login" style={{ color: "#2563eb", fontWeight: 900, textDecoration: "none" }}>
              Login
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{props.label}</div>
      {props.children}
    </label>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", minHeight: 44, borderRadius: 10, border: "1px solid #cbd5e1", padding: "10px 12px", outline: "none", fontSize: 14 };
const hintStyle: React.CSSProperties = { fontSize: 12, color: "#64748b", marginTop: 6 };
const primaryBtn: React.CSSProperties = { border: "none", background: "#0b5fe8", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 900, cursor: "pointer" };

