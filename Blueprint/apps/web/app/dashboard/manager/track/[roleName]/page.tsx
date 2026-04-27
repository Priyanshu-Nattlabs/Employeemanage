"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { getOrgAuthFromStorage } from "@/lib/orgAuth";
import AnalyticsPage from "@/app/role/[roleName]/analytics/page";

/**
 * Manager / HR-scoped employee tracking page.
 *
 * Lives at: /dashboard/manager/track/[roleName]?studentId=...&employeeEmail=...&employeeName=...
 *
 * Renders the same analytics data the employee sees on /role/[roleName]/analytics,
 * but framed as a "tracking" page with a manager-context banner and gated to
 * MANAGER / HR / ADMIN roles only.
 */
export default function ManagerTrackPage() {
  const params = useParams<{ roleName: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleName = useMemo(
    () => decodeURIComponent(String(params?.roleName || "")),
    [params?.roleName],
  );

  const [mounted, setMounted] = useState(false);
  const [authorized, setAuthorized] = useState<null | boolean>(null);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    const auth = getOrgAuthFromStorage();
    const user = auth?.user || null;
    const ok =
      !!user &&
      (user.accountType === "ADMIN" ||
        user.currentRole === "MANAGER" ||
        user.currentRole === "HR");
    setMe(user);
    setAuthorized(ok);
  }, []);

  // Pull employee context out of the query string so we can show it in the banner.
  const employeeName = (searchParams?.get("employeeName") || "").trim();
  const employeeEmail = (searchParams?.get("employeeEmail") || "").trim();
  const studentId = (searchParams?.get("studentId") || "").trim();
  const displayName = employeeName || employeeEmail || "this employee";

  if (!mounted || authorized === null) return null;

  // Guard: only managers / HR / admins can view this tracking page.
  if (!authorized) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
          <h2 style={{ margin: "0 0 6px", color: "#0f172a" }}>Manager access required</h2>
          <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 14 }}>
            This page is part of the manager / HR dashboard. Sign in with a manager or HR
            account to track employee preparation here.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/auth/manager/login" style={primaryBtn}>Manager / HR login</Link>
            <Link href="/dashboard/manager" style={ghostBtn}>Back to dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      {/* Manager-context banner — sits above the shared analytics view */}
      <div style={banner}>
        {/* decorative blobs (subtle) */}
        <div style={blobA} />
        <div style={blobB} />

        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <div style={iconTile}>👥</div>
            <div style={{ minWidth: 0 }}>
              <div style={breadcrumb}>
                <Link href="/dashboard/manager" style={crumbLink}>Dashboard</Link>
                <span style={crumbSep}>›</span>
                <span style={crumbCur}>Track Employee</span>
                <span style={crumbSep}>›</span>
                <span style={crumbCur}>{roleName || "Role"}</span>
              </div>
              <h1 style={title}>
                Tracking <span style={{ color: "#fef3c7" }}>{displayName}</span>
              </h1>
              <div style={subline}>
                {employeeEmail ? <span>{employeeEmail}</span> : null}
                {employeeEmail && roleName ? <span style={{ opacity: 0.5 }}> · </span> : null}
                {roleName ? <span>Role: <b>{roleName}</b></span> : null}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={chipManager}>{me?.currentRole === "HR" ? "HR view" : "Manager view"}</span>
            <button onClick={() => router.push("/dashboard/manager")} style={btnSolid}>← Back to dashboard</button>
          </div>
        </div>
      </div>

      {/* Re-uses the same analytics component the employee sees, with a manager
          context wrapper so the URL/page is distinct from /role/.../analytics. */}
      <div style={{ marginTop: 6 }}>
        <AnalyticsPage />
      </div>
    </div>
  );
}

// ===================== Styles =====================

const wrap: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 1px 10px rgba(15,23,42,0.04)",
};

const banner: React.CSSProperties = {
  borderRadius: 22,
  padding: "22px 24px",
  background: "linear-gradient(135deg,#0f172a 0%,#1e293b 30%,#312e81 65%,#7c3aed 100%)",
  color: "#fff",
  position: "relative",
  overflow: "hidden",
  boxShadow: "0 16px 36px -22px rgba(99,102,241,0.55)",
};

const blobA: React.CSSProperties = {
  position: "absolute", top: -50, right: -30, width: 200, height: 200,
  borderRadius: "50%", background: "rgba(168,85,247,0.28)", filter: "blur(2px)",
};
const blobB: React.CSSProperties = {
  position: "absolute", bottom: -60, right: 110, width: 140, height: 140,
  borderRadius: "50%", background: "rgba(236,72,153,0.20)",
};

const iconTile: React.CSSProperties = {
  width: 50, height: 50, borderRadius: 14,
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.28)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 22, flex: "0 0 auto",
};

const breadcrumb: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 700,
  marginBottom: 6,
};
const crumbLink: React.CSSProperties = {
  color: "rgba(255,255,255,0.92)", textDecoration: "none",
  borderBottom: "1px dashed rgba(255,255,255,0.4)", paddingBottom: 1,
};
const crumbSep: React.CSSProperties = { color: "rgba(255,255,255,0.5)" };
const crumbCur: React.CSSProperties = { color: "#fff" };

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: "-0.01em",
  lineHeight: 1.15,
};

const subline: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "rgba(255,255,255,0.78)",
};

const chipManager: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "5px 12px", borderRadius: 999,
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.28)",
  color: "#fff", fontWeight: 800, fontSize: 12,
  letterSpacing: 0.3,
};

const btnSolid: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "8px 14px", borderRadius: 10,
  background: "#fff", color: "#0f172a",
  border: "none", fontWeight: 800, fontSize: 13,
  cursor: "pointer", boxShadow: "0 1px 4px rgba(15,23,42,0.18)",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "10px 18px", borderRadius: 10,
  background: "#4f46e5", color: "#fff",
  border: "none", fontWeight: 800, fontSize: 13,
  textDecoration: "none", cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "10px 18px", borderRadius: 10,
  background: "#fff", color: "#0f172a",
  border: "1px solid #e5e7eb", fontWeight: 800, fontSize: 13,
  textDecoration: "none", cursor: "pointer",
};
