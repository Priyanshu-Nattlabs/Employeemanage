"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { clearOrgAuthInStorage, getOrgAuthFromStorage } from "@/lib/orgAuth";

export function NavBar() {
  const pathname = usePathname();

  const [orgAuth, setOrgAuth] = useState<{ token: string; user: any | null }>({ token: "", user: null });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const onOrgChange = () => setOrgAuth(getOrgAuthFromStorage());
    setMounted(true);
    onOrgChange();
    window.addEventListener("jbv2-org-auth-changed", onOrgChange);
    return () => window.removeEventListener("jbv2-org-auth-changed", onOrgChange);
  }, [pathname]);

  const logoutOrg = () => {
    clearOrgAuthInStorage();
    window.location.href = "/";
  };

  const user = orgAuth.user as any | null;
  const isLoggedIn = mounted && Boolean(orgAuth.token);
  const isAdmin = Boolean(user && user.accountType === "ADMIN");
  const isManager = Boolean(user && user.accountType === "EMPLOYEE" && user.currentRole === "MANAGER");
  const isEmployee = Boolean(user && user.accountType === "EMPLOYEE" && !isManager);

  const dashboardHref = isAdmin ? "/dashboard/admin" : isManager ? "/dashboard/manager" : "/";
  const profileHref = isAdmin ? "/profile/admin" : "/profile/employee";
  const profileLabel = isAdmin ? "Admin Profile" : "Employee Profile";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 80,
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
        boxShadow: "none",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          height: 64,
          padding: "0 24px",
          gap: 24,
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", textDecoration: "none", color: "#0f172a", gap: 8 }}
        >
          <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: "-0.02em" }}>Employee Portal</div>
        </Link>

        <div style={{ flex: 1 }} />

        {isLoggedIn ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {(isAdmin || isManager) ? (
              <Link href={dashboardHref} style={portalDashStyle}>
                Dashboard
              </Link>
            ) : null}
            <Link href={profileHref} style={portalDashStyle}>
              {profileLabel}
            </Link>
            <button type="button" onClick={logoutOrg} style={portalLogoutStyle}>
              Logout
            </button>
          </div>
        ) : mounted ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/auth/employee/login" style={portalLoginStyle}>
              Login / Signup
            </Link>
            <Link href="/auth/admin/login" style={portalCreateStyle}>
              Admin
            </Link>
          </div>
        ) : null}

      </div>
    </header>
  );
}

const portalLoginStyle: CSSProperties = {
  textDecoration: "none",
  border: "1px solid #cbd5e1",
  color: "#0f172a",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: "20px",
  background: "#fff"
};

const portalCreateStyle: CSSProperties = {
  textDecoration: "none",
  background: "#0f172a",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 14,
  fontWeight: 900,
  lineHeight: "20px"
};

const portalDashStyle: CSSProperties = {
  textDecoration: "none",
  border: "1px solid #cbd5e1",
  color: "#0f172a",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 14,
  fontWeight: 900,
  lineHeight: "20px",
  background: "#fff"
};

const portalLogoutStyle: CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff",
  color: "#991b1b",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 14,
  fontWeight: 900,
  lineHeight: "20px",
  cursor: "pointer"
};

// caretStyle/menu dropdown styles removed (navbar simplified)
