"use client";

import { useEffect, useMemo, useState } from "react";
import { appPath } from "@/lib/apiBase";
import {
  orgGetPublicSignupOrgOptions,
  orgRegisterEmployee,
  setOrgAuthInStorage,
  type OrgSignupOptions,
} from "@/lib/orgAuth";

/** Used when `company_org_structures` is not seeded for this domain yet. */
const FALLBACK_DEPARTMENT_OPTIONS = [
  "AI",
  "Cybersec",
  "DataScience",
  "Software",
  "Infra",
  "Sales and Marketing",
  "Finance",
];

const FALLBACK_INDUSTRY_OPTIONS = [
  "IT",
  "Healthcare",
  "Finance & Banking",
  "Manufacturing",
  "Education",
  "Media & Marketing",
  "Construction & Real Estate",
  "Retail & E-Commerce",
  "Energy & Environment",
  "Government & Public",
  "Logistics & Transport",
];

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
  const [designation, setDesignation] = useState("Employee");
  const [department, setDepartment] = useState("");
  const [deptMode, setDeptMode] = useState<"PICK" | "OTHER">("PICK");
  const [deptOther, setDeptOther] = useState("");
  const [industry, setIndustry] = useState("");
  const [industryMode, setIndustryMode] = useState<"PICK" | "OTHER">("PICK");
  const [industryOther, setIndustryOther] = useState("");
  const [reportingManagerEmail, setReportingManagerEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const inferredDomain = useMemo(() => domainFromEmail(email), [email]);

  const [signupOrg, setSignupOrg] = useState<OrgSignupOptions | null>(null);
  const [signupOrgLoading, setSignupOrgLoading] = useState(false);

  const useOrgCatalog = Boolean(signupOrg?.industries?.length);

  /** With org catalog: only departments for the selected industry (none until industry is chosen). */
  const departmentSelectOptions = useMemo(() => {
    if (useOrgCatalog) {
      if (industryMode === "PICK" && industry.trim()) {
        return signupOrg?.byIndustry[industry] ?? [];
      }
      if (industryMode === "OTHER") {
        return FALLBACK_DEPARTMENT_OPTIONS;
      }
      return [];
    }
    return FALLBACK_DEPARTMENT_OPTIONS;
  }, [useOrgCatalog, industryMode, industry, signupOrg]);

  useEffect(() => {
    setIndustry("");
    setIndustryOther("");
    setIndustryMode("PICK");
    setDepartment("");
    setDeptOther("");
    setDeptMode("PICK");
  }, [inferredDomain]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!inferredDomain) {
        setSignupOrg(null);
        setSignupOrgLoading(false);
        return;
      }
      setSignupOrgLoading(true);
      try {
        const o = await orgGetPublicSignupOrgOptions(inferredDomain);
        if (cancelled) return;
        setSignupOrg(o);
      } catch {
        if (!cancelled) setSignupOrg(null);
      } finally {
        if (!cancelled) setSignupOrgLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inferredDomain]);

  const effectiveDepartment = useMemo(() => {
    if (deptMode === "OTHER") return deptOther.trim();
    return department.trim();
  }, [deptMode, deptOther, department]);

  const effectiveIndustry = useMemo(() => {
    if (industryMode === "OTHER") return industryOther.trim();
    return industry.trim();
  }, [industryMode, industryOther, industry]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!inferredDomain) throw new Error("Please enter a valid company email");
      const designationTrimmed = designation.trim();
      if (!designationTrimmed) throw new Error("Designation is required");
      if (!effectiveDepartment) throw new Error("Department is required");
      if (!effectiveIndustry) throw new Error("Industry is required");

      const r = await orgRegisterEmployee({
        email,
        password,
        fullName,
        designation: designationTrimmed,
        department: effectiveDepartment,
        industry: effectiveIndustry,
        companyName,
        employeeId,
        currentRole: "EMPLOYEE",
        mobileNo,
        reportingManagerEmail: reportingManagerEmail.trim() || undefined,
        companyDomain: inferredDomain,
      });
      if ("verificationRequired" in r && r.verificationRequired) {
        const nextPath = appPath("/employee/");
        const debugOtpQuery = r.debugOtp ? `&debugOtp=${encodeURIComponent(r.debugOtp)}` : "";
        window.location.href = `${appPath("/auth/verify-otp")}?email=${encodeURIComponent(r.email)}&next=${encodeURIComponent(nextPath)}${debugOtpQuery}`;
        return;
      }
      if (!("token" in r) || !r.token || !r.user) throw new Error("Registration succeeded but login payload missing.");
      setOrgAuthInStorage(r.token, r.user);
      window.location.href = appPath("/employee/");
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
        Sign up using your <b>company email</b> only. No Google signup.
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
          <input
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            required
            type="text"
            style={inputStyle}
            placeholder="e.g. Employee, Software Engineer"
          />
          <div style={hintStyle}>Defaults to <b>Employee</b>; change it to any job title you use.</div>
        </Field>
        <Field label="Industry">
          <div style={{ display: "grid", gap: 8 }}>
            <select
              value={industryMode === "OTHER" ? "__OTHER__" : (industry || "")}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__OTHER__") {
                  setIndustryMode("OTHER");
                  setIndustry("");
                } else {
                  setIndustryMode("PICK");
                  setIndustry(v);
                  if (useOrgCatalog) {
                    setDepartment("");
                    setDeptOther("");
                    setDeptMode("PICK");
                  }
                }
              }}
              required
              style={inputStyle}
              disabled={Boolean(inferredDomain) && signupOrgLoading}
            >
              <option value="" disabled>
                {!inferredDomain ? "Enter company email first" : signupOrgLoading ? "Loading industries…" : "Select industry"}
              </option>
              {(useOrgCatalog ? signupOrg?.industries ?? [] : FALLBACK_INDUSTRY_OPTIONS).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              <option value="__OTHER__">Other (type…)</option>
            </select>
            {industryMode === "OTHER" ? (
              <input
                value={industryOther}
                onChange={(e) => setIndustryOther(e.target.value)}
                required
                style={inputStyle}
                placeholder="Type your industry"
              />
            ) : null}
            <div style={hintStyle}>
              {useOrgCatalog
                ? "Industries come from your company org mapping (seeded from the department/role files). Choose an industry, then pick a department below."
                : "No org mapping found for this domain yet — using the default industry list."}
            </div>
          </div>
        </Field>
        <Field label="Department">
          <div style={{ display: "grid", gap: 8 }}>
            <select
              key={`dept-${industryMode}-${industry || "none"}`}
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
              disabled={Boolean(useOrgCatalog && industryMode === "PICK" && !industry.trim())}
            >
              <option value="" disabled>
                {useOrgCatalog && industryMode === "PICK" && !industry.trim()
                  ? "Select industry first"
                  : useOrgCatalog && industryMode === "PICK" && industry.trim() && !departmentSelectOptions.length
                    ? "No departments for this industry"
                    : "Select department"}
              </option>
              {departmentSelectOptions.map((d) => (
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
              {useOrgCatalog
                ? "Pick an industry first — then only departments under that industry appear here."
                : "Choose from the list, or select Other to type a custom department."}
            </div>
          </div>
        </Field>
        <Field label="Employee ID">
          <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required style={inputStyle} placeholder="Employee ID" />
        </Field>

        <Field label="Reporting manager email (Gmail)">
          <input
            value={reportingManagerEmail}
            onChange={(e) => setReportingManagerEmail(e.target.value)}
            type="email"
            style={inputStyle}
            placeholder="manager@gmail.com"
          />
          <div style={hintStyle}>
            Optional. If provided, your manager will see you in their employee database.
          </div>
        </Field>

        <Field label="Mobile no.">
          <input value={mobileNo} onChange={(e) => setMobileNo(e.target.value)} required style={inputStyle} placeholder="Mobile number" />
        </Field>

        <div />
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
            <a href={appPath("/auth/employee/login")} style={{ color: "#2563eb", fontWeight: 900, textDecoration: "none" }}>
              Login
            </a>
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

