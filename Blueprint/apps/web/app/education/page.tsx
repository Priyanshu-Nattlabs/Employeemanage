"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getApiPrefix } from "@/lib/apiBase";

const API = getApiPrefix();

const DEGREE_ICONS: Record<string, string> = {
  "b.tech": "⚙️", "m.tech": "🔬", "bca": "💻", "mca": "🖥️",
  "bsc": "🔭", "msc": "🧬", "ba": "📖", "ma": "📚",
  "bba": "💼", "mba": "💰", "phd": "🎓", "b.com": "📊",
  "m.com": "📈", "diploma": "📜", "b.arch": "🏛️", "llb": "⚖️", "mbbs": "🏥",
  "b.e": "⚙️", "m.e": "🔬", "b.sc": "🔭", "m.sc": "🧬",
  "b.a": "📖", "m.a": "📚", "b.pharm": "💊", "m.pharm": "💊",
};

function degIcon(name: string) {
  const n = name.toLowerCase();
  const hit = Object.entries(DEGREE_ICONS).find(([k]) => n.includes(k));
  return hit ? hit[1] : "🎓";
}

const EDU_CATEGORIES = [
  { label: "All", icon: "🎓" },
  { label: "Engineering & Tech", icon: "⚙️", keywords: ["tech", "eng", "bca", "mca", "b.e", "m.e", "computer", "it ", "information"] },
  { label: "Science", icon: "🔬", keywords: ["sc", "phd", "physics", "chemistry", "bio", "math", "statistics"] },
  { label: "Commerce & Business", icon: "💼", keywords: ["com", "bba", "mba", "business", "commerce", "finance", "account", "ca ", "cma", "cs "] },
  { label: "Arts & Humanities", icon: "📖", keywords: [" ba ", " ma ", "arts", "humanities", "english", "history", "geography", "political", "sociology", "philosophy", "media", "journalism"] },
  { label: "Healthcare", icon: "🏥", keywords: ["mbbs", "health", "medicine", "medical", "nursing", "pharm", "dental", "physio", "ayurved"] },
  { label: "Law", icon: "⚖️", keywords: ["llb", "llm", "law", "legal"] },
  { label: "Architecture & Design", icon: "🏛️", keywords: ["arch", "design", "planning", "interior"] },
  { label: "Diploma & Certificate", icon: "📜", keywords: ["diploma", "certificate", "pg diploma", "pgd"] },
];

function getCategory(name: string): string {
  const n = " " + name.toLowerCase() + " ";
  for (const cat of EDU_CATEGORIES.slice(1)) {
    if (cat.keywords?.some(k => n.includes(k))) return cat.label;
  }
  return "All";
}

export default function EducationPage() {
  const [educations, setEducations] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    fetch(`${API}/api/blueprint/educations`)
      .then(r => r.json())
      .then(d => { setEducations(d || []); setLoading(false); });
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: educations.length };
    educations.forEach(e => {
      const cat = getCategory(e);
      if (cat !== "All") counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [educations]);

  const filtered = useMemo(() => {
    let list = educations;
    if (activeCategory !== "All") {
      list = list.filter(e => getCategory(e) === activeCategory);
    }
    if (search) {
      list = list.filter(e => e.toLowerCase().includes(search.toLowerCase()));
    }
    return list;
  }, [educations, search, activeCategory]);

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
              Browse by Type
            </div>
          </div>

          {EDU_CATEGORIES.map((cat) => {
            const count = cat.label === "All" ? educations.length : (categoryCounts[cat.label] || 0);
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
                  fontWeight: isActive ? 700 : 500, fontSize: 13.5,
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

          {/* Bottom quick-select */}
          <div style={{ margin: "16px 12px 0", borderTop: "1px solid #E2E8F0", paddingTop: 14 }}>
            <button
              onClick={() => { setActiveCategory("All"); setSearch(""); }}
              style={{
                width: "100%", padding: "9px 14px", borderRadius: 6,
                background: activeCategory === "All" && !search ? "#E6F0FF" : "white",
                border: "1px solid rgba(0,0,0,0.12)",
                color: "#3170A5", fontWeight: 700, fontSize: 13,
                cursor: "pointer", textAlign: "left",
              }}
            >
              📋 All Education Paths
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <main style={{ flex: 1, padding: "24px 28px", overflowX: "hidden", minWidth: 0 }}>

        {/* Breadcrumb + Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: "#94A3B8", fontSize: 12, marginBottom: 10 }}>
            <Link href="/" style={{ color: "#3170A5", textDecoration: "none" }}>Home</Link>
            {" › "}
            <span style={{ color: "#434655" }}>Education Paths</span>
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 900, color: "#0B1723", letterSpacing: "-0.5px" }}>
                Education Paths
              </h1>
              <p style={{ margin: 0, color: "#6B7280", fontSize: 13 }}>
                {loading
                  ? "Loading…"
                  : `${filtered.length} path${filtered.length !== 1 ? "s" : ""}${activeCategory !== "All" ? ` in ${activeCategory}` : ""} — click one to see specializations & roles`}
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
                placeholder={`Search ${educations.length} paths…`}
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
            Loading education paths…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 64, color: "#94A3B8" }}>
            <p style={{ fontSize: 32, margin: "0 0 8px" }}>🔍</p>
            <p style={{ fontWeight: 700, margin: "0 0 4px", color: "#434655" }}>No paths match "{search}"</p>
            <p style={{ fontSize: 13 }}>Try a different keyword or browse all paths</p>
          </div>
        )}

        {/* Card Grid */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
            {filtered.map((name) => (
              <Link key={name} href={`/education/${encodeURIComponent(name)}`} style={{ textDecoration: "none" }}>
                <EducationCard name={name} />
              </Link>
            ))}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p style={{ textAlign: "center", color: "#94A3B8", fontSize: 12, marginTop: 24 }}>
            Showing {filtered.length} of {educations.length} education paths
          </p>
        )}
      </main>
    </div>
  );
}

function EducationCard({ name }: { name: string }) {
  const [hovered, setHovered] = useState(false);
  const cat = getCategory(name);
  const isSpecial = cat === "Healthcare" || cat === "Law" || cat === "Architecture & Design";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white",
        borderRadius: 12,
        border: hovered ? "1px solid #3170A5" : "1px solid rgba(0,0,0,0.14)",
        padding: "20px 20px 18px",
        cursor: "pointer",
        transition: "all 0.14s",
        boxShadow: hovered ? "0 6px 20px rgba(49,112,165,0.14)" : "0 1px 4px rgba(0,0,0,0.05)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        display: "flex", flexDirection: "column", gap: 14,
        minHeight: 160,
      }}
    >
      {/* Icon area */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{
          width: 48, height: 48, borderRadius: 8,
          background: hovered ? "#E6F0FF" : "#F2F4F6",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, transition: "background 0.14s",
        }}>
          {degIcon(name)}
        </div>
        {isSpecial && (
          <span style={{
            background: "#FFB020", color: "white",
            borderRadius: 6, padding: "3px 9px",
            fontSize: 10, fontWeight: 800, letterSpacing: "0.04em",
          }}>
            POPULAR
          </span>
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#0B1723", marginBottom: 6, lineHeight: 1.35 }}>
          {name}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: hovered ? "#3170A5" : "#94A3B8", transition: "color 0.14s" }}>
          View specializations & roles →
        </div>
      </div>
    </div>
  );
}
