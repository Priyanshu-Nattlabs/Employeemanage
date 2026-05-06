"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getOrgAuthFromStorage, clearOrgAuthInStorage, isOrgManagerOrHr } from "@/lib/orgAuth";
import { appPath } from "@/lib/apiBase";
import { buildInterviewXIndustryOpenUrl } from "@/lib/interviewx";

/**
 * Optional external CDP web app (same SSO pattern as InterviewX).
 * If unset, the Candidate Development card opens the in-app manager dashboard.
 */
function cdpDeepLink(token: string, email: string): string | null {
  const raw = (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_CDP_WEB_ORIGIN : "")?.trim();
  if (!raw) return null;
  const base = raw.replace(/\/$/, "");
  try {
    const u = new URL(`${base}/`);
    u.searchParams.set("from", "blueprint");
    u.searchParams.set("token", token);
    if (email) u.searchParams.set("email", email);
    return u.toString();
  } catch {
    return null;
  }
}

export default function ManagerPortalHomePage() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState("");

  const interviewUrl = useMemo(() => buildInterviewXIndustryOpenUrl(), []);

  const cdpUrl = useMemo(() => {
    if (!token) return "/dashboard/manager/";
    const ext = cdpDeepLink(token, String(user?.email || ""));
    return ext || "/dashboard/manager/";
  }, [token, user]);

  useEffect(() => {
    const { token: tok, user: u } = getOrgAuthFromStorage();
    if (!tok || !u) {
      window.location.href = appPath("/auth/manager/login");
      return;
    }
    if (!isOrgManagerOrHr(u)) {
      window.location.href = appPath("/auth/manager/login");
      return;
    }
    setUser(u);
    setToken(tok);
  }, []);

  const firstName = String(user?.fullName || "there").trim().split(/\s+/)[0] || "there";
  const hours = new Date().getHours();
  const greeting = hours < 12 ? "Good morning" : hours < 17 ? "Good afternoon" : "Good evening";

  const cardBase: React.CSSProperties = {
    borderRadius: 16,
    padding: 22,
    textDecoration: "none",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
    background: "linear-gradient(145deg,#ffffff 0%,#f8fafc 100%)",
    boxShadow: "0 4px 24px -12px rgba(15,23,42,0.15)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minHeight: 168,
    transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div
        style={{
          background: "linear-gradient(125deg,#0f172a 0%,#1e3a5f 42%,#3730a3 100%)",
          padding: "20px 22px 32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: -40, right: "8%", width: 200, height: 200, borderRadius: "50%", background: "rgba(99,102,241,0.12)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -50, left: -30, width: 220, height: 220, borderRadius: "50%", background: "rgba(14,165,233,0.08)", pointerEvents: "none" }} />

        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>Manager / HR</div>
            <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>
              {greeting}, {firstName}
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "rgba(255,255,255,0.65)", maxWidth: 520, lineHeight: 1.55 }}>
              Choose where to work next: interviews on InterviewX, candidate development in TalentX, or the combined overview hub.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                clearOrgAuthInStorage();
                window.location.href = appPath("/auth/manager/login");
              }}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 10,
                color: "rgba(255,255,255,0.85)",
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "-28px auto 0", padding: "0 18px 40px", position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          <a
            href={interviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={cardBase}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 16px 40px -16px rgba(99,102,241,0.45)";
              e.currentTarget.style.borderColor = "#c7d2fe";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 4px 24px -12px rgba(15,23,42,0.15)";
              e.currentTarget.style.borderColor = "#e2e8f0";
            }}
          >
            <span style={{ fontSize: 28 }}>🎙️</span>
            <div style={{ fontSize: 17, fontWeight: 900 }}>InterviewX</div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, flex: 1 }}>
              Schedule and review external candidate interviews, hiring recommendations, and AI interview runs.
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#6366f1" }}>Open InterviewX ↗</span>
          </a>

          {cdpUrl.startsWith("http") ? (
            <a
              href={cdpUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={cardBase}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 16px 40px -16px rgba(16,185,129,0.35)";
                e.currentTarget.style.borderColor = "#a7f3d0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "0 4px 24px -12px rgba(15,23,42,0.15)";
                e.currentTarget.style.borderColor = "#e2e8f0";
              }}
            >
              <span style={{ fontSize: 28 }}>📈</span>
              <div style={{ fontSize: 17, fontWeight: 900 }}>Candidate development</div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, flex: 1 }}>
                Open the CDP workspace (configured via NEXT_PUBLIC_CDP_WEB_ORIGIN) with a TalentX hand-off.
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>Open CDP ↗</span>
            </a>
          ) : (
            <Link
              href={cdpUrl}
              style={cardBase}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 16px 40px -16px rgba(16,185,129,0.35)";
                e.currentTarget.style.borderColor = "#a7f3d0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "0 4px 24px -12px rgba(15,23,42,0.15)";
                e.currentTarget.style.borderColor = "#e2e8f0";
              }}
            >
              <span style={{ fontSize: 28 }}>📈</span>
              <div style={{ fontSize: 17, fontWeight: 900 }}>Candidate development</div>
              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, flex: 1 }}>
                Track role prep, skill tests, recommendations, and department progress for your team in TalentX.
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>Open manager dashboard →</span>
            </Link>
          )}

          <Link
            href="/dashboard/manager/hub/"
            style={cardBase}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 16px 40px -16px rgba(14,165,233,0.4)";
              e.currentTarget.style.borderColor = "#bae6fd";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "0 4px 24px -12px rgba(15,23,42,0.15)";
              e.currentTarget.style.borderColor = "#e2e8f0";
            }}
          >
            <span style={{ fontSize: 28 }}>🧭</span>
            <div style={{ fontSize: 17, fontWeight: 900 }}>Overview hub</div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, flex: 1 }}>
              Combined InterviewX analytics and learning analytics in one dashboard.
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#0284c7" }}>Open overview hub →</span>
          </Link>
        </div>

        <p style={{ marginTop: 22, fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 1.6 }}>
          Tip: after you leave this page, use the <b>Corporate Development</b> logo in the header to return here.
        </p>
      </div>
    </div>
  );
}
