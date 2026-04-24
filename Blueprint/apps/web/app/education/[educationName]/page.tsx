"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getApiPrefix } from "@/lib/apiBase";

const API = getApiPrefix();

const DEGREE_ICONS: Record<string, string> = {
  "b.tech": "⚙️", "m.tech": "🔬", "bca": "💻", "mca": "🖥️",
  "bsc": "🔭", "msc": "🧬", "ba": "📖", "ma": "📚",
  "bba": "💼", "mba": "💰", "phd": "🎓", "b.com": "📊",
  "m.com": "📈", "diploma": "📜", "b.arch": "🏛️", "llb": "⚖️", "mbbs": "🏥",
};

function degIcon(name: string) {
  const n = name.toLowerCase();
  const hit = Object.entries(DEGREE_ICONS).find(([k]) => n.includes(k));
  return hit ? hit[1] : "🎓";
}

export default function EducationDetailPage() {
  return (
    <Suspense>
      <EducationDetailContent />
    </Suspense>
  );
}

function EducationDetailContent() {
  const params = useParams<{ educationName: string }>();
  const searchParams = useSearchParams();
  const educationName = decodeURIComponent(params.educationName);
  const fromIndustry = searchParams.get("industry") ?? "";

  const [doc, setDoc] = useState<any>(null);
  const [industryDoc, setIndustryDoc] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetches: Promise<any>[] = [
      fetch(`${API}/api/blueprint/education/${encodeURIComponent(educationName)}`).then(r => r.json()),
    ];
    if (fromIndustry) {
      fetches.push(
        fetch(`${API}/api/blueprint/industry/${encodeURIComponent(fromIndustry)}`).then(r => r.json())
      );
    }
    Promise.all(fetches).then(([eduDoc, indDoc]) => {
      setDoc(eduDoc);
      setIndustryDoc(indDoc ?? null);
      setLoading(false);
    });
  }, [educationName, fromIndustry]);

  const allEduRoles = useMemo(() => (doc?.roles as string[]) || [], [doc]);
  const industryRoles = useMemo(() => (industryDoc?.roles as string[]) || [], [industryDoc]);
  const specializations = useMemo(() => (doc?.specializations as string[]) || [], [doc]);

  const roles = useMemo(() => {
    if (!fromIndustry || industryRoles.length === 0) return allEduRoles;
    const indSet = new Set(industryRoles);
    return allEduRoles.filter(r => indSet.has(r));
  }, [allEduRoles, industryRoles, fromIndustry]);

  const filteredRoles = useMemo(() =>
    search ? roles.filter(r => r.toLowerCase().includes(search.toLowerCase())) : roles
  , [roles, search]);

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
          {/* back */}
          <div style={{ padding: "0 16px 14px", borderBottom: "1px solid #E2E8F0", marginBottom: 12 }}>
            <Link
              href={fromIndustry ? `/industry/${encodeURIComponent(fromIndustry)}` : "/education"}
              style={{ display: "flex", alignItems: "center", gap: 6, color: "#3170A5", textDecoration: "none", fontSize: 13, fontWeight: 600 }}
            >
              ‹ {fromIndustry ? fromIndustry : "All Education Paths"}
            </Link>
          </div>

          {/* Specializations in sidebar */}
          {specializations.length > 0 && (
            <>
              <div style={{ padding: "0 20px 10px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Specializations ({specializations.length})
                </div>
              </div>
              <div style={{ padding: "0 12px" }}>
                {specializations.map(spec => {
                  const sp = new URLSearchParams();
                  if (fromIndustry) sp.set("industry", fromIndustry);
                  sp.set("education", educationName);
                  const q = sp.toString();
                  return (
                    <Link key={spec} href={`/specialization/${encodeURIComponent(spec)}${q ? `?${q}` : ""}`} style={{ textDecoration: "none" }}>
                      <div style={{
                        padding: "8px 12px", borderRadius: 6, marginBottom: 3,
                        background: "white", border: "1px solid rgba(0,0,0,0.08)",
                        color: "#434655", fontSize: 12, fontWeight: 500,
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        cursor: "pointer",
                      }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📌 {spec}</span>
                        <span style={{ color: "#C3C6D7", flexShrink: 0, marginLeft: 6 }}>›</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* Context filter info */}
          {fromIndustry && (
            <div style={{ margin: "16px 12px 0", borderTop: "1px solid #E2E8F0", paddingTop: 14 }}>
              <div style={{
                background: "#E6F0FF", border: "1px solid rgba(49,112,165,0.2)",
                borderRadius: 8, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#3170A5", marginBottom: 4 }}>Filtered by Industry</div>
                <div style={{ fontSize: 12, color: "#0B1723", fontWeight: 600, marginBottom: 6 }}>{fromIndustry}</div>
                <Link
                  href={`/education/${encodeURIComponent(educationName)}`}
                  style={{ fontSize: 11, color: "#3170A5", textDecoration: "none", fontWeight: 600 }}
                >
                  ✕ Clear filter
                </Link>
              </div>
            </div>
          )}

          {/* Quick stats */}
          {!loading && (
            <div style={{ margin: "16px 12px 0", borderTop: "1px solid #E2E8F0", paddingTop: 14 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "white", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(0,0,0,0.08)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#0B1723" }}>{roles.length}</div>
                  <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>Roles</div>
                </div>
                <div style={{ flex: 1, background: "white", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(0,0,0,0.08)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#0B1723" }}>{specializations.length}</div>
                  <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>Specs</div>
                </div>
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
          {fromIndustry && (
            <>
              {" › "}
              <Link href="/industry" style={{ color: "#3170A5", textDecoration: "none" }}>Industries</Link>
              {" › "}
              <Link href={`/industry/${encodeURIComponent(fromIndustry)}`} style={{ color: "#3170A5", textDecoration: "none" }}>{fromIndustry}</Link>
            </>
          )}
          {!fromIndustry && (
            <>
              {" › "}
              <Link href="/education" style={{ color: "#3170A5", textDecoration: "none" }}>Education</Link>
            </>
          )}
          {" › "}
          <span style={{ color: "#434655" }}>{educationName}</span>
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#94A3B8" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #E2E8F0", borderTop: "3px solid #3170A5", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
            Loading…
          </div>
        ) : (
          <>
            {/* Hero */}
            <div style={{
              background: "linear-gradient(135deg, #0B1723 0%, #166534 60%, #14532d 100%)",
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
                    {degIcon(educationName)}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                      Education Path
                    </div>
                    <h1 style={{ margin: 0, fontSize: "clamp(18px,3vw,30px)", fontWeight: 900, letterSpacing: "-0.5px" }}>
                      {educationName}
                    </h1>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <StatBadge value={roles.length} label={fromIndustry ? "Matched Roles" : "Roles"} />
                  {fromIndustry && <StatBadge value={allEduRoles.length} label="Total Roles" />}
                  <StatBadge value={specializations.length} label="Specializations" />
                </div>
              </div>
            </div>

            {/* Cross-filter banner */}
            {fromIndustry && (
              <div style={{
                background: "#E8F0FF", border: "1px solid rgba(49,112,165,0.25)",
                borderRadius: 12, padding: "14px 18px", marginBottom: 24,
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🔀</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 13.5, color: "#0B1723" }}>
                      Filtered by Industry: <span style={{ color: "#3170A5" }}>{fromIndustry}</span>
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280" }}>
                      Showing {roles.length} role{roles.length !== 1 ? "s" : ""} in both
                      <strong> {fromIndustry}</strong> and <strong>{educationName}</strong>
                      {" "}(out of {allEduRoles.length} total)
                    </p>
                  </div>
                </div>
                <Link
                  href={`/education/${encodeURIComponent(educationName)}`}
                  style={{ textDecoration: "none", fontSize: 12, fontWeight: 700, color: "#3170A5", background: "white", border: "1px solid rgba(49,112,165,0.25)", borderRadius: 8, padding: "6px 14px", whiteSpace: "nowrap" }}
                >
                  ✕ Clear filter
                </Link>
              </div>
            )}

            {/* Specializations grid */}
            {specializations.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: "#0B1723" }}>Specializations</h2>
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "#6B7280" }}>Click a specialization to see its roles</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {specializations.map(spec => {
                    const sp = new URLSearchParams();
                    if (fromIndustry) sp.set("industry", fromIndustry);
                    sp.set("education", educationName);
                    const q = sp.toString();
                    return (
                      <Link key={spec} href={`/specialization/${encodeURIComponent(spec)}${q ? `?${q}` : ""}`} style={{ textDecoration: "none" }}>
                        <SpecCard name={spec} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Roles section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 800, color: "#0B1723" }}>
                  {fromIndustry ? `Roles in ${fromIndustry} via ${educationName}` : "All Roles"}
                  <span style={{ color: "#94A3B8", fontWeight: 600, fontSize: 13 }}> ({filteredRoles.length})</span>
                </h2>
              </div>
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

            {roles.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                <p style={{ fontSize: 28, margin: "0 0 8px" }}>📭</p>
                <p style={{ fontWeight: 700, color: "#434655", margin: "0 0 4px" }}>No matching roles found</p>
                {fromIndustry && (
                  <>
                    <p style={{ fontSize: 13, color: "#94A3B8", margin: "0 0 14px" }}>
                      No roles in both <strong>{fromIndustry}</strong> and <strong>{educationName}</strong>.
                    </p>
                    <Link href={`/education/${encodeURIComponent(educationName)}`} style={{ fontSize: 13, fontWeight: 700, color: "#3170A5", textDecoration: "none" }}>
                      View all roles for {educationName} →
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
                {filteredRoles.map((role) => {
                  const roleParams = new URLSearchParams();
                  if (fromIndustry) roleParams.set("industry", fromIndustry);
                  roleParams.set("education", educationName);
                  return (
                    <Link key={role} href={`/role/${encodeURIComponent(role)}?${roleParams.toString()}`} style={{ textDecoration: "none" }}>
                      <RoleCard role={role} />
                    </Link>
                  );
                })}
              </div>
            )}

            {filteredRoles.length === 0 && search && roles.length > 0 && (
              <p style={{ textAlign: "center", color: "#94A3B8", padding: 32, fontSize: 13 }}>No roles match "{search}"</p>
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

function SpecCard({ name }: { name: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#E6F0FF" : "white",
        borderRadius: 8,
        border: hovered ? "1px solid #3170A5" : "1px solid rgba(0,0,0,0.14)",
        padding: "13px 15px",
        cursor: "pointer", transition: "all 0.12s",
        boxShadow: hovered ? "0 3px 12px rgba(49,112,165,0.13)" : "0 1px 3px rgba(0,0,0,0.04)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6, flexShrink: 0,
          background: hovered ? "#3170A5" : "#EAE8F8",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, transition: "background 0.12s",
        }}>
          📌
        </div>
        <span style={{ fontWeight: 600, fontSize: 13, color: "#0B1723", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      </div>
      <span style={{ color: hovered ? "#3170A5" : "#C3C6D7", fontSize: 16, flexShrink: 0, transition: "color 0.12s" }}>›</span>
    </div>
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
        padding: "13px 16px",
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
