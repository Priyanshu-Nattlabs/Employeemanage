"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";

export function NavBar() {
  const pathname = usePathname();

  const [openMenu, setOpenMenu] = useState<null | "career" | "practice" | "jobs" | "user">(null);

  const [auth, setAuth] = useState({ token: "", email: "", name: "User", userType: "STUDENT", sxUserId: "" });
  const [mounted, setMounted] = useState(false);

  const readAuthFromStorage = useCallback(() => {
    const token = localStorage.getItem("somethingx_auth_token") || "";
    const sxUserId = localStorage.getItem("jbv2_userId") || "";
    let email = "";
    let name = "User";
    let userType = "STUDENT";
    try {
      const user = JSON.parse(localStorage.getItem("somethingx_auth_user") || "{}");
      email = user.email || "";
      name = user.name || "User";
      userType = user.userType || "STUDENT";
    } catch {
      /* ignore invalid JSON */
    }
    setAuth({ token, email, name, userType, sxUserId });
  }, []);

  useEffect(() => {
    setMounted(true);
    readAuthFromStorage();
  }, [pathname, readAuthFromStorage]);

  useEffect(() => {
    window.addEventListener("jbv2-profile-synced", readAuthFromStorage);
    return () => window.removeEventListener("jbv2-profile-synced", readAuthFromStorage);
  }, [readAuthFromStorage]);

  const sxOrigin = (process.env.NEXT_PUBLIC_SAARTHIX_URL || "https://saarthix.com").replace(/\/$/, "");

  const buildSxUrl = (path: string) => {
    const url = new URL(path.startsWith("/") ? `${sxOrigin}${path}` : `${sxOrigin}/${path}`);
    if (auth.token) url.searchParams.set("token", auth.token);
    if (auth.email) url.searchParams.set("email", auth.email);
    if (auth.name && auth.name !== "User") url.searchParams.set("name", auth.name);
    if (auth.userType) url.searchParams.set("userType", auth.userType);
    if (auth.sxUserId) url.searchParams.set("sxUserId", auth.sxUserId);
    return url.toString();
  };

  /** Jobs app: same-origin `/jobs` + route (e.g. `/apply-jobs`), with SSO query — mirrors SomethingX `redirectToJobs`. */
  const buildJobsUrl = (route: string) => {
    const explicit = process.env.NEXT_PUBLIC_JOBS_URL?.trim().replace(/\/$/, "");
    const base = explicit || `${sxOrigin}/jobs`;
    const r = route.startsWith("/") ? route : `/${route}`;
    const url = new URL(`${base.replace(/\/$/, "")}${r}`);
    if (auth.token) url.searchParams.set("token", auth.token);
    if (auth.email) url.searchParams.set("email", auth.email);
    if (auth.name && auth.name !== "User") url.searchParams.set("name", auth.name);
    if (auth.userType) url.searchParams.set("userType", auth.userType);
    if (auth.sxUserId) url.searchParams.set("sxUserId", auth.sxUserId);
    return url.toString();
  };

  const buildResumeUrl = () => {
    const explicit = process.env.NEXT_PUBLIC_RESUME_URL?.trim().replace(/\/$/, "");
    if (explicit) {
      const url = new URL(`${explicit}/`);
      if (auth.token) url.searchParams.set("token", auth.token);
      if (auth.email) url.searchParams.set("email", auth.email);
      if (auth.name && auth.name !== "User") url.searchParams.set("name", auth.name);
      if (auth.userType) url.searchParams.set("userType", auth.userType);
      if (auth.sxUserId) url.searchParams.set("sxUserId", auth.sxUserId);
      return url.toString().replace(/\/$/, "");
    }
    return buildSxUrl("/resume");
  };

  const logout = () => {
    try {
      localStorage.removeItem("somethingx_auth_token");
      localStorage.removeItem("somethingx_auth_user");
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("jbv2_userId");
      localStorage.setItem("somethingx_logout", Date.now().toString());
      localStorage.removeItem("somethingx_logout");
    } catch {
      /* ignore */
    }
    setAuth({ token: "", email: "", name: "User", userType: "STUDENT", sxUserId: "" });
    window.location.href = `${sxOrigin}/login/student`;
  };

  const open = (key: "career" | "practice" | "jobs" | "user") => setOpenMenu(key);
  const close = () => setOpenMenu(null);
  const initials = (auth.name || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "U";

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
          href={buildSxUrl("/students")}
          style={{ display: "flex", alignItems: "center", textDecoration: "none", color: "#0f172a", gap: 8 }}
        >
          <img
            src={`${sxOrigin}/assets/Saarthi%20logoimg.png`}
            alt="SaarthiX Logo"
            style={{ height: 45, width: "auto", display: "block" }}
          />
        </Link>

        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            flex: 1,
            height: "100%",
          }}
        >
          <div onMouseEnter={() => open("career")} onMouseLeave={close} style={{ position: "relative" }}>
            <button type="button" style={menuButtonStyle}>
              <span>Career Tools</span>
              <span style={caretStyle} />
            </button>
            {openMenu === "career" ? (
              <div style={dropdownStyle}>
                <a href={buildSxUrl("/profiling")} style={itemStyle}>
                  Hire me Profile
                </a>
                <a href={buildResumeUrl()} style={itemStyle}>
                  Resume Builder
                </a>
                <a href={buildSxUrl("/students/career-counselling")} style={itemStyle}>
                  Career Counselling
                </a>
              </div>
            ) : null}
          </div>

          <div onMouseEnter={() => open("practice")} onMouseLeave={close} style={{ position: "relative" }}>
            <button type="button" style={menuButtonStyle}>
              <span>Practice</span>
              <span style={caretStyle} />
            </button>
            {openMenu === "practice" ? (
              <div style={dropdownStyle}>
                <a href={buildSxUrl("/students/interview-preparation")} style={itemStyle}>
                  Interview Preparation
                </a>
                <a href={buildSxUrl("/students/personality-test")} style={itemStyle}>
                  Personality Test
                </a>
                <Link href="/" style={itemStyle} onClick={close}>
                  Job Blueprint
                </Link>
              </div>
            ) : null}
          </div>

          <div onMouseEnter={() => open("jobs")} onMouseLeave={close} style={{ position: "relative" }}>
            <button type="button" style={menuButtonStyle}>
              <span>Jobs and Hackathons</span>
              <span style={caretStyle} />
            </button>
            {openMenu === "jobs" ? (
              <div style={dropdownStyle}>
                <a href={buildJobsUrl("/apply-jobs")} style={itemStyle}>
                  Apply to Jobs and Hackathons
                </a>
              </div>
            ) : null}
          </div>

          <a href={buildSxUrl("/about-us")} style={{ ...menuButtonStyle, textDecoration: "none" }}>
            About
          </a>
        </nav>

        <a href={buildSxUrl("/dashboard")} style={dashboardStyle}>
          Dashboard
        </a>

        <div onMouseEnter={() => open("user")} onMouseLeave={close} style={{ position: "relative" }}>
          <button type="button" style={userButtonStyle}>
            <span style={avatarStyle}>{initials}</span>
            <span>{auth.name || "User"}</span>
            <span style={caretStyle} />
          </button>
          {openMenu === "user" ? (
            <div style={{ ...dropdownStyle, right: 0, left: "auto", minWidth: 180 }}>
              <a href={buildSxUrl("/profile-builder")} style={itemStyle}>
                Profile
              </a>
              <button type="button" onClick={logout} style={logoutItemStyle}>
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

const menuButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 15,
  fontWeight: 600,
  color: "#111827",
  cursor: "pointer",
  padding: "0 2px",
  height: 64,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  lineHeight: "20px",
};

const dropdownStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% - 8px)",
  left: -14,
  marginTop: 0,
  minWidth: 220,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  boxShadow: "0 10px 24px rgba(2, 6, 23, 0.14)",
  padding: "8px 0",
  zIndex: 60,
};

const itemStyle: CSSProperties = {
  display: "block",
  padding: "10px 14px",
  fontSize: 14,
  color: "#111827",
  textDecoration: "none",
};

const logoutItemStyle: CSSProperties = {
  ...itemStyle,
  width: "100%",
  border: "none",
  background: "none",
  cursor: "pointer",
  textAlign: "left",
  color: "#dc2626",
  fontFamily: "inherit",
};

const dashboardStyle: CSSProperties = {
  textDecoration: "none",
  background: "#0b5fe8",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 14,
  fontWeight: 700,
  lineHeight: "20px",
};

const userButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: 64,
  cursor: "pointer",
  color: "#111827",
  fontSize: 14,
  fontWeight: 600,
};

const avatarStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "#f59e0b",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 700,
};

const caretStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRight: "1.5px solid #6b7280",
  borderBottom: "1.5px solid #6b7280",
  transform: "rotate(45deg) translateY(-1px)",
  display: "inline-block",
};
