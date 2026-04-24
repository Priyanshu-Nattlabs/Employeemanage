"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getApiPrefix } from "@/lib/apiBase";

const API = getApiPrefix();

const INDUSTRY_ICONS: Record<string, string> = {
  technology: "💻", healthcare: "🏥", finance: "💰", education: "📚",
  engineering: "⚙️", marketing: "📣", legal: "⚖️", manufacturing: "🏭",
  retail: "🛍️", logistics: "🚚", media: "🎬", agriculture: "🌾",
  construction: "🏗️", hospitality: "🏨", energy: "⚡", science: "🔬",
  consulting: "💼", government: "🏛️", banking: "🏦",
};

function industryIcon(name: string) {
  const n = name.toLowerCase();
  const hit = Object.entries(INDUSTRY_ICONS).find(([k]) => n.includes(k));
  return hit ? hit[1] : "🏢";
}

export default function SpecializationDetailPage() {
  return (
    <Suspense>
      <SpecializationDetailContent />
    </Suspense>
  );
}

function SpecializationDetailContent() {
  const params = useParams<{ specializationName: string }>();
  const searchParams = useSearchParams();
  const specializationName = decodeURIComponent(params.specializationName);
  const fromIndustry = searchParams.get("industry") ?? "";
  const fromEducation = searchParams.get("education") ?? "";

  const [doc, setDoc] = useState<any>(null);
  const [industryDoc, setIndustryDoc] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const calls: Promise<any>[] = [
      fetch(`${API}/api/blueprint/specialization/${encodeURIComponent(specializationName)}`).then(r => r.json()),
    ];
    if (fromIndustry) {
      calls.push(fetch(`${API}/api/blueprint/industry/${encodeURIComponent(fromIndustry)}`).then(r => r.json()));
    }
    Promise.all(calls).then(([d, ind]) => {
      setDoc(d);
      setIndustryDoc(ind ?? null);
      setLoading(false);
    });
  }, [specializationName, fromIndustry]);

  const allSpecRoles = (doc?.roles as string[]) || [];
  const industryRoles = (industryDoc?.roles as string[]) || [];
  const roles = useMemo(() => {
    if (!fromIndustry || industryRoles.length === 0) return allSpecRoles;
    const indSet = new Set(industryRoles);
    return allSpecRoles.filter(r => indSet.has(r));
  }, [allSpecRoles, industryRoles, fromIndustry]);
  const industries = (doc?.industries as string[]) || [];

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
          {/* back link */}
          <div style={{ padding: "0 16px 14px", borderBottom: "1px solid #E2E8F0", marginBottom: 12 }}>
            <Link
              href={fromEducation
                ? `/education/${encodeURIComponent(fromEducation)}${fromIndustry ? `?industry=${encodeURIComponent(fromIndustry)}` : ""}`
                : fromIndustry
                  ? `/industry/${encodeURIComponent(fromIndustry)}`
                  : "/education"
              }
              style={{ display: "flex", alignItems: "center", gap: 6, color: "#3170A5", textDecoration: "none", fontSize: 13, fontWeight: 600 }}
            >
              ‹ {fromEducation || fromIndustry || "Education"}
            </Link>
          </div>

          {/* Context info */}
          {(fromIndustry || fromEducation) && (
            <div style={{ padding: "0 12px 14px", borderBottom: "1px solid #E2E8F0", marginBottom: 12 }}>
              {fromEducation && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Education</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0B1723", background: "#E6F0FF", padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(49,112,165,0.15)" }}>
                    🎓 {fromEducation}
                  </div>
                </div>
              )}
              {fromIndustry && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Industry</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0B1723", background: "#FEF9C3", padding: "5px 10px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.08)" }}>
                    🏭 {fromIndustry}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Industries section */}
          {industries.length > 0 && (
            <>
              <div style={{ padding: "0 20px 10px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Relevant Industries ({industries.length})
                </div>
              </div>
              <div style={{ padding: "0 12px" }}>
                {industries.slice(0, 10).map(ind => (
                  <Link key={ind} href={`/industry/${encodeURIComponent(ind)}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      padding: "8px 12px", borderRadius: 6, marginBottom: 3,
                      background: ind === fromIndustry ? "#E6F0FF" : "white",
                      border: ind === fromIndustry ? "1px solid rgba(49,112,165,0.25)" : "1px solid rgba(0,0,0,0.08)",
                      color: "#434655", fontSize: 12, fontWeight: 500,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      cursor: "pointer",
                    }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {industryIcon(ind)} {ind}
                      </span>
                      <span style={{ color: "#C3C6D7", flexShrink: 0, marginLeft: 6 }}>›</span>
                    </div>
                  </Link>
                ))}
                {industries.length > 10 && (
                  <div style={{ fontSize: 11, color: "#94A3B8", paddingLeft: 4, marginTop: 2 }}>+{industries.length - 10} more</div>
                )}
              </div>
            </>
          )}

          {/* Stats */}
          {!loading && (
            <div style={{ margin: "16px 12px 0", borderTop: "1px solid #E2E8F0", paddingTop: 14 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "white", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(0,0,0,0.08)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#0B1723" }}>{roles.length}</div>
                  <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>Roles</div>
                </div>
                <div style={{ flex: 1, background: "white", borderRadius: 8, padding: "10px 12px", border: "1px solid rgba(0,0,0,0.08)", textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#0B1723" }}>{industries.length}</div>
                  <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>Industries</div>
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
          {" › "}
          <Link href="/education" style={{ color: "#3170A5", textDecoration: "none" }}>Education</Link>
          {fromEducation && (
            <>
              {" › "}
              <Link
                href={`/education/${encodeURIComponent(fromEducation)}${fromIndustry ? `?industry=${encodeURIComponent(fromIndustry)}` : ""}`}
                style={{ color: "#3170A5", textDecoration: "none" }}
              >
                {fromEducation}
              </Link>
            </>
          )}
          {" › "}
          <span style={{ color: "#434655" }}>{specializationName}</span>
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#94A3B8" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #E2E8F0", borderTop: "3px solid #3170A5", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
            Loading…
          </div>
        ) : !doc ? (
          <div style={{ textAlign: "center", padding: 80, color: "#94A3B8" }}>
            <p style={{ fontSize: 32, margin: "0 0 8px" }}>🔍</p>
            <p style={{ fontWeight: 700, color: "#434655" }}>Specialization not found</p>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div style={{
              background: "linear-gradient(135deg, #0B1723 0%, #10327A 55%, #4338ca 100%)",
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
                    📌
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
                      Specialization{doc.category ? ` · ${doc.category}` : ""}
                    </div>
                    <h1 style={{ margin: 0, fontSize: "clamp(18px,3vw,30px)", fontWeight: 900, letterSpacing: "-0.5px" }}>
                      {specializationName}
                    </h1>
                  </div>
                </div>
                {doc.description && (
                  <p style={{ margin: "0 0 14px", color: "rgba(255,255,255,0.75)", fontSize: 13.5, maxWidth: 600, lineHeight: 1.55 }}>
                    {doc.description}
                  </p>
                )}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <StatBadge value={roles.length} label={fromIndustry ? "Matched Roles" : "Roles"} />
                  {fromIndustry && <StatBadge value={allSpecRoles.length} label="Total Roles" />}
                  <StatBadge value={industries.length} label="Industries" />
                </div>
              </div>
            </div>

            {/* Industry filter banner */}
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
                      <strong> {specializationName}</strong> and <strong>{fromIndustry}</strong>
                      {" "}(out of {allSpecRoles.length} total)
                    </p>
                  </div>
                </div>
                <Link
                  href={`/specialization/${encodeURIComponent(specializationName)}${fromEducation ? `?education=${encodeURIComponent(fromEducation)}` : ""}`}
                  style={{ textDecoration: "none", fontSize: 12, fontWeight: 700, color: "#3170A5", background: "white", border: "1px solid rgba(49,112,165,0.25)", borderRadius: 8, padding: "6px 14px", whiteSpace: "nowrap" }}
                >
                  ✕ Clear filter
                </Link>
              </div>
            )}

            {/* Industries grid */}
            {industries.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 800, color: "#0B1723" }}>Relevant Industries</h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {industries.map(ind => (
                    <Link key={ind} href={`/industry/${encodeURIComponent(ind)}`} style={{ textDecoration: "none" }}>
                      <IndustryPill label={ind} isActive={ind === fromIndustry} />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Roles section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 800, color: "#0B1723" }}>
                  Roles in this Specialization
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
                {search && (
                  <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 16, padding: 0 }}>×</button>
                )}
              </div>
            </div>

            {roles.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                <p style={{ fontSize: 28, margin: "0 0 8px" }}>📭</p>
                <p style={{ fontWeight: 700, color: "#434655" }}>No roles mapped to this specialization yet.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
                {filteredRoles.map((role) => {
                  const qp = new URLSearchParams();
                  const activeIndustry = fromIndustry || industries[0] || "";
                  if (activeIndustry) qp.set("industry", activeIndustry);
                  if (fromEducation) qp.set("education", fromEducation);
                  qp.set("specialization", specializationName);
                  const qs = qp.toString();
                  return (
                    <Link key={role} href={`/role/${encodeURIComponent(role)}${qs ? `?${qs}` : ""}`} style={{ textDecoration: "none" }}>
                      <RoleCard role={role} />
                    </Link>
                  );
                })}
              </div>
            )}

            {filteredRoles.length === 0 && search && (
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

function IndustryPill({ label, isActive }: { label: string; isActive: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: isActive ? "#3170A5" : hovered ? "#E6F0FF" : "#F1F5F9",
        border: isActive ? "1px solid #3170A5" : hovered ? "1px solid rgba(49,112,165,0.4)" : "1px solid rgba(0,0,0,0.12)",
        borderRadius: 999, padding: "7px 14px",
        fontSize: 12.5, fontWeight: 600,
        color: isActive ? "white" : "#434655",
        cursor: "pointer", transition: "all 0.12s",
      }}
    >
      🏭 {label}
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
