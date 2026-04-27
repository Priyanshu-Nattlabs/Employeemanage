"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getApiPrefix } from "@/lib/apiBase";
import { getOrgAuthFromStorage } from "@/lib/orgAuth";

const API = getApiPrefix();

type OngoingPrep = {
  roleName: string;
};

function normalizeRoleText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandQueryTokens(value: string): string[] {
  const base = normalizeRoleText(value).split(" ").filter(Boolean);
  const out = new Set<string>(base);
  const aliases: Record<string, string[]> = {
    developer: ["development", "engineer", "engineering", "dev"],
    development: ["developer", "engineer", "engineering", "dev"],
    engineer: ["engineering", "developer", "development"],
    engineering: ["engineer", "developer", "development"],
    frontend: ["front end", "front-end", "ui"],
    backend: ["back end", "back-end", "api"],
    fullstack: ["full stack", "full-stack"],
  };
  for (const token of base) {
    for (const alt of aliases[token] || []) out.add(alt);
  }
  return Array.from(out);
}

export default function TargetRolePage() {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingRole, setSavingRole] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const auth = getOrgAuthFromStorage();
    if (!auth?.token || !auth?.user || auth.user.accountType !== "EMPLOYEE") {
      window.location.href = "/auth/employee/login";
      return;
    }

    const userId = auth.user.id;
    const load = async () => {
      try {
        const [allRes, ongoingRes] = await Promise.all([
          fetch(`${API}/api/blueprint/all`),
          fetch(`${API}/api/role-preparation/ongoing?studentId=${encodeURIComponent(userId)}`),
        ]);

        const allData = await allRes.json().catch(() => []);
        const ongoingData = await ongoingRes.json().catch(() => []);
        const roleNames = Array.isArray(allData)
          ? allData
              .filter((d: any) => String(d?.type || "").toLowerCase() === "role")
              .map((d: any) => String(d?.name || "").trim())
              .filter(Boolean)
          : [];
        setRoles(roleNames);

        // If user already has an active target role, continue directly.
        if (Array.isArray(ongoingData) && ongoingData.length > 0) {
          const first = ongoingData[0] as OngoingPrep;
          if (first?.roleName) {
            window.location.href = `/role/${encodeURIComponent(first.roleName)}`;
            return;
          }
        }
      } catch (e: any) {
        setError(e?.message || "Unable to load roles.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredRoles = useMemo(() => {
    const q = search.trim();
    if (!q) return roles;
    const terms = expandQueryTokens(q);
    return roles.filter((r) => {
      const name = normalizeRoleText(r);
      return terms.every((t) => name.includes(normalizeRoleText(t)));
    });
  }, [roles, search]);

  const selectRole = async (roleName: string) => {
    const auth = getOrgAuthFromStorage();
    if (!auth?.user?.id) {
      window.location.href = "/auth/employee/login";
      return;
    }
    setSavingRole(roleName);
    setError("");
    try {
      await fetch(
        `${API}/api/role-preparation/start/${encodeURIComponent(roleName)}?studentId=${encodeURIComponent(auth.user.id)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }
      );
      window.location.href = `/role/${encodeURIComponent(roleName)}`;
    } catch (e: any) {
      setError(e?.message || "Could not save target role.");
      setSavingRole("");
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <p style={crumb}>
          <Link href="/" style={link}>
            Home
          </Link>{" "}
          › Target Role
        </p>
        <h1 style={h1}>Choose your target role</h1>
        <p style={sub}>
          Step 1 after login: select the next role you are targeting. We will track your journey and prepare your
          blueprint from this role.
        </p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roles..."
          style={input}
          disabled={loading}
        />

        {error ? <div style={err}>{error}</div> : null}

        <div style={list}>
          {loading ? (
            <div style={muted}>Loading roles...</div>
          ) : filteredRoles.length === 0 ? (
            <div style={muted}>No matching roles found.</div>
          ) : (
            filteredRoles.map((role) => (
              <button
                key={role}
                onClick={() => selectRole(role)}
                disabled={!!savingRole}
                style={roleBtn}
                title={`Set ${role} as target role`}
              >
                <span style={{ fontWeight: 700, color: "#0f172a", textAlign: "left" }}>{role}</span>
                <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 700 }}>
                  {savingRole === role ? "Saving..." : "Select"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { maxWidth: 980, margin: "22px auto", padding: "0 12px" };
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20,
  boxShadow: "0 2px 10px rgba(15, 23, 42, 0.05)",
};
const h1: React.CSSProperties = { margin: "0 0 8px", color: "#0f172a", fontWeight: 900, fontSize: 26 };
const sub: React.CSSProperties = { margin: "0 0 14px", color: "#475569", lineHeight: 1.6, fontSize: 14 };
const input: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  minHeight: 42,
  padding: "8px 12px",
  marginBottom: 12,
  fontSize: 14,
};
const list: React.CSSProperties = {
  display: "grid",
  gap: 8,
  maxHeight: "62vh",
  overflow: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 8,
};
const roleBtn: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: 10,
  padding: "12px 14px",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};
const err: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 10,
  padding: "10px 12px",
  marginBottom: 10,
  fontSize: 13,
};
const crumb: React.CSSProperties = { margin: "0 0 8px", color: "#64748b", fontSize: 13 };
const link: React.CSSProperties = { color: "#2563eb", textDecoration: "none", fontWeight: 700 };
const muted: React.CSSProperties = { color: "#64748b", textAlign: "center", padding: "18px 8px", fontSize: 14 };
