"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getApiPrefix } from "@/lib/apiBase";

const API = getApiPrefix();

const INDUSTRY_ICONS: Record<string, string> = {
  technology: "💻", healthcare: "🏥", finance: "💰", education: "📚",
  engineering: "⚙️", marketing: "📣", legal: "⚖️", manufacturing: "🏭",
  retail: "🛍️", logistics: "🚚", media: "🎬", agriculture: "🌾",
  construction: "🏗️", hospitality: "🏨", energy: "⚡", science: "🔬",
  consulting: "💼", government: "🏛️", sports: "⚽", arts: "🎨",
  banking: "🏦", insurance: "🛡️", telecom: "📡", transport: "🚇",
  food: "🍽️", fashion: "👗", real: "🏠", mining: "⛏️",
};

function industryIcon(name: string) {
  const n = name.toLowerCase();
  const hit = Object.entries(INDUSTRY_ICONS).find(([k]) => n.includes(k));
  return hit ? hit[1] : "🏢";
}

const IND_SECTORS = [
  { label: "All", icon: "🏢" },
  { label: "Technology", icon: "💻", keywords: ["tech", "it ", "software", "digital", "cyber", "data", "ai ", "cloud", "telecom"] },
  { label: "Healthcare", icon: "🏥", keywords: ["health", "medical", "pharma", "biotech", "hospital", "clinical", "dental", "nursing"] },
  { label: "Finance & Banking", icon: "💰", keywords: ["financ", "bank", "invest", "insurance", "account", "capital", "wealth", "trading"] },
  { label: "Manufacturing", icon: "🏭", keywords: ["manufactur", "product", "industrial", "assembly", "chemical", "textile", "auto"] },
  { label: "Education", icon: "📚", keywords: ["educat", "training", "coaching", "school", "university", "academic"] },
  { label: "Media & Marketing", icon: "📣", keywords: ["media", "market", "advertis", "public relations", "content", "broadcast", "film"] },
  { label: "Construction & Real Estate", icon: "🏗️", keywords: ["construct", "real estate", "architect", "infra", "civil", "building"] },
  { label: "Retail & E-Commerce", icon: "🛍️", keywords: ["retail", "e-commerce", "ecommerce", "consumer", "fmcg", "food", "hospitality"] },
  { label: "Energy & Environment", icon: "⚡", keywords: ["energy", "power", "oil", "gas", "mining", "environment", "renewable", "solar"] },
  { label: "Government & Public", icon: "🏛️", keywords: ["government", "public", "defense", "military", "ngo", "social", "admin"] },
  { label: "Logistics & Transport", icon: "🚚", keywords: ["logistics", "transport", "supply chain", "shipping", "aviation", "railway", "port"] },
];

function getSector(name: string): string {
  const n = " " + name.toLowerCase() + " ";
  for (const sec of IND_SECTORS.slice(1)) {
    if (sec.keywords?.some(k => n.includes(k))) return sec.label;
  }
  return "All";
}

export default function IndustryPage() {
  const [industries, setIndustries] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeSector, setActiveSector] = useState("All");

  useEffect(() => {
    fetch(`${API}/api/blueprint/industries`)
      .then(r => r.json())
      .then(d => { setIndustries(d || []); setLoading(false); });
  }, []);

  const sectorCounts = useMemo(() => {
    const counts: Record<string, number> = { All: industries.length };
    industries.forEach(ind => {
      const s = getSector(ind);
      if (s !== "All") counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [industries]);

  const filtered = useMemo(() => {
    let list = industries;
    if (activeSector !== "All") {
      list = list.filter(ind => getSector(ind) === activeSector);
    }
    if (search) {
      list = list.filter(ind => ind.toLowerCase().includes(search.toLowerCase()));
    }
    return list;
  }, [industries, search, activeSector]);

  /* alphabetical groups within filtered */
  const groups = useMemo(() => {
    const g: Record<string, string[]> = {};
    filtered.forEach(ind => {
      const l = ind[0]?.toUpperCase() || "#";
      if (!g[l]) g[l] = [];
      g[l].push(ind);
    });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div style={{ display: "flex", margin: "-18px -20px -48px", minHeight: "calc(100vh - 64px)", background: "#fff" }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────── */}
      <aside style={{
        width: 260, flexShrink: 0, background: "#F1F5F9",
        borderRight: "1px solid #E2E8F0",
        position: "sticky", top: 64, height: "calc(100vh - 64px)",
        overflowY: "auto",
      }}>
        <div style={{ padding: "20px 0 24px" }}>
          <div style={{ padding: "0 20px 14px", borderBottom: "1px solid #E2E8F0", marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
              Browse by Sector
            </div>
          </div>

          {IND_SECTORS.map((sec) => {
            const count = sec.label === "All" ? industries.length : (sectorCounts[sec.label] || 0);
            const isActive = activeSector === sec.label;
            return (
              <button
                key={sec.label}
                onClick={() => setActiveSector(sec.label)}
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
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{sec.icon}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sec.label}</span>
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

          <div style={{ margin: "16px 12px 0", borderTop: "1px solid #E2E8F0", paddingTop: 14 }}>
            <button
              onClick={() => { setActiveSector("All"); setSearch(""); }}
              style={{
                width: "100%", padding: "9px 14px", borderRadius: 6,
                background: "#E6F0FF", border: "1px solid rgba(49,112,165,0.2)",
                color: "#3170A5", fontWeight: 700, fontSize: 13,
                cursor: "pointer", textAlign: "left",
              }}
            >
              🏢 All Industries
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <main style={{ flex: 1, padding: "24px 28px", overflowX: "hidden", minWidth: 0 }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: "#94A3B8", fontSize: 12, marginBottom: 10 }}>
            <Link href="/" style={{ color: "#3170A5", textDecoration: "none" }}>Home</Link>
            {" › "}
            <span style={{ color: "#434655" }}>Industries</span>
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 900, color: "#0B1723", letterSpacing: "-0.5px" }}>
                Industries
              </h1>
              <p style={{ margin: 0, color: "#6B7280", fontSize: 13 }}>
                {loading
                  ? "Loading…"
                  : `${filtered.length} industr${filtered.length !== 1 ? "ies" : "y"}${activeSector !== "All" ? ` in ${activeSector}` : ""} — click one to see roles`}
              </p>
            </div>
            {/* Search */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "white", borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)", padding: "10px 16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)", minWidth: 240, maxWidth: 340,
            }}>
              <span style={{ color: "#94A3B8", fontSize: 14, flexShrink: 0 }}>🔍</span>
              <input
                placeholder={`Search ${industries.length} industries…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 13.5, color: "#0B1723", width: "100%", background: "transparent" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 16, padding: 0, flexShrink: 0 }}>×</button>
              )}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 64, color: "#94A3B8" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #E2E8F0", borderTop: "3px solid #3170A5", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
            Loading industries…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 64, color: "#94A3B8" }}>
            <p style={{ fontSize: 32, margin: "0 0 8px" }}>🔍</p>
            <p style={{ fontWeight: 700, margin: "0 0 4px", color: "#434655" }}>No industries match "{search}"</p>
          </div>
        )}

        {/* Grouped list — 2 columns */}
        {!loading && groups.map(([letter, items]) => (
          <div key={letter} style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: "#94A3B8",
              textTransform: "uppercase", letterSpacing: "0.12em",
              marginBottom: 10, paddingBottom: 6,
              borderBottom: "1px solid #E2E8F0",
            }}>
              {letter}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
              {items.map((name) => (
                <Link key={name} href={`/industry/${encodeURIComponent(name)}`} style={{ textDecoration: "none" }}>
                  <IndustryRow name={name} />
                </Link>
              ))}
            </div>
          </div>
        ))}

        {!loading && filtered.length > 0 && (
          <p style={{ textAlign: "center", color: "#94A3B8", fontSize: 12, marginTop: 24 }}>
            Showing {filtered.length} of {industries.length} industries
          </p>
        )}
      </main>
    </div>
  );
}

function IndustryRow({ name }: { name: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white",
        borderRadius: 6,
        border: hovered ? "1px solid #3170A5" : "1px solid rgba(0,0,0,0.18)",
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.13s",
        boxShadow: hovered ? "0 4px 14px rgba(49,112,165,0.14)" : "0 1px 3px rgba(0,0,0,0.04)",
        display: "flex", alignItems: "center", gap: 14,
        minHeight: 72,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 6, flexShrink: 0,
        background: hovered ? "#3170A5" : "#EAE8F8",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, transition: "background 0.13s",
      }}>
        {industryIcon(name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0B1723", lineHeight: 1.3, marginBottom: 3 }}>
          {name}
        </div>
        <div style={{ fontSize: 12, color: hovered ? "#3170A5" : "#94A3B8", transition: "color 0.13s" }}>
          View roles & paths →
        </div>
      </div>
      <span style={{ color: hovered ? "#3170A5" : "#C3C6D7", fontSize: 18, flexShrink: 0, transition: "color 0.13s" }}>›</span>
    </div>
  );
}
