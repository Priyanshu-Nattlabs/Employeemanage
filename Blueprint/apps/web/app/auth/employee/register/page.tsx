"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { orgRegisterEmployee, setOrgAuthInStorage, type OrgCurrentRole } from "@/lib/orgAuth";

function domainFromEmail(email: string) {
  const v = email.trim().toLowerCase();
  const at = v.indexOf("@");
  if (at < 0) return "";
  return v.slice(at + 1);
}

export default function EmployeeRegisterPage() {
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [currentRole, setCurrentRole] = useState<OrgCurrentRole>("EMPLOYEE");
  const [mobileNo, setMobileNo] = useState("");
  const [reportingManagerEmail, setReportingManagerEmail] = useState("");

  const inferredDomain = useMemo(() => domainFromEmail(email), [email]);
  const inferredMgrDomain = useMemo(() => domainFromEmail(reportingManagerEmail), [reportingManagerEmail]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!inferredDomain) throw new Error("Please enter a valid company email");
      if (!reportingManagerEmail.trim()) throw new Error("Reporting manager email is required");
      if (inferredMgrDomain && inferredMgrDomain !== inferredDomain) throw new Error("Reporting manager email must be in the same company domain");

      const r = await orgRegisterEmployee({
        email,
        password,
        fullName,
        designation,
        department,
        companyName,
        employeeId,
        currentRole,
        mobileNo,
        reportingManagerEmail,
        companyDomain: inferredDomain
      });
      if ("verificationRequired" in r && r.verificationRequired) {
        const nextPath = currentRole === "MANAGER" ? "/dashboard/manager" : "/target-role";
        window.location.href = `/auth/verify-otp?email=${encodeURIComponent(r.email)}&next=${encodeURIComponent(nextPath)}`;
        return;
      }
      if (!("token" in r) || !r.token || !r.user) throw new Error("Registration succeeded but login payload missing.");
      setOrgAuthInStorage(r.token, r.user);
      window.location.href = currentRole === "MANAGER" ? "/dashboard/manager" : "/target-role";
    } catch (err: any) {
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 820, margin: "24px auto", padding: 24, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Employee create account</h1>
      <p style={{ margin: "8px 0 20px", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
        Sign up using your <b>company email</b> only. No Google signup. After you submit, we email a <b>6-digit verification code</b>—enter it on the next screen to activate your account.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Full name">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required style={inputStyle} placeholder="Your name" />
        </Field>
        <Field label="Company name">
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required style={inputStyle} placeholder="Company" />
        </Field>

        <Field label="Company email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" style={inputStyle} placeholder="name@company.com" />
          <div style={hintStyle}>Detected domain: <b>{inferredDomain || "—"}</b></div>
        </Field>
        <Field label="Password">
          <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" minLength={8} style={inputStyle} placeholder="Min 8 characters" />
        </Field>

        <Field label="Designation">
          <input value={designation} onChange={(e) => setDesignation(e.target.value)} required style={inputStyle} placeholder="e.g. Software Engineer" />
        </Field>
        <Field label="Department">
          <input value={department} onChange={(e) => setDepartment(e.target.value)} required style={inputStyle} placeholder="e.g. Engineering" />
        </Field>
        <Field label="Employee ID">
          <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required style={inputStyle} placeholder="Employee ID" />
        </Field>

        <Field label="Current role">
          <select value={currentRole} onChange={(e) => setCurrentRole(e.target.value as OrgCurrentRole)} style={inputStyle}>
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
          </select>
        </Field>
        <Field label="Mobile no.">
          <input value={mobileNo} onChange={(e) => setMobileNo(e.target.value)} required style={inputStyle} placeholder="Mobile number" />
        </Field>

        <Field label="Reporting manager email">
          <input value={reportingManagerEmail} onChange={(e) => setReportingManagerEmail(e.target.value)} required type="email" style={inputStyle} placeholder="manager@company.com" />
          {reportingManagerEmail.trim() ? (
            <div style={hintStyle}>Detected domain: <b>{inferredMgrDomain || "—"}</b></div>
          ) : null}
        </Field>
        <div />

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
            Already have an account?{" "}
            <Link href="/auth/employee/login" style={{ color: "#2563eb", fontWeight: 900, textDecoration: "none" }}>
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

