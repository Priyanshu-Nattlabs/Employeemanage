"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getApiPrefix } from "@/lib/apiBase";
import { getOrgAuthFromStorage } from "@/lib/orgAuth";

const API = getApiPrefix();

type OngoingPrep = {
  roleName: string;
};

type RoleOption = {
  name: string;
  level?: string;
};

function normalizeRoleText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandQueryTokens(value: string): string[][] {
  const base = normalizeRoleText(value).split(" ").filter(Boolean);
  const out: string[][] = [];
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
    out.push([token, ...(aliases[token] || [])]);
  }
  return out;
}

function inferLevel(name: string, explicitLevel?: string): string {
  const clean = String(explicitLevel || "").trim();
  if (clean) return clean;
  const m = /(?:^|[-\s])([1-3])$/.exec(String(name || "").trim());
  return m?.[1] || "";
}

export default function TargetRolePage() {
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingRole, setSavingRole] = useState("");
  const [error, setError] = useState("");
  const [targetDurationMonths, setTargetDurationMonths] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");

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
        const roleRows = Array.isArray(allData)
          ? allData
              .filter((d: any) => String(d?.type || "").toLowerCase() === "role")
              .map((d: any) => ({
                name: String(d?.name || "").trim(),
                level: inferLevel(String(d?.name || "").trim(), d?.level !== undefined && d?.level !== null ? String(d.level).trim() : ""),
              }))
              .filter((d: RoleOption) => d.name)
          : [];
        setRoles(roleRows);

        // Keep role picker visible so user can intentionally switch target role.
        // "Go to your preparation" CTA on homepage handles direct resume flow.
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
    const byLevel = selectedLevel ? roles.filter((r) => String(r.level || "") === selectedLevel) : roles;
    if (!q) return byLevel;
    const tokenGroups = expandQueryTokens(q);
    return byLevel.filter((r) => {
      const hay = normalizeRoleText(`${r.name} level ${r.level || ""}`);
      return tokenGroups.every((group) =>
        group.some((term) => hay.includes(normalizeRoleText(term)))
      );
    });
  }, [roles, search, selectedLevel]);

  const hasSearchInput = search.trim().length > 0;

  const selectRole = async (role: RoleOption) => {
    const auth = getOrgAuthFromStorage();
    if (!auth?.user?.id) {
      window.location.href = "/auth/employee/login";
      return;
    }
    const durationMonths = Number(targetDurationMonths);
    if (!Number.isFinite(durationMonths) || durationMonths < 1) {
      setError("Please enter a valid completion span in months.");
      return;
    }
    if (durationMonths > 60) {
      setError("Please keep completion span between 1 and 60 months.");
      return;
    }
    const roleName = role.name;
    setSavingRole(roleName);
    setError("");
    try {
      const start = new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + durationMonths);
      const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
      const q = new URLSearchParams({
        targetDurationMonths: String(durationMonths),
        targetStartDate: toIsoDate(start),
        targetCompletionDate: toIsoDate(end),
      });
      const effectiveLevel = String(role.level || "").trim() || selectedLevel;
      if (effectiveLevel) q.set("employeeLevel", effectiveLevel);
      window.location.href = `/role/${encodeURIComponent(roleName)}?${q.toString()}`;
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

        <label style={dateField}>
          <span style={dateLabel}>In how much span are you going to complete this role? (months)</span>
          <input
            type="number"
            min={1}
            max={60}
            value={targetDurationMonths}
            onChange={(e) => setTargetDurationMonths(e.target.value)}
            style={dateInput}
            placeholder="e.g. 6"
          />
        </label>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roles..."
          style={input}
          disabled={loading}
        />

        <label style={dateField}>
          <span style={dateLabel}>Level (optional)</span>
          <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} style={dateInput}>
            <option value="">Any level</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>

        {error ? <div style={err}>{error}</div> : null}

        <div style={list}>
          {loading ? (
            <div style={muted}>Loading roles...</div>
          ) : !hasSearchInput ? (
            <div style={muted}>Type in search box to see role suggestions.</div>
          ) : filteredRoles.length === 0 ? (
            <div style={muted}>No matching roles found.</div>
          ) : (
            filteredRoles.map((role) => (
              <button
                key={`${role.name}|${role.level || ""}`}
                onClick={() => selectRole(role)}
                disabled={!!savingRole}
                style={roleBtn}
                title={`Set ${role.name}${role.level ? ` (Level ${role.level})` : ""} as target role`}
              >
                <span style={{ fontWeight: 700, color: "#0f172a", textAlign: "left" }}>
                  {role.name}{role.level ? ` (Level ${role.level})` : ""}
                </span>
                <span style={{ fontSize: 12, color: "#2563eb", fontWeight: 700 }}>
                  {savingRole === role.name ? "Opening..." : "Open Blueprint"}
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
const dateField: React.CSSProperties = { display: "grid", gap: 6 };
const dateLabel: React.CSSProperties = { fontSize: 12, color: "#475569", fontWeight: 700 };
const dateInput: React.CSSProperties = { borderRadius: 8, border: "1px solid #cbd5e1", minHeight: 40, padding: "8px 10px", fontSize: 14 };
