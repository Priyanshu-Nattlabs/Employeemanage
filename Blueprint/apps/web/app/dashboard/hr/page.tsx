"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { appPath } from "@/lib/apiBase";
import { clearOrgAuthInStorage, getOrgAuthFromStorage, isOrgManagerOrHr } from "@/lib/orgAuth";
import { buildInterviewXManagerLandingUrlWithSso } from "@/lib/interviewx";

export default function HrLandingPage() {
  const [{ token, user }, setAuth] = useState(() => getOrgAuthFromStorage());

  useEffect(() => {
    const on = () => setAuth(getOrgAuthFromStorage());
    window.addEventListener("jbv2-org-auth-changed", on);
    return () => window.removeEventListener("jbv2-org-auth-changed", on);
  }, []);

  useEffect(() => {
    if (!token) {
      window.location.href = appPath("/auth/manager/login");
      return;
    }
    if (!user || !isOrgManagerOrHr(user) || user.currentRole !== "HR") {
      window.location.href = appPath("/dashboard/manager");
      return;
    }
    // HR should also land directly on InterviewX AI Interview (this page is kept for backwards-compatible deep links)
    window.location.href = buildInterviewXManagerLandingUrlWithSso({
      token,
      email: user.email,
      name: user.fullName,
      userType: user.currentRole,
    });
  }, [token, user]);

  const firstName = useMemo(() => {
    const fn = String(user?.fullName || "").trim().split(/\s+/)[0];
    return fn || String(user?.email || "").split("@")[0] || "there";
  }, [user?.fullName, user?.email]);

  if (!token || !user) return null;

  return (
    <div style={wrap}>
      <div style={bg} aria-hidden />

      <div style={hero}>
        <div style={heroTop}>
          <div>
            <div style={pill}>HR workspace</div>
            <h1 style={h1}>Welcome, {firstName}</h1>
            <p style={sub}>
              This is your <b>company monitoring</b> area. Filter employees by industry, department, and role (Employee/Manager),
              then track preparation, test outcomes, and activity—everything managers can do, but across all departments.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link href="/dashboard/manager" style={btnPrimary}>
              Open monitoring dashboard
            </Link>
            <button
              type="button"
              onClick={() => {
                clearOrgAuthInStorage();
                window.location.href = appPath("/");
              }}
              style={btnOutline}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div style={grid}>
        <Card
          title="Monitoring dashboard"
          desc="Company-wide analytics, leaderboards, progress distribution, activity feed, and employee database with filters."
          href="/dashboard/manager"
          accent="#7c3aed"
          icon="📊"
        />
        <Card
          title="Employees"
          desc="Browse the full employee preparation database."
          href="/dashboard/manager/employees"
          accent="#0ea5e9"
          icon="👥"
        />
        <Card
          title="Interview scheduling hub"
          desc="Open interview scheduling handoffs and links."
          href="/dashboard/manager/interviews"
          accent="#10b981"
          icon="🗓"
        />
      </div>
    </div>
  );
}

function Card(props: { title: string; desc: string; href: string; accent: string; icon: string }) {
  return (
    <Link
      href={props.href}
      style={{
        ...card,
        borderColor: `${props.accent}22`,
        boxShadow: `inset 0 3px 0 0 ${props.accent}, 0 10px 28px -18px rgba(15,23,42,0.35)`,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ ...iconBox, background: `${props.accent}14`, borderColor: `${props.accent}33`, color: props.accent }}>
          {props.icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={cardTitle}>{props.title}</div>
          <div style={cardDesc}>{props.desc}</div>
          <div style={cardCta}>
            Open <span aria-hidden>{"→"}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

const wrap: React.CSSProperties = { maxWidth: 1100, margin: "24px auto", padding: "0 14px", position: "relative" };
const bg: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: -1,
  pointerEvents: "none",
  background:
    "radial-gradient(900px 500px at 100% -10%, rgba(124,58,237,0.10), transparent 60%), radial-gradient(700px 400px at -10% 10%, rgba(14,165,233,0.08), transparent 60%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
};

const hero: React.CSSProperties = {
  borderRadius: 22,
  padding: "22px clamp(16px, 3vw, 24px)",
  background: "linear-gradient(135deg,#0f172a 0%,#1e293b 30%,#312e81 65%,#7c3aed 100%)",
  color: "#fff",
  boxShadow: "0 16px 36px -22px rgba(99,102,241,0.55)",
};
const heroTop: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" };
const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "5px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.28)",
  color: "#fff",
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 0.4,
  textTransform: "uppercase",
};
const h1: React.CSSProperties = { margin: "10px 0 0", fontSize: 26, fontWeight: 950, letterSpacing: "-0.02em", lineHeight: 1.1 };
const sub: React.CSSProperties = { margin: "10px 0 0", color: "rgba(255,255,255,0.84)", fontSize: 14, lineHeight: 1.6, maxWidth: 820 };

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 12,
  background: "#fff",
  color: "#0f172a",
  fontWeight: 900,
  textDecoration: "none",
  boxShadow: "0 1px 4px rgba(15,23,42,0.18)",
};
const btnOutline: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.35)",
  background: "rgba(255,255,255,0.10)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 16 };
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e8eef5",
  borderRadius: 18,
  padding: 18,
  textDecoration: "none",
  color: "#0f172a",
};
const iconBox: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 14,
  border: "1px solid",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  flex: "0 0 auto",
};
const cardTitle: React.CSSProperties = { fontSize: 15, fontWeight: 950, margin: 0 };
const cardDesc: React.CSSProperties = { marginTop: 6, color: "#475569", fontSize: 13, lineHeight: 1.55 };
const cardCta: React.CSSProperties = { marginTop: 10, color: "#312e81", fontWeight: 950, fontSize: 13 };

