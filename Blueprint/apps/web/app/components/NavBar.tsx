"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { appPath, publicAssetUrl } from "@/lib/apiBase";
import {
  clearOrgAuthInStorage,
  getOrgAuthFromStorage,
  isOrgManagerOrHr,
  orgListMyRecommendations,
  orgUpdateRecommendationStatus,
  type RoleRecommendation,
} from "@/lib/orgAuth";

import "./NavBar.css";

const NOTIF_POLL_MS = 30_000;

export function NavBar() {
  const pathname = usePathname();

  const [orgAuth, setOrgAuth] = useState<{ token: string; user: any | null }>({ token: "", user: null });
  const [mounted, setMounted] = useState(false);
  const [authMenuOpen, setAuthMenuOpen] = useState(false);

  // Notifications (employee-side). For managers/HR/admin we skip polling entirely.
  const [notifs, setNotifs] = useState<RoleRecommendation[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [popupRec, setPopupRec] = useState<RoleRecommendation | null>(null);
  const [shownPopupIds, setShownPopupIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onOrgChange = () => setOrgAuth(getOrgAuthFromStorage());
    setMounted(true);
    onOrgChange();
    window.addEventListener("jbv2-org-auth-changed", onOrgChange);
    return () => window.removeEventListener("jbv2-org-auth-changed", onOrgChange);
  }, [pathname]);

  const logoutOrg = () => {
    clearOrgAuthInStorage();
    window.location.href = appPath("/");
  };

  const user = orgAuth.user as any | null;
  const isLoggedIn = mounted && Boolean(orgAuth.token);
  const isAdmin = Boolean(user && user.accountType === "ADMIN");
  const isManagerOrHR = isOrgManagerOrHr(user);
  const isEmployee = Boolean(user && user.accountType === "EMPLOYEE" && !isManagerOrHR);

  useEffect(() => {
    setAuthMenuOpen(false);
  }, [pathname, isLoggedIn]);

  // Poll inbox for employees only — they get the notification bell + popup.
  useEffect(() => {
    if (!isEmployee || !orgAuth.token) {
      setNotifs([]);
      return;
    }
    let cancelled = false;
    const fetchInbox = async () => {
      try {
        const list = await orgListMyRecommendations(orgAuth.token);
        if (cancelled) return;
        setNotifs(Array.isArray(list) ? list : []);
        const pending = (list || []).filter((r) => r.status === "PENDING");
        const unseen = pending.find((r) => !shownPopupIds.has(r._id));
        if (unseen) {
          setPopupRec(unseen);
          setShownPopupIds((prev) => {
            const next = new Set(prev);
            next.add(unseen._id);
            return next;
          });
        }
      } catch {
        /* silent — keep last good list */
      }
    };
    void fetchInbox();
    const id = window.setInterval(() => void fetchInbox(), NOTIF_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // We deliberately do not depend on shownPopupIds; we track within the closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmployee, orgAuth.token]);

  const pendingNotifs = notifs.filter((r) => r.status === "PENDING" || r.status === "SEEN");
  const pendingCount = notifs.filter((r) => r.status === "PENDING").length;

  const markStatus = async (id: string, status: "SEEN" | "DISMISSED" | "ACCEPTED") => {
    try {
      const updated = await orgUpdateRecommendationStatus(orgAuth.token, id, status);
      setNotifs((prev) => prev.map((n) => (n._id === id ? { ...n, ...updated } : n)));
    } catch {
      /* ignore */
    }
  };

  const goToRole = async (rec: RoleRecommendation) => {
    await markStatus(rec._id, "SEEN");
    setNotifOpen(false);
    setPopupRec(null);
    window.location.href = appPath(`/role/${encodeURIComponent(rec.roleName)}`);
  };

  const dashboardHref = isAdmin ? "/dashboard/admin" : isManagerOrHR ? "/dashboard/manager" : "/";
  const profileHref = isAdmin ? "/profile/admin" : "/profile/employee";
  const profileLabel = isAdmin ? "Admin Profile" : "Employee Profile";
  /** Employees → employee hub; managers/HR → portal chooser; others → marketing home. */
  const brandHref = isLoggedIn && isEmployee ? "/employee/" : isLoggedIn && isManagerOrHR ? "/dashboard/manager/home/" : "/";

  return (
    <header className="jb-nav">
      <div className="jb-nav__inner">
        <Link
          href={brandHref}
          className="jb-nav__brand"
          aria-label={
            isLoggedIn && isEmployee
              ? "Corporate Development — go to employee home"
              : isLoggedIn && isManagerOrHR
                ? "Corporate Development — manager and HR portal"
                : "Corporate Development — home"
          }
        >
          <img
            src={publicAssetUrl("/brand/corporate-development.png")}
            alt="Corporate Development"
            width={534}
            height={80}
            className="jb-nav__logo"
            decoding="async"
            fetchPriority="high"
          />
        </Link>

        <div style={{ flex: 1, minWidth: 0 }} />

        {isLoggedIn ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0, maxWidth: "100%" }}>
            {isEmployee ? (
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label="Notifications"
                  style={bellStyle}
                  title={pendingCount ? `${pendingCount} new role recommendation${pendingCount > 1 ? "s" : ""}` : "Notifications"}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>🔔</span>
                  {pendingCount > 0 ? (
                    <span style={badgeStyle}>{pendingCount > 9 ? "9+" : pendingCount}</span>
                  ) : null}
                </button>
                {notifOpen ? (
                  <div style={dropdownStyle} onMouseLeave={() => setNotifOpen(false)}>
                    <div style={dropdownHeader}>
                      <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 14 }}>Notifications</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>
                        {pendingCount > 0 ? `${pendingCount} new` : "You're all caught up"}
                      </div>
                    </div>
                    {pendingNotifs.length === 0 ? (
                      <div style={{ padding: 18, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                        No role recommendations yet.
                      </div>
                    ) : (
                      <div style={{ maxHeight: 360, overflowY: "auto" }}>
                        {pendingNotifs.map((rec) => (
                          <div key={rec._id} style={notifItem}>
                            <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                              Role suggestion
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginTop: 2 }}>
                              {rec.roleName}
                            </div>
                            <div style={{ fontSize: 12, color: "#475569", marginTop: 4, lineHeight: 1.5 }}>
                              From <b>{rec.recommendedByName || rec.recommendedByEmail}</b>
                              {rec.recommendedByRole ? <> · {rec.recommendedByRole === "HR" ? "HR" : "Manager"}</> : null}
                            </div>
                            {rec.note ? (
                              <div style={{ fontSize: 12, color: "#334155", marginTop: 6, padding: "6px 8px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontStyle: "italic" }}>
                                "{rec.note}"
                              </div>
                            ) : null}
                            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                              <button onClick={() => goToRole(rec)} style={notifPrimaryBtn}>
                                View role
                              </button>
                              <button onClick={() => void markStatus(rec._id, "DISMISSED")} style={notifSecondaryBtn}>
                                Dismiss
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
            {(isAdmin || isManagerOrHR) ? (
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
          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
            <button type="button" style={portalLoginStyle} onClick={() => setAuthMenuOpen((v) => !v)}>
              Login / Signup
            </button>
            {authMenuOpen ? (
              <div style={authMenuCard}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>Choose login type</div>
                <Link href="/auth/employee/login" style={authMenuItem}>
                  Login as Employee
                </Link>
                <Link href="/auth/manager/login" style={authMenuItem}>
                  Login as Manager / HR
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

      </div>

      {/* Popup card shown once per pending recommendation per session */}
      {popupRec ? (
        <div style={popupBackdrop} onClick={() => setPopupRec(null)}>
          <div style={popupCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1 }}>
              New role recommendation
            </div>
            <h3 style={{ margin: "6px 0 4px", color: "#0f172a", fontSize: 18, fontWeight: 900 }}>
              {popupRec.recommendedByName || popupRec.recommendedByEmail} suggested a role for you
            </h3>
            <div style={{ fontSize: 13, color: "#475569" }}>
              They think <b style={{ color: "#5b21b6" }}>{popupRec.roleName}</b> is a good fit. Open the role page to start preparing.
            </div>
            {popupRec.note ? (
              <div style={{ marginTop: 10, padding: "8px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, color: "#334155", fontStyle: "italic" }}>
                "{popupRec.note}"
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={() => goToRole(popupRec)} style={popupPrimary}>View role</button>
              <button onClick={() => { void markStatus(popupRec._id, "SEEN"); setPopupRec(null); }} style={popupSecondary}>Later</button>
              <button onClick={() => { void markStatus(popupRec._id, "DISMISSED"); setPopupRec(null); }} style={popupGhost}>Dismiss</button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

const portalLoginStyle: CSSProperties = {
  textDecoration: "none",
  border: "1px solid rgba(5, 74, 144, 0.22)",
  color: "#0f172a",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: "20px",
  background: "#fff",
  cursor: "pointer",
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

const authMenuCard: CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 8px)",
  width: 230,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 16px 34px -14px rgba(15,23,42,0.28)",
  padding: 10,
  zIndex: 100,
};

const authMenuItem: CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "#0f172a",
  border: "1px solid #e2e8f0",
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 13,
  fontWeight: 700,
  marginTop: 6,
  background: "#f8fafc",
};

const portalDashStyle: CSSProperties = {
  textDecoration: "none",
  border: "1px solid rgba(5, 74, 144, 0.22)",
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

const bellStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 38,
  height: 38,
  borderRadius: 999,
  background: "#fff",
  border: "1px solid rgba(5, 74, 144, 0.2)",
  cursor: "pointer",
  padding: 0,
};

const badgeStyle: CSSProperties = {
  position: "absolute",
  top: -4,
  right: -4,
  minWidth: 18,
  height: 18,
  padding: "0 5px",
  borderRadius: 999,
  background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
  color: "#fff",
  fontSize: 10,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 2px 6px rgba(220,38,38,0.35)",
  border: "2px solid #fff",
};

const dropdownStyle: CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 8px)",
  width: 340,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  boxShadow: "0 20px 35px -10px rgba(15,23,42,0.18)",
  overflow: "hidden",
  zIndex: 90,
};

const dropdownHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  borderBottom: "1px solid #f1f5f9",
  background: "linear-gradient(135deg, #faf5ff 0%, #fdf4ff 100%)",
};

const notifItem: CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #f1f5f9",
};

const notifPrimaryBtn: CSSProperties = {
  background: "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)",
  color: "#fff",
  border: "none",
  padding: "6px 12px",
  borderRadius: 8,
  fontWeight: 900,
  fontSize: 12,
  cursor: "pointer",
  boxShadow: "0 4px 10px -4px rgba(124,58,237,0.55)",
};

const notifSecondaryBtn: CSSProperties = {
  background: "#fff",
  color: "#475569",
  border: "1px solid #cbd5e1",
  padding: "6px 12px",
  borderRadius: 8,
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
};

const popupBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.5)",
  backdropFilter: "blur(2px)",
  zIndex: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const popupCard: CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: "#fff",
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  padding: 22,
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
};

const popupPrimary: CSSProperties = {
  background: "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)",
  color: "#fff",
  border: "none",
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
  boxShadow: "0 8px 20px -8px rgba(124,58,237,0.55)",
};

const popupSecondary: CSSProperties = {
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #cbd5e1",
  padding: "10px 14px",
  borderRadius: 10,
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};

const popupGhost: CSSProperties = {
  background: "transparent",
  color: "#94a3b8",
  border: "none",
  padding: "10px 8px",
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
