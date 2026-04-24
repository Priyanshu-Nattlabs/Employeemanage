"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getApiPrefix } from "@/lib/apiBase";

const INDUSTRY_ICONS: Record<string, string> = {
  technology: "💻", healthcare: "🏥", finance: "💰", education: "📚",
  engineering: "⚙️", marketing: "📣", legal: "⚖️", manufacturing: "🏭",
  retail: "🛍️", logistics: "🚚", media: "🎬", agriculture: "🌾",
  construction: "🏗️", hospitality: "🏨", energy: "⚡", science: "🔬",
  consulting: "💼", government: "🏛️", sports: "⚽", arts: "🎨",
  banking: "🏦", insurance: "🛡️", telecom: "📡",
};

function industryIcon(name: string) {
  const n = name.toLowerCase();
  const hit = Object.entries(INDUSTRY_ICONS).find(([k]) => n.includes(k));
  return hit ? hit[1] : "🏢";
}

const ROLE_CATS = [
  { label: "All", icon: "🗺" },
  { label: "Technology", icon: "💻", keywords: ["developer", "engineer", "programmer", "software", "web", "mobile", "devops", "cloud", "data", "ml ", "ai ", "security"] },
  { label: "Management", icon: "👔", keywords: ["manager", "director", "head", "lead", "chief", "officer", "executive", "vp "] },
  { label: "Design", icon: "🎨", keywords: ["design", "ux", "ui ", "graphic", "creative", "visual"] },
  { label: "Finance", icon: "💰", keywords: ["finance", "account", "audit", "tax", "invest", "banking"] },
  { label: "Analytics", icon: "📊", keywords: ["analyst", "analytics", "business intelligence", "bi ", "statistics"] },
];

function catFor(role: string) {
  const n = " " + role.toLowerCase() + " ";
  for (const c of ROLE_CATS.slice(1)) {
    if (c.keywords?.some(k => n.includes(k))) return c.label;
  }
  return "All";
}

export default function IndustryDetailPage() {
  const params = useParams<{ industryName: string }>();
  const industryName = decodeURIComponent(params.industryName);

  const [doc, setDoc] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeRoleCat, setActiveRoleCat] = useState("All");

  useEffect(() => {
    let cancelled = false;
    const prefix = getApiPrefix();
    fetch(`${prefix}/api/blueprint/industry/${encodeURIComponent(industryName)}`)
      .then(async (r) => { if (!r.ok) return null; try { return await r.json(); } catch { return null; } })
      .then((d) => { if (cancelled) return; setDoc(d); setLoading(false); })
      .catch(() => { if (!cancelled) { setDoc(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [industryName]);

  const roles = (doc?.roles as string[]) || [];
  const educations = (doc?.educations as string[]) || [];

  const filteredRoles = useMemo(() => {
    let list = roles;
    if (activeRoleCat !== "All") list = list.filter(r => catFor(r) === activeRoleCat);
    if (search) list = list.filter(r => r.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [roles, search, activeRoleCat]);

  const roleCatCounts = useMemo(() => {
    const c: Record<string, number> = { All: roles.length };
    roles.forEach(r => {
      const cat = catFor(r);
      if (cat !== "All") c[cat] = (c[cat] || 0) + 1;
    });
    return c;
  }, [roles]);

  return (
    <div style={{ display: "flex", margin: "-18px -20px -48px", minHeight: "calc(100vh - 64px)", background: "#fff" }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────── */}
      <aside style={{
        width: 260, flexShrink: 0, background: "#F1F5F9",
        borderRight: "1px solid #E2E8F0",
        position: "sticky", top: 64, height: "calc(100vh - 64px)",
        overflowY: "auto",
      }}>
        <div style={{ padding: "20px 0 24px" }}>
          {/* back link */}
          <div style={{ padding: "0 16px 14px", borderBottom: "1px solid #E2E8F0", marginBottom: 12 }}>
            <Link href="/industry" style={{ display: "flex", alignItems: "center", gap: 6, color: "#3170A5", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
              ‹ All Industries
            </Link>
          </div>

          <div style={{ padding: "0 20px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
              Filter Roles
            </div>
          </div>

          {ROLE_CATS.map((cat) => {
            const count = cat.label === "All" ? roles.length : (roleCatCounts[cat.label] || 0);
            const isActive = activeRoleCat === cat.label;
            return (
              <button
                key={cat.label}
                onClick={() => setActiveRoleCat(cat.label)}
                style={{
                  width: isActive ? "calc(100% - 24px)" : "100%",
                  margin: isActive ? "3px 12px" : "1px 0",
                  textAlign: "left", padding: "10px 16px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: isActive ? "#3170A5" : "transparent",
                  color: isActive ? "white" : "#434655",
                  border: "none", cursor: "pointer",
                  borderRadius: isActive ? 6 : 0,
                  fontWeight: isActive ? 700 : 500, fontSize: 13,
                  transition: "all 0.12s",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{cat.icon}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.label}</span>
                </span>
                {count > 0 && (
                  <span style={{
                    background: isActive ? "white" : "#E8F0FF", color: "#3170A5",
                    borderRadius: 11, padding: "2px 7px", fontSize: 11, fontWeight: 700,
                    minWidth: 22, textAlign: "center", flexShrink: 0, marginLeft: 6,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Education paths section */}
          {educations.length > 0 && (
            <div style={{ margin: "20px 12px 0", borderTop: "1px solid #E2E8F0", paddingTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, paddingLeft: 4 }}>
                Education Paths ({educations.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {educations.slice(0, 8).map(edu => (
                  <Link
                    key={edu}
                    href={`/education/${encodeURIComponent(edu)}?industry=${encodeURIComponent(industryName)}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div style={{
                      padding: "7px 12px", borderRadius: 6,
                      background: "white", border: "1px solid rgba(0,0,0,0.08)",
                      color: "#434655", fontSize: 12, fontWeight: 500,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🎓 {edu}</span>
                      <span style={{ color: "#C3C6D7", flexShrink: 0, marginLeft: 6 }}>›</span>
                    </div>
                  </Link>
                ))}
                {educations.length > 8 && (
                  <div style={{ fontSize: 11, color: "#94A3B8", paddingLeft: 4, marginTop: 2 }}>
                    +{educations.length - 8} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────── */}
      <main style={{ flex: 1, padding: "24px 28px", overflowX: "hidden", minWidth: 0 }}>

        {/* Breadcrumb */}
        <p style={{ color: "#94A3B8", fontSize: 12, marginBottom: 20 }}>
          <Link href="/" style={{ color: "#3170A5", textDecoration: "none" }}>Home</Link>
          {" › "}
          <Link href="/industry" style={{ color: "#3170A5", textDecoration: "none" }}>Industries</Link>
          {" › "}
          <span style={{ color: "#434655" }}>{industryName}</span>
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#94A3B8" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #E2E8F0", borderTop: "3px solid #3170A5", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
            Loading…
          </div>
        ) : (
          <>
            {/* Hero banner */}
            <div style={{
              background: "linear-gradient(135deg, #0B1723 0%, #10327A 60%, #004AC6 100%)",
              borderRadius: 16, padding: "28px 28px 24px", marginBottom: 24, color: "white",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 10,
                    background: "rgba(255,255,255,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
                  }}>
                    {industryIcon(industryName)}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                      Industry
                    </div>
                    <h1 style={{ margin: 0, fontSize: "clamp(20px,3.5vw,32px)", fontWeight: 900, letterSpacing: "-0.5px" }}>
                      {industryName}
                    </h1>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <StatBadge value={roles.length} label="Roles" />
                  <StatBadge value={educations.length} label="Education Paths" />
                </div>
              </div>
            </div>

            {/* Education pills */}
            {educations.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <SectionHeader title="Education Paths" subtitle={`Click a path to see roles in ${industryName} for that degree`} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {educations.map(edu => (
                    <Link key={edu} href={`/education/${encodeURIComponent(edu)}?industry=${encodeURIComponent(industryName)}`} style={{ textDecoration: "none" }}>
                      <EduPill label={edu} />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Roles */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <SectionHeader
                title={`Roles in ${industryName}`}
                subtitle={`${filteredRoles.length} role${filteredRoles.length !== 1 ? "s" : ""}${activeRoleCat !== "All" ? ` · ${activeRoleCat}` : ""}`}
              />
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "white", borderRadius: 8, border: "1px solid rgba(0,0,0,0.14)",
                padding: "8px 14px",
              }}>
                <span style={{ color: "#94A3B8" }}>🔍</span>
                <input
                  placeholder="Search roles…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ border: "none", outline: "none", fontSize: 13, color: "#0B1723", width: 180, background: "transparent" }}
                />
                {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 16, padding: 0 }}>×</button>}
              </div>
            </div>

            {/* Role filter quick tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {ROLE_CATS.map(cat => {
                const count = cat.label === "All" ? roles.length : (roleCatCounts[cat.label] || 0);
                if (count === 0 && cat.label !== "All") return null;
                const isActive = activeRoleCat === cat.label;
                return (
                  <button
                    key={cat.label}
                    onClick={() => setActiveRoleCat(cat.label)}
                    style={{
                      padding: "6px 12px", borderRadius: 6,
                      border: isActive ? "1px solid #3170A5" : "1px solid rgba(0,0,0,0.12)",
                      background: isActive ? "#3170A5" : "white",
                      color: isActive ? "white" : "#434655",
                      fontWeight: 600, fontSize: 12, cursor: "pointer",
                    }}
                  >
                    {cat.icon} {cat.label} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 10 }}>
              {filteredRoles.map((role) => (
                <Link key={role} href={`/role/${encodeURIComponent(role)}?industry=${encodeURIComponent(industryName)}`} style={{ textDecoration: "none" }}>
                  <RoleCard role={role} />
                </Link>
              ))}
            </div>

            {filteredRoles.length === 0 && (
              <div style={{ textAlign: "center", padding: 48, background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                <p style={{ fontSize: 28, margin: "0 0 8px" }}>🔍</p>
                <p style={{ fontWeight: 700, color: "#434655", margin: "0 0 4px" }}>No roles found</p>
                {search && <p style={{ fontSize: 13, color: "#94A3B8" }}>Try clearing the search</p>}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function StatBadge({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 800, color: "#0B1723" }}>{title}</h2>
      {subtitle && <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>{subtitle}</p>}
    </div>
  );
}

function EduPill({ label }: { label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: hovered ? "#E6F0FF" : "#F1F5F9",
        border: hovered ? "1px solid #3170A5" : "1px solid rgba(0,0,0,0.12)",
        borderRadius: 999, padding: "7px 14px",
        fontSize: 12.5, fontWeight: 600, color: "#3170A5",
        cursor: "pointer", transition: "all 0.13s",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      🎓 {label} →
    </span>
  );
}

function RoleCard({ role }: { role: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white",
        borderRadius: 8,
        border: hovered ? "1px solid #3170A5" : "1px solid rgba(0,0,0,0.14)",
        padding: "14px 16px",
        cursor: "pointer", transition: "all 0.12s",
        boxShadow: hovered ? "0 4px 14px rgba(49,112,165,0.13)" : "0 1px 3px rgba(0,0,0,0.04)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 13.5, color: "#0B1723", lineHeight: 1.35 }}>{role}</span>
      <span style={{ color: hovered ? "#3170A5" : "#C3C6D7", fontSize: 16, flexShrink: 0, transition: "color 0.12s" }}>›</span>
    </div>
  );
}
