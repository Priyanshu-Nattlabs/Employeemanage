"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { appPath, getApiPrefix } from "@/lib/apiBase";
import { getOrgAuthFromStorage, orgListRecommendableRoles } from "@/lib/orgAuth";

const API = getApiPrefix();

const ROLE_CATEGORIES = [
  { label: "All", icon: "🗺" },
  { label: "IT", icon: "💻", keywords: ["developer", "engineer", "programmer", "software", "web", "mobile", "devops", "cloud", "data", "ml ", "ai ", "security", "network", "it ", "system", "database", "frontend", "backend", "fullstack"] },
  { label: "Management", icon: "👔", keywords: ["manager", "director", "head", "lead", "chief", "officer", "president", "vp ", "cto", "ceo", "cfo", "coo", "executive"] },
  { label: "Design & Creative", icon: "🎨", keywords: ["design", "ux", "ui ", "graphic", "creative", "visual", "artist", "animator", "illustrat"] },
  { label: "Finance & Accounting", icon: "💰", keywords: ["finance", "account", "audit", "tax", "invest", "banking", "actuari", "financial analyst", "cfo"] },
  { label: "Sales & Marketing", icon: "📣", keywords: ["sales", "marketing", "brand", "growth", "digital market", "seo", "advertis", "business development"] },
  { label: "Healthcare", icon: "🏥", keywords: ["doctor", "nurse", "physician", "surgeon", "therapist", "pharmacist", "medical", "clinical", "health"] },
  { label: "Education & Research", icon: "📚", keywords: ["teacher", "professor", "lecturer", "researcher", "scientist", "academic", "trainer", "instructor"] },
  { label: "Operations & Logistics", icon: "🚚", keywords: ["operations", "logistics", "supply chain", "procurement", "warehouse", "quality", "production"] },
  { label: "Legal & Compliance", icon: "⚖️", keywords: ["lawyer", "attorney", "legal", "compliance", "law ", "paralegal", "advocate"] },
  { label: "Human Resources", icon: "🤝", keywords: ["hr ", "human resource", "recruiter", "talent", "people", "culture", "payroll"] },
  { label: "Analytics & Data", icon: "📊", keywords: ["analyst", "analytics", "data scientist", "business intelligence", "bi ", "statistics", "quantitative"] },
];

function getRoleCategory(name: string): string {
  const n = " " + name.toLowerCase() + " ";
  for (const cat of ROLE_CATEGORIES.slice(1)) {
    if (cat.keywords?.some(k => n.includes(k))) return cat.label;
  }
  return "All";
}

export default function RolesPage() {
  return (
    <Suspense>
      <RolesPageContent />
    </Suspense>
  );
}

function RolesPageContent() {
  const searchParams = useSearchParams();

  // Manager → "recommend role" flow context (passed via querystring from /dashboard/manager).
  const recommendFor = searchParams?.get("recommendFor") || "";
  const recommendName = searchParams?.get("recommendName") || "";
  const recommendEmail = searchParams?.get("recommendEmail") || "";
  const recommendDept = searchParams?.get("recommendDept") || "";
  const isRecommendMode = !!recommendFor;

  const [roles, setRoles] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");

  // Recommend-mode: role list from API (manager = their department across industries; HR = employee scope).
  const [recommendRolesList, setRecommendRolesList] = useState<string[]>([]);
  const [recommendDeptLabel, setRecommendDeptLabel] = useState<string>("");
  const [recoResolved, setRecoResolved] = useState(false);

  const recommendViewerIndustry = useMemo(
    () => String((getOrgAuthFromStorage()?.user as { industry?: string } | null)?.industry || "").trim(),
    [isRecommendMode, recoResolved],
  );

  const recommendDeptEffective = useMemo(() => {
    return String(recommendDeptLabel || recommendDept || "").trim();
  }, [recommendDeptLabel, recommendDept]);

  const recommendDeptIsKnownDomain = useMemo(() => {
    if (!recommendDeptEffective) return false;
    return ROLE_CATEGORIES.slice(1).some((c) => c.label === recommendDeptEffective);
  }, [recommendDeptEffective]);

  // Build the querystring suffix that role cards need to keep recommend-mode alive.
  const recommendQuery = useMemo(() => {
    if (!isRecommendMode) return "";
    const params = new URLSearchParams();
    params.set("recommendFor", recommendFor);
    if (recommendName) params.set("recommendName", recommendName);
    if (recommendEmail) params.set("recommendEmail", recommendEmail);
    if (recommendDept) params.set("recommendDept", recommendDept);
    return `?${params.toString()}`;
  }, [isRecommendMode, recommendFor, recommendName, recommendEmail, recommendDept]);

  useEffect(() => {
    fetch(`${API}/api/blueprint/roles`)
      .then(r => r.json())
      .then(d => { setRoles(d || []); setLoading(false); });
  }, []);

  // When the manager reaches this page in recommend mode, ask the API for recommendable roles.
  useEffect(() => {
    if (!isRecommendMode) {
      setRecommendRolesList([]);
      setRecommendDeptLabel("");
      setRecoResolved(true);
      return;
    }
    const auth = getOrgAuthFromStorage();
    if (!auth?.token) {
      setRecommendRolesList([]);
      setRecommendDeptLabel("");
      setRecoResolved(true);
      return;
    }
    let cancelled = false;
    setRecoResolved(false);
    (async () => {
      try {
        if (cancelled) return;
        const resp = await orgListRecommendableRoles(auth.token, recommendFor);
        if (cancelled) return;
        const list = Array.isArray(resp?.roles) ? resp.roles.filter(Boolean) : [];
        setRecommendRolesList(list);
        setRecommendDeptLabel(String(resp?.department || resp?.employee?.department || recommendDept || "").trim());
      } catch {
        if (!cancelled) {
          setRecommendRolesList([]);
          setRecommendDeptLabel(String(recommendDept || "").trim());
        }
      } finally {
        if (!cancelled) setRecoResolved(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isRecommendMode, recommendFor, recommendDept]);

  // Fallback when API returned no mapped roles: known domain buckets (IT, Healthcare, …) → keyword filter.
  const domainDerivedRoles = useMemo(() => {
    if (!isRecommendMode) return null;
    if (!recoResolved) return null;
    if (recommendRolesList.length > 0) return null;
    if (!recommendDeptIsKnownDomain) return null;
    return roles.filter((r) => getRoleCategory(r) === recommendDeptEffective);
  }, [isRecommendMode, recoResolved, recommendRolesList, recommendDeptIsKnownDomain, recommendDeptEffective, roles]);

  // Recommend mode: only roles returned by API (or domain fallback); never the full 400-role catalog.
  const visibleRoles = useMemo(() => {
    if (!isRecommendMode) return roles;
    if (!recoResolved) return [];
    if (recommendRolesList.length > 0) {
      // Match roles ignoring case/punctuation (backend also normalizes like this).
      const key = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const want = new Set(recommendRolesList.map((r) => key(r)).filter(Boolean));
      return roles.filter((r) => want.has(key(r)));
    }
    if (domainDerivedRoles && domainDerivedRoles.length > 0) return domainDerivedRoles;
    // HR: if org map returned nothing, keep the full role catalog so HR can still recommend.
    if (getOrgAuthFromStorage()?.user?.currentRole === "HR") return roles;
    return [];
  }, [isRecommendMode, roles, recoResolved, recommendRolesList, domainDerivedRoles]);

  useEffect(() => {
    if (!isRecommendMode) return;
    if (!recommendDeptIsKnownDomain) return;
    // Default to the manager's domain category on entry; user can still switch.
    setActiveCategory((cur) => (cur === "All" ? recommendDeptEffective : cur));
  }, [isRecommendMode, recommendDeptIsKnownDomain, recommendDeptEffective]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: visibleRoles.length };
    visibleRoles.forEach(r => {
      const cat = getRoleCategory(r);
      if (cat !== "All") counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [visibleRoles]);

  const filtered = useMemo(() => {
    let list = visibleRoles;
    if (activeCategory !== "All") {
      list = list.filter(r => getRoleCategory(r) === activeCategory);
    }
    if (search) {
      list = list.filter(r => r.toLowerCase().includes(search.toLowerCase()));
    }
    return list;
  }, [visibleRoles, search, activeCategory]);

  /* alphabetical groups */
  const groups = useMemo(() => {
    const g: Record<string, string[]> = {};
    filtered.forEach(r => {
      const l = r[0]?.toUpperCase() || "#";
      if (!g[l]) g[l] = [];
      g[l].push(r);
    });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  /* A-Z letters present */
  const letters = useMemo(() => groups.map(([l]) => l), [groups]);

  const scrollTo = (letter: string) => {
    const el = document.getElementById(`roles-group-${letter}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ display: "flex", margin: "-18px -20px -48px", minHeight: "calc(100vh - 64px)", background: "#fff" }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────── */}
      {!isRecommendMode ? (
      <aside style={{
        width: 260, flexShrink: 0, background: "#F1F5F9",
        borderRight: "1px solid #E2E8F0",
        position: "sticky", top: 64, height: "calc(100vh - 64px)",
        overflowY: "auto",
      }}>
        <div style={{ padding: "20px 0 24px" }}>
          <div style={{ padding: "0 20px 14px", borderBottom: "1px solid #E2E8F0", marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
              Browse by Domain
            </div>
          </div>

          {ROLE_CATEGORIES.map((cat) => {
            const count = cat.label === "All" ? visibleRoles.length : (categoryCounts[cat.label] || 0);
            const isActive = activeCategory === cat.label;
            return (
              <button
                key={cat.label}
                onClick={() => setActiveCategory(cat.label)}
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
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{cat.icon}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.label}</span>
                </span>
                {count > 0 && (
                  <span style={{
                    background: isActive ? "white" : "#E8F0FF",
                    color: "#3170A5",
                    borderRadius: 11, padding: "2px 7px",
                    fontSize: 11, fontWeight: 700, minWidth: 22,
                    textAlign: "center", flexShrink: 0, marginLeft: 6,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {/* A-Z quick jump */}
          {letters.length > 3 && (
            <div style={{ margin: "16px 12px 0", borderTop: "1px solid #E2E8F0", paddingTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, paddingLeft: 4 }}>
                Jump to A–Z
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "0 4px" }}>
                {letters.map(l => (
                  <button
                    key={l}
                    onClick={() => scrollTo(l)}
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: "white", border: "1px solid rgba(0,0,0,0.12)",
                      color: "#3170A5", fontWeight: 700, fontSize: 12,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
      ) : null}

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <main style={{ flex: 1, padding: "24px 28px", overflowX: "hidden", minWidth: 0 }}>

        {isRecommendMode ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
            padding: "16px 20px", marginBottom: 18,
            borderRadius: 14,
            background: "linear-gradient(135deg, #ede9fe 0%, #fae8ff 100%)",
            border: "1px solid rgba(124, 58, 237, 0.3)",
            boxShadow: "0 4px 18px -10px rgba(124,58,237,0.45)",
          }}>
            <span style={{ fontSize: 26, lineHeight: 1 }}>💡</span>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#6d28d9", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 2 }}>
                Recommend a role
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0B1723" }}>
                {recommendName ? <>Pick a role for <span style={{ color: "#7c3aed" }}>{recommendName}</span></> : "Pick a role to recommend"}
              </div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                {!recoResolved ? (
                  <>Loading recommendable roles…</>
                ) : recommendRolesList.length > 0 ? (
                  <>
                    Showing <b>{recommendRolesList.length}</b> role{recommendRolesList.length === 1 ? "" : "s"}{" "}
                    {getOrgAuthFromStorage()?.user?.currentRole === "HR" ? (
                      recommendDeptEffective ? (
                        <>mapped for <b>{recommendDeptEffective}</b>.</>
                      ) : (
                        <>from the organization map.</>
                      )
                    ) : recommendDeptEffective ? (
                      <>
                        {recommendViewerIndustry ? (
                          <>
                            mapped for your industry and department (<b>{recommendViewerIndustry}</b> · <b>{recommendDeptEffective}</b>).
                          </>
                        ) : (
                          <>
                            for your department (<b>{recommendDeptEffective}</b>) from the organization map.
                          </>
                        )}
                      </>
                    ) : (
                      <>from the organization map.</>
                    )}{" "}
                    Click a role to open its job description, then send the recommendation.
                  </>
                ) : recoResolved && recommendDeptEffective && recommendDeptIsKnownDomain ? (
                  <>
                    No org-structure rows matched <b>{recommendDeptEffective}</b> — showing roles in the <b>{recommendDeptEffective}</b> keyword category only.
                  </>
                ) : recoResolved && recommendDeptEffective ? (
                  <>
                    No mapped roles found for department <b>{recommendDeptEffective}</b>. Seed org structure or widen the department name; no roles are listed here.
                  </>
                ) : (
                  <>Could not resolve recommendable roles.</>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                window.location.href = appPath("/dashboard/manager");
              }}
              style={{
                background: "white", border: "1px solid rgba(124,58,237,0.4)",
                color: "#5b21b6", fontWeight: 800, fontSize: 13,
                padding: "8px 16px", borderRadius: 999, cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: "#94A3B8", fontSize: 12, marginBottom: 10 }}>
            <Link href="/" style={{ color: "#3170A5", textDecoration: "none" }}>Home</Link>
            {" › "}
            <span style={{ color: "#434655" }}>All Roles</span>
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 900, color: "#0B1723", letterSpacing: "-0.5px" }}>
                All Roles
              </h1>
              <p style={{ margin: 0, color: "#6B7280", fontSize: 13 }}>
                {loading
                  ? "Loading…"
                  : `${filtered.length} role${filtered.length !== 1 ? "s" : ""}${activeCategory !== "All" ? ` in ${activeCategory}` : ""} — click one to get your roadmap`}
              </p>
            </div>
          </div>

          {/* Search & filter bar */}
          <div style={{
            background: "white", borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.14)",
            padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#F3F4F6", borderRadius: 8, padding: "8px 14px",
              flex: 1, minWidth: 200,
            }}>
              <span style={{ color: "#94A3B8", fontSize: 14, flexShrink: 0 }}>🔍</span>
              <input
                placeholder={`Search ${roles.length} roles…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 13.5, color: "#0B1723", width: "100%", background: "transparent" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 16, padding: 0, flexShrink: 0 }}>×</button>
              )}
            </div>
            <div style={{ color: "#94A3B8", width: 1, height: 24, background: "rgba(0,0,0,0.08)", flexShrink: 0 }} />
            <div style={{ display: "flex", gap: 6 }}>
              {["All", "Technology", "Management", "Design & Creative"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: "7px 12px", borderRadius: 6,
                    border: activeCategory === cat ? "1px solid #3170A5" : "1px solid rgba(0,0,0,0.10)",
                    background: activeCategory === cat ? "#3170A5" : "white",
                    color: activeCategory === cat ? "white" : "#434655",
                    fontWeight: 600, fontSize: 12, cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cat === "Design & Creative" ? "Design" : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 64, color: "#94A3B8" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #E2E8F0", borderTop: "3px solid #3170A5", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
            Loading roles…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 64, color: "#94A3B8" }}>
            <p style={{ fontSize: 32, margin: "0 0 8px" }}>🔍</p>
            <p style={{ fontWeight: 700, margin: "0 0 4px", color: "#434655" }}>No roles match "{search}"</p>
          </div>
        )}

        {/* Alphabetical groups — 3 columns */}
        {!loading && groups.map(([letter, items]) => (
          <div key={letter} id={`roles-group-${letter}`} style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: "#94A3B8",
              textTransform: "uppercase", letterSpacing: "0.12em",
              marginBottom: 10, paddingBottom: 6,
              borderBottom: "1px solid #E2E8F0",
            }}>
              {letter}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
              {items.map((role) => (
                <Link key={role} href={`/role/${encodeURIComponent(role)}${recommendQuery}`} style={{ textDecoration: "none" }}>
                  <RoleRow role={role} />
                </Link>
              ))}
            </div>
          </div>
        ))}

        {!loading && filtered.length > 0 && (
          <p style={{ textAlign: "center", color: "#94A3B8", fontSize: 12, marginTop: 24 }}>
            Showing {filtered.length} of {roles.length} roles
          </p>
        )}
      </main>
    </div>
  );
}

function RoleRow({ role }: { role: string }) {
  const [hovered, setHovered] = useState(false);
  const cat = getRoleCategory(role);
  const catObj = ROLE_CATEGORIES.find(c => c.label === cat) || ROLE_CATEGORIES[0];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white",
        borderRadius: 8,
        border: hovered ? "1px solid #3170A5" : "1px solid rgba(0,0,0,0.18)",
        padding: "12px 14px",
        cursor: "pointer",
        transition: "all 0.12s",
        boxShadow: hovered ? "0 3px 12px rgba(49,112,165,0.13)" : "0 1px 2px rgba(0,0,0,0.04)",
        display: "flex", alignItems: "center", gap: 12,
        minHeight: 60,
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
        background: hovered ? "#E6F0FF" : "#E6E9EE",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, transition: "background 0.12s",
      }}>
        {catObj.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: 13.5, color: "#0B1723",
          lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {role}
        </div>
      </div>
      <span style={{ color: hovered ? "#3170A5" : "#C3C6D7", fontSize: 16, flexShrink: 0, transition: "color 0.12s" }}>›</span>
    </div>
  );
}
