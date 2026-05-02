"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { orgRegisterEmployee, setOrgAuthInStorage, type OrgCurrentRole } from "@/lib/orgAuth";
import { appPath } from "@/lib/apiBase";

const DEPARTMENT_OPTIONS = [
  "Technology",
  "Management",
  "Design & Creative",
  "Finance & Accounting",
  "Sales & Marketing",
  "Healthcare",
  "Education & Research",
  "Operations & Logistics",
  "Legal & Compliance",
  "Human Resources",
  "Analytics & Data",
];

function domainFromEmail(email: string) {
  const v = email.trim().toLowerCase();
  const at = v.indexOf("@");
  if (at < 0) return "";
  return v.slice(at + 1);
}

export default function ManagerRegisterPage() {
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // "MANAGER" requires a department; "HR" sees the entire company.
  const [accountKind, setAccountKind] = useState<Extract<OrgCurrentRole, "MANAGER" | "HR">>("MANAGER");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [deptMode, setDeptMode] = useState<"PICK" | "OTHER">("PICK");
  const [deptOther, setDeptOther] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [reportingManagerEmail, setReportingManagerEmail] = useState("");

  const inferredDomain = useMemo(() => domainFromEmail(email), [email]);
  const inferredMgrDomain = useMemo(() => domainFromEmail(reportingManagerEmail), [reportingManagerEmail]);

  const isHR = accountKind === "HR";

  const effectiveDepartment = useMemo(() => {
    if (deptMode === "OTHER") return deptOther.trim();
    return department.trim();
  }, [deptMode, deptOther, department]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!inferredDomain) throw new Error("Please enter a valid company email");
      if (!reportingManagerEmail.trim()) throw new Error("Reporting manager email is required");
      if (inferredMgrDomain && inferredMgrDomain !== inferredDomain) throw new Error("Reporting manager email must be in the same company domain");
      if (!isHR && !effectiveDepartment) throw new Error("Department is required for managers");

      const r = await orgRegisterEmployee({
        email,
        password,
        fullName,
        designation,
        department: isHR ? undefined : effectiveDepartment,
        companyName,
        employeeId,
        currentRole: accountKind,
        mobileNo,
        reportingManagerEmail,
        companyDomain: inferredDomain
      });
      if ("verificationRequired" in r && r.verificationRequired) {
        const debugOtpQuery = r.debugOtp ? `&debugOtp=${encodeURIComponent(r.debugOtp)}` : "";
        window.location.href = `${appPath("/auth/verify-otp")}?email=${encodeURIComponent(r.email)}&next=${encodeURIComponent(appPath("/dashboard/manager/home"))}${debugOtpQuery}`;
        return;
      }
      if (!("token" in r) || !r.token || !r.user) throw new Error("Registration succeeded but login payload missing.");
      setOrgAuthInStorage(r.token, r.user);
      window.location.href = appPath("/dashboard/manager/home");
    } catch (err: any) {
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 820, margin: "24px auto", padding: 24, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Manager/HR create account</h1>
      <p style={{ margin: "8px 0 16px", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
        Create a workspace account using your <b>company email</b>. Choose <b>Manager</b> to monitor employees in your department, or <b>HR</b> to view all employees across your company.
      </p>

      <div role="tablist" aria-label="Account type" style={tabBar}>
        <button type="button" role="tab" aria-selected={accountKind === "MANAGER"} onClick={() => setAccountKind("MANAGER")} style={accountKind === "MANAGER" ? tabActive : tabIdle}>
          Manager
        </button>
        <button type="button" role="tab" aria-selected={accountKind === "HR"} onClick={() => setAccountKind("HR")} style={accountKind === "HR" ? tabActive : tabIdle}>
          HR
        </button>
      </div>

      <div style={infoBanner}>
        {isHR
          ? "HR accounts can see preparation data of every employee that signs up under your company domain — no department needed."
          : "Manager accounts only see employees from the same department as you."}
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
        <Field label="Full name">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required style={inputStyle} placeholder={isHR ? "HR name" : "Manager name"} />
        </Field>
        <Field label="Company name">
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required style={inputStyle} placeholder="Company" />
        </Field>

        <Field label="Company email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" style={inputStyle} placeholder={isHR ? "hr@company.com" : "manager@company.com"} />
          <div style={hintStyle}>Detected domain: <b>{inferredDomain || "—"}</b></div>
        </Field>
        <Field label="Password">
          <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" minLength={8} style={inputStyle} placeholder="Min 8 characters" />
        </Field>

        <Field label="Designation">
          <input value={designation} onChange={(e) => setDesignation(e.target.value)} required style={inputStyle} placeholder={isHR ? "e.g. HR Business Partner" : "e.g. Team Lead"} />
        </Field>

        {isHR ? (
          <Field label="Scope">
            <div style={readOnlyBox}>Company-wide (all departments)</div>
          </Field>
        ) : (
          <Field label="Department">
            <div style={{ display: "grid", gap: 8 }}>
              <select
                value={deptMode === "OTHER" ? "__OTHER__" : (department || "")}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__OTHER__") {
                    setDeptMode("OTHER");
                    setDepartment("");
                  } else {
                    setDeptMode("PICK");
                    setDepartment(v);
                  }
                }}
                required
                style={inputStyle}
              >
                <option value="" disabled>Select department</option>
                {DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value="__OTHER__">Other (type…)</option>
              </select>
              {deptMode === "OTHER" ? (
                <input
                  value={deptOther}
                  onChange={(e) => setDeptOther(e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="Type your department"
                />
              ) : null}
              <div style={hintStyle}>
                Choose from the list, or select <b>Other</b> to type a custom department.
              </div>
            </div>
          </Field>
        )}

        <Field label="Employee ID">
          <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required style={inputStyle} placeholder="Employee ID" />
        </Field>
        <Field label="Mobile no.">
          <input value={mobileNo} onChange={(e) => setMobileNo(e.target.value)} required style={inputStyle} placeholder="Mobile number" />
        </Field>

        <Field label="Reporting manager email">
          <input value={reportingManagerEmail} onChange={(e) => setReportingManagerEmail(e.target.value)} required type="email" style={inputStyle} placeholder="head@company.com" />
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
            {loading ? "Creating..." : `Create ${isHR ? "HR" : "Manager"} account`}
          </button>
          <div style={{ fontSize: 13, color: "#475569" }}>
            Already have an account?{" "}
            <Link href="/auth/manager/login" style={{ color: "#2563eb", fontWeight: 900, textDecoration: "none" }}>
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
const tabBar: React.CSSProperties = { display: "inline-flex", padding: 4, borderRadius: 12, background: "#f1f5f9", border: "1px solid #e2e8f0", gap: 4 };
const tabIdle: React.CSSProperties = { background: "transparent", color: "#475569", border: "none", padding: "8px 16px", borderRadius: 10, fontWeight: 800, cursor: "pointer", fontSize: 13 };
const tabActive: React.CSSProperties = { ...tabIdle, background: "#fff", color: "#0f172a", boxShadow: "0 1px 2px rgba(15,23,42,0.08)" };
const infoBanner: React.CSSProperties = { marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#eef6ff", border: "1px solid #cfe2ff", color: "#1d4ed8", fontSize: 13, lineHeight: 1.5 };
const readOnlyBox: React.CSSProperties = { ...inputStyle, display: "flex", alignItems: "center", background: "#f8fafc", color: "#475569", fontWeight: 700 };
