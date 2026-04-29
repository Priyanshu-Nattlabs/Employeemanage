"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getOrgAuthFromStorage, orgListEmployeesManagerSummary } from "@/lib/orgAuth";
import { SiteFooter } from "@/app/components/SiteFooter";
import { apiUrl, appPath } from "@/lib/apiBase";
import { buildInterviewXCandidatesUrl } from "@/lib/interviewx";

type EmployeeRow = {
  employee: any;
  ongoing: Array<{ roleName: string; pct: number; startedAt?: string | null }>;
  avgPct: number;
  latestTest: { roleName?: string; skillName?: string; score?: number | null; passed?: boolean; completedAt?: string | null } | null;
};

type InterviewXBlueprintCredentials = {
  interviewConfigId: string;
  candidateName: string;
  candidateEmail: string;
  loginLink: string;
  password: string;
  loginUrl: string;
  candidateId?: string;
  interviewStartDateTime?: string; // ISO
  interviewEndDateTime?: string; // ISO
};

type InterviewXBlueprintReport = {
  id?: string;
  candidateId?: string;
  overallScore: number | null;
  hiringRecommendation: string | null;
  overallReview: string | null;
  strengths: string[];
  weaknesses: string[];
  recommendationReason: string | null;
  generatedAt: string | null;
};

type InterviewXBlueprintDetailedReport = {
  id: string;
  candidateId: string;
  interviewConfigId: string;
  overallScore: number | null;
  hiringRecommendation: string | null;
  overallReview: string | null;
  strengths: string[];
  weaknesses: string[];
  recommendationReason: string | null;
  generatedAt: string | null;
  overallRubricScores: Record<string, number>;
  questionAnalyses: Array<{
    question: string | null;
    answer: string | null;
    analysis: string | null;
    questionType: string | null;
    rating: number | null;
    ratingCategory: string | null;
    rubricScores: Record<string, number>;
  }>;
  proctoringSummary:
    | null
    | {
        totalViolations: number | null;
        violationTypes: string[];
        violationSummary: string | null;
        hasSeriousViolations: boolean | null;
      };
};

function BarGraph({
  bars,
  accent,
  maxValue,
}: {
  bars: Array<{ id: string; label: string; value: number }>;
  accent: string;
  maxValue?: number;
}) {
  const max = Math.max(1, maxValue ?? Math.max(1, ...bars.map((b) => b.value)));
  const palette = [
    "#22c55e", // green
    "#3b82f6", // blue
    "#a855f7", // purple
    "#f97316", // orange
    "#ef4444", // red
    "#14b8a6", // teal
    "#eab308", // yellow
    "#06b6d4", // cyan
    "#f43f5e", // rose
    "#6366f1", // indigo
  ];
  const darken = (hex: string, amt: number) => {
    const h = hex.replace("#", "");
    if (h.length !== 6) return hex;
    const r = Math.max(0, Math.min(255, parseInt(h.slice(0, 2), 16) + amt));
    const g = Math.max(0, Math.min(255, parseInt(h.slice(2, 4), 16) + amt));
    const b = Math.max(0, Math.min(255, parseInt(h.slice(4, 6), 16) + amt));
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  };
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 16,
        padding: 14,
        border: "1px solid #e5e7eb",
        background:
          "radial-gradient(900px 260px at 20% 10%, rgba(59,130,246,0.12), transparent 60%), radial-gradient(820px 320px at 95% 10%, rgba(34,197,94,0.14), transparent 62%), radial-gradient(760px 360px at 70% 95%, rgba(168,85,247,0.10), transparent 62%), linear-gradient(180deg, #ffffff, #f8fafc)",
        overflow: "hidden",
      }}
    >
      {/* grid lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, rgba(148,163,184,0.16), rgba(148,163,184,0.16) 1px, transparent 1px, transparent 24px)",
          pointerEvents: "none",
          opacity: 0.55,
        }}
      />

      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "44px 1fr", gap: 10 }}>
        {/* y-axis labels */}
        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr 1fr 1fr 1fr 1fr", height: 180 }}>
          {[maxValue ?? max, 8, 6, 4, 2, 0].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                fontSize: 11,
                fontWeight: 900,
                color: "#475569",
                paddingRight: 6,
              }}
            >
              {t}
            </div>
          ))}
        </div>

        {/* plot area with axes */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 26,
              width: 3,
              borderRadius: 999,
              background: "rgba(15,23,42,0.75)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 26,
              height: 3,
              borderRadius: 999,
              background: "rgba(15,23,42,0.75)",
            }}
          />

          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 180, padding: "8px 8px 0 12px" }}>
            {bars.map((b, idx) => {
              const pct = Math.max(0, Math.min(100, (b.value / max) * 100));
              const color = palette[idx % palette.length] || accent;
              const cap = darken(color, -40);
              return (
                <div key={b.id} style={{ flex: 1, minWidth: 0, display: "grid", gap: 10 }}>
                  <div style={{ position: "relative", height: 180, display: "flex", alignItems: "flex-end" }}>
                    <div
                      title={`${b.label}: ${b.value}`}
                      style={{
                        width: "100%",
                        height: `${pct}%`,
                        borderRadius: 14,
                        background: `linear-gradient(180deg, ${cap}, ${color} 40%, ${color}cc)`,
                        boxShadow: `0 14px 28px rgba(15,23,42,0.18), 0 2px 0 rgba(255,255,255,0.55) inset`,
                        border: "1px solid rgba(15,23,42,0.10)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: Math.max(6, 180 - (pct / 100) * 180 - 18),
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: 11,
                        fontWeight: 1000,
                        color: "#0f172a",
                        background: "rgba(255,255,255,0.92)",
                        border: "1px solid rgba(148,163,184,0.55)",
                        borderRadius: 999,
                        padding: "3px 8px",
                        boxShadow: "0 8px 18px rgba(15,23,42,0.12)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b.value}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.86)",
                      border: "1px solid rgba(148,163,184,0.55)",
                      fontSize: 11,
                      fontWeight: 1000,
                      color: "#0f172a",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={b.label}
                  >
                    {b.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fmtLocalRange(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return "";
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  return `${s.toLocaleString()} → ${e.toLocaleString()}`;
}

function ScheduleInterviewsInner() {
  const searchParams = useSearchParams();
  const focusId = (searchParams?.get("focus") || "").trim();

  const [{ token, user }, setAuth] = useState<{ token: string; user: any | null }>({ token: "", user: null });
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [credsByEmployeeId, setCredsByEmployeeId] = useState<Record<string, InterviewXBlueprintCredentials>>({});
  const [reportByEmployeeId, setReportByEmployeeId] = useState<
    Record<string, { ready: boolean; message?: string; report?: InterviewXBlueprintReport; detailedReport?: InterviewXBlueprintDetailedReport }>
  >({});
  const [openCredsLoadingId, setOpenCredsLoadingId] = useState<string>("");
  const [openReportLoadingId, setOpenReportLoadingId] = useState<string>("");
  const [reportModal, setReportModal] = useState<{
    open: boolean;
    employeeLabel: string;
    report: InterviewXBlueprintDetailedReport | null;
  }>({ open: false, employeeLabel: "", report: null });
  const [scheduleModal, setScheduleModal] = useState<{
    open: boolean;
    employeeId: string;
    employeeLabel: string;
    roleName: string;
    startLocal: string;
    endLocal: string;
  }>({ open: false, employeeId: "", employeeLabel: "", roleName: "", startLocal: "", endLocal: "" });

  useEffect(() => {
    const onChange = () => setAuth(getOrgAuthFromStorage());
    setAuth(getOrgAuthFromStorage());
    window.addEventListener("jbv2-org-auth-changed", onChange);
    return () => window.removeEventListener("jbv2-org-auth-changed", onChange);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const summary = await orgListEmployeesManagerSummary(token);
        if (cancelled) return;
        setRows(Array.isArray(summary) ? summary : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Load latest saved InterviewX credentials so Report works after refresh.
  useEffect(() => {
    if (!token) return;
    if (!rows.length) return;
    let cancelled = false;

    const loadCreds = async () => {
      const ids = rows
        .map((r) => String(r.employee?._id || r.employee?.id || "").trim())
        .filter(Boolean);
      const unique = Array.from(new Set(ids)).slice(0, 80);

      await Promise.all(
        unique.map(async (employeeId) => {
          if (cancelled) return;
          if (credsByEmployeeId[employeeId]?.interviewConfigId) return;
          try {
            const res = await fetch(apiUrl(`/api/interviewx/blueprint-latest-credentials?employeeId=${encodeURIComponent(employeeId)}`), {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;
            const data = (await res.json()) as InterviewXBlueprintCredentials;
            if (!data?.interviewConfigId) return;
            if (cancelled) return;
            setCredsByEmployeeId((cur) => (cur[employeeId]?.interviewConfigId ? cur : { ...cur, [employeeId]: data }));
          } catch {
            // ignore
          }
        }),
      );
    };

    void loadCreds();
    return () => {
      cancelled = true;
    };
  }, [token, rows, credsByEmployeeId]);

  useEffect(() => {
    if (!focusId || loading) return;
    const el = rowRefs.current[focusId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, loading, rows]);

  const interviewReportComparisonBars = useMemo(() => {
    return rows
      .map((r) => {
        const e = r.employee || {};
        const id = String(e._id || e.id || "");
        const label = (e.fullName || e.email || "Employee").slice(0, 22);
        const report = reportByEmployeeId[id]?.report;
        const score = report?.overallScore;
        const value = typeof score === "number" && !Number.isNaN(score) ? Math.max(0, Math.min(10, score)) : null;
        return { id, label, value };
      })
      .filter((x): x is { id: string; label: string; value: number } => Boolean(x.id) && typeof x.value === "number")
      .sort((a, b) => b.value - a.value)
      .slice(0, 14);
  }, [rows, reportByEmployeeId]);

  function createInterviewXForRow(r: EmployeeRow, interviewStartDateTimeIso: string, interviewEndDateTimeIso: string) {
    const e = r.employee || {};
    const ongoing = Array.isArray(r.ongoing) ? r.ongoing : [];
    const tr = String(ongoing[0]?.roleName || "").trim();
    const id = String(e._id || e.id || "").trim();
    const ltScore = r.latestTest?.score;
    const prepAvgPct = typeof r.avgPct === "number" && !Number.isNaN(r.avgPct) ? r.avgPct : null;
    const latestTestScore =
      typeof ltScore === "number" && !Number.isNaN(ltScore) ? ltScore : null;

    // New flow: Blueprint calls its backend, which creates InterviewX interview + candidate
    // and returns credentials to display on this page.
    // (We still open InterviewX candidates view for the created interview.)
    if (!token || !id) return;
    if (openCredsLoadingId === id) return;
    // IMPORTANT: always create a NEW interview on each schedule action.

    void (async () => {
      setOpenCredsLoadingId(id);
      setError("");
      try {
        const res = await fetch(apiUrl("/api/interviewx/blueprint-open-ai-interview"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            employeeId: id,
            prefillRole: tr,
            prepAvgPct,
            latestTestScore,
            interviewStartDateTime: interviewStartDateTimeIso,
            interviewEndDateTime: interviewEndDateTimeIso,
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Failed to open InterviewX (${res.status})`);
        }
        const data = (await res.json()) as InterviewXBlueprintCredentials & { interviewConfigId?: string };
        if (!data?.interviewConfigId) throw new Error("Interview config id missing from response");

        setCredsByEmployeeId((cur) => ({ ...cur, [id]: data }));

        const url = buildInterviewXCandidatesUrl(data.interviewConfigId);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e: any) {
        setError(e?.message || "Failed to create InterviewX interview");
      } finally {
        setOpenCredsLoadingId((cur) => (cur === id ? "" : cur));
      }
    })();
  }

  function openScheduleModalForRow(r: EmployeeRow) {
    const e = r.employee || {};
    const ongoing = Array.isArray(r.ongoing) ? r.ongoing : [];
    const tr = String(ongoing[0]?.roleName || "").trim();
    const id = String(e._id || e.id || "").trim();
    if (!id) return;

    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    setScheduleModal({
      open: true,
      employeeId: id,
      employeeLabel: String(e.fullName || e.email || "Employee"),
      roleName: tr || "Interview",
      startLocal: toDatetimeLocalValue(now),
      endLocal: toDatetimeLocalValue(end),
    });
  }

  async function openReportForRow(r: EmployeeRow) {
    const e = r.employee || {};
    const id = String(e._id || e.id || "").trim();
    if (!id) return;
    if (openReportLoadingId === id) return;

    let creds = credsByEmployeeId[id];
    if (!creds?.interviewConfigId) {
      // Try to recover from backend (page refresh / new session).
      try {
        const resCreds = await fetch(
          apiUrl(`/api/interviewx/blueprint-latest-credentials?employeeId=${encodeURIComponent(id)}`),
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (resCreds.ok) {
          const data = (await resCreds.json()) as InterviewXBlueprintCredentials;
          if (data?.interviewConfigId) {
            setCredsByEmployeeId((cur) => ({ ...cur, [id]: data }));
            creds = data;
          }
        }
      } catch {
        // ignore
      }
    }

    if (!creds?.interviewConfigId) {
      setError("No InterviewX interview found for this employee yet. Please click Schedule Interview first.");
      return;
    }

    setOpenReportLoadingId(id);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/interviewx/blueprint-get-interview-report"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          interviewConfigId: creds.interviewConfigId,
          candidateId: creds.candidateId,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to fetch report (${res.status})`);
      }

      const data = (await res.json()) as {
        ready: boolean;
        message?: string;
        report?: InterviewXBlueprintReport;
        detailedReport?: InterviewXBlueprintDetailedReport;
      };
      setReportByEmployeeId((cur) => ({ ...cur, [id]: data }));
      if (data?.ready && data?.detailedReport) {
        setReportModal({
          open: true,
          employeeLabel: String(e.fullName || e.email || "Employee"),
          report: data.detailedReport,
        });
      } else if (!data?.ready) {
        setError(data?.message || "Report not generated yet");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to fetch report");
    } finally {
      setOpenReportLoadingId((cur) => (cur === id ? "" : cur));
    }
  }

  if (!user && typeof window !== "undefined") {
    const { token: t } = getOrgAuthFromStorage();
    if (!t) window.location.href = "/auth/manager/login";
  }

  if (!user) return null;

  return (
    <div style={wrap}>
      {reportModal.open ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 60,
          }}
          onClick={() => setReportModal({ open: false, employeeLabel: "", report: null })}
        >
          <div
            style={{
              width: "min(980px, 100%)",
              maxHeight: "min(86vh, 860px)",
              overflow: "auto",
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
              padding: 18,
              display: "grid",
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 1000, color: "#0f172a", fontSize: 16 }}>Interview report</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{reportModal.employeeLabel}</div>
              </div>
              <button
                type="button"
                onClick={() => setReportModal({ open: false, employeeLabel: "", report: null })}
                style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#64748b" }}
              >
                ×
              </button>
            </div>

            {reportModal.report ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>Overall score</div>
                    <div style={{ marginTop: 4, fontSize: 24, fontWeight: 1000, color: "#0f172a" }}>
                      {typeof reportModal.report.overallScore === "number" ? reportModal.report.overallScore : "—"}
                      <span style={{ fontSize: 13, fontWeight: 900, color: "#64748b" }}> / 10</span>
                    </div>
                  </div>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>Recommendation</div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                      {reportModal.report.hiringRecommendation || "—"}
                    </div>
                  </div>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>Generated</div>
                    <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                      {reportModal.report.generatedAt ? new Date(reportModal.report.generatedAt).toLocaleString() : "—"}
                    </div>
                  </div>
                </div>

                {reportModal.report.proctoringSummary ? (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>Video proctoring summary</div>
                    <div style={{ marginTop: 6, fontSize: 13, color: "#0f172a", display: "grid", gap: 6 }}>
                      <div>
                        <b>Total violations:</b>{" "}
                        {typeof reportModal.report.proctoringSummary.totalViolations === "number"
                          ? reportModal.report.proctoringSummary.totalViolations
                          : "—"}
                      </div>
                      <div>
                        <b>Serious:</b>{" "}
                        {typeof reportModal.report.proctoringSummary.hasSeriousViolations === "boolean"
                          ? String(reportModal.report.proctoringSummary.hasSeriousViolations)
                          : "—"}
                      </div>
                      {reportModal.report.proctoringSummary.violationTypes?.length ? (
                        <div>
                          <b>Types:</b> {reportModal.report.proctoringSummary.violationTypes.join(", ")}
                        </div>
                      ) : null}
                      {reportModal.report.proctoringSummary.violationSummary ? (
                        <div style={{ color: "#334155" }}>{reportModal.report.proctoringSummary.violationSummary}</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {reportModal.report.overallReview ? (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>Overall review</div>
                    <div style={{ marginTop: 6, fontSize: 13, color: "#0f172a", whiteSpace: "pre-wrap" }}>
                      {reportModal.report.overallReview}
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>Strengths</div>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "#0f172a" }}>
                      {(reportModal.report.strengths || []).length ? (
                        reportModal.report.strengths.map((s, i) => <li key={i}>{s}</li>)
                      ) : (
                        <li style={{ color: "#64748b" }}>—</li>
                      )}
                    </ul>
                  </div>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>Weaknesses</div>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "#0f172a" }}>
                      {(reportModal.report.weaknesses || []).length ? (
                        reportModal.report.weaknesses.map((w, i) => <li key={i}>{w}</li>)
                      ) : (
                        <li style={{ color: "#64748b" }}>—</li>
                      )}
                    </ul>
                  </div>
                </div>

                {reportModal.report.recommendationReason ? (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>Recommendation reasoning</div>
                    <div style={{ marginTop: 6, fontSize: 13, color: "#0f172a", whiteSpace: "pre-wrap" }}>
                      {reportModal.report.recommendationReason}
                    </div>
                  </div>
                ) : null}

                {reportModal.report.overallRubricScores && Object.keys(reportModal.report.overallRubricScores).length ? (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>Rubric scores</div>
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      {Object.entries(reportModal.report.overallRubricScores).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                          <span style={{ color: "#334155", fontWeight: 800 }}>{k}</span>
                          <span style={{ color: "#0f172a", fontWeight: 900 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {Array.isArray(reportModal.report.questionAnalyses) && reportModal.report.questionAnalyses.length ? (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>Question-by-question analysis</div>
                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      {reportModal.report.questionAnalyses.map((qa, idx) => (
                        <details key={idx} style={{ border: "1px solid #eef2f7", borderRadius: 12, padding: 10 }}>
                          <summary style={{ cursor: "pointer", fontWeight: 900, color: "#0f172a", fontSize: 13 }}>
                            Q{idx + 1}{" "}
                            <span style={{ fontWeight: 800, color: "#64748b" }}>
                              {qa.ratingCategory ? `• ${qa.ratingCategory}` : ""}
                              {typeof qa.rating === "number" ? ` • ${qa.rating}/10` : ""}
                            </span>
                          </summary>
                          <div style={{ marginTop: 10, display: "grid", gap: 10, fontSize: 13 }}>
                            {qa.question ? (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>Question</div>
                                <div style={{ marginTop: 4, color: "#0f172a", whiteSpace: "pre-wrap" }}>{qa.question}</div>
                              </div>
                            ) : null}
                            {qa.answer ? (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>Answer</div>
                                <div style={{ marginTop: 4, color: "#0f172a", whiteSpace: "pre-wrap" }}>{qa.answer}</div>
                              </div>
                            ) : null}
                            {qa.analysis ? (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>Analysis</div>
                                <div style={{ marginTop: 4, color: "#0f172a", whiteSpace: "pre-wrap" }}>{qa.analysis}</div>
                              </div>
                            ) : null}
                            {qa.rubricScores && Object.keys(qa.rubricScores).length ? (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>Rubric</div>
                                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                                  {Object.entries(qa.rubricScores).map(([k, v]) => (
                                    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                      <span style={{ color: "#334155", fontWeight: 800 }}>{k}</span>
                                      <span style={{ color: "#0f172a", fontWeight: 900 }}>{v}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#64748b" }}>No report data.</div>
            )}
          </div>
        </div>
      ) : null}
      {scheduleModal.open ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={() => setScheduleModal((cur) => ({ ...cur, open: false }))}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
              padding: 18,
              display: "grid",
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 1000, color: "#0f172a", fontSize: 16 }}>Schedule interview</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {scheduleModal.employeeLabel} • {scheduleModal.roleName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModal((cur) => ({ ...cur, open: false }))}
                style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#64748b" }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>Start time</span>
                <input
                  type="datetime-local"
                  value={scheduleModal.startLocal}
                  onChange={(e) => setScheduleModal((cur) => ({ ...cur, startLocal: e.target.value }))}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 13,
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>End time</span>
                <input
                  type="datetime-local"
                  value={scheduleModal.endLocal}
                  onChange={(e) => setScheduleModal((cur) => ({ ...cur, endLocal: e.target.value }))}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 13,
                  }}
                />
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setScheduleModal((cur) => ({ ...cur, open: false }))}
                style={btnOutline}
              >
                Cancel
              </button>
              <button
                type="button"
                style={btnPrimary}
                onClick={() => {
                  const row = rows.find((rr) => String(rr.employee?._id || rr.employee?.id || "") === scheduleModal.employeeId);
                  if (!row) {
                    setScheduleModal((cur) => ({ ...cur, open: false }));
                    return;
                  }
                  if (!scheduleModal.startLocal || !scheduleModal.endLocal) {
                    setError("Please select both start and end time.");
                    return;
                  }
                  // IMPORTANT: send as local datetime string (no timezone "Z"),
                  // because InterviewX stores/computes windows using LocalDateTime.
                  const startLocal = `${scheduleModal.startLocal}:00`;
                  const endLocal = `${scheduleModal.endLocal}:00`;
                  if (Date.parse(endLocal) <= Date.parse(startLocal)) {
                    setError("End time must be after start time.");
                    return;
                  }
                  setScheduleModal((cur) => ({ ...cur, open: false }));
                  createInterviewXForRow(row, startLocal, endLocal);
                }}
              >
                Create interview &amp; send email
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
            <Link href={appPath("/dashboard/manager")} style={{ color: "#312e81" }}>
              ← Back to dashboard
            </Link>
          </div>
          <h1 style={{ margin: "10px 0 4px", fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Schedule interview</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b", maxWidth: 760 }}>
            Compare preparation scores and review your team’s department, target role, and email. Blueprint does not store interview slots or
            report URLs — use <b>Schedule Interview</b> to auto-create the AI interview + candidate and show the generated credentials below.
          </p>
        </div>
      </div>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 14 }}>
        <div style={card}>
          <div style={cardTitle}>
            <span style={titleIcon("#10b981")}>🏁</span>
            Interview report score comparison
          </div>
          <p style={{ margin: "4px 0 12px", fontSize: 12, color: "#64748b" }}>
            Overall interview score (0–10) from InterviewX reports. Use <b>Report</b> per employee to load scores after completion.
          </p>
          {interviewReportComparisonBars.length === 0 ? (
            <div style={{ fontSize: 13, color: "#94a3b8", padding: "12px 0" }}>No interview reports yet.</div>
          ) : (
            <BarGraph bars={interviewReportComparisonBars} accent="#10b981" maxValue={10} />
          )}
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>
          <span style={titleIcon("#6366f1")}>👥</span>
          Candidates in your scope
        </div>
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 14, marginTop: 12 }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Employee", "Department", "Prep role", "Email", "Actions"].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14, color: "#64748b" }}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14, color: "#64748b" }}>
                    No employees in scope.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const e = r.employee || {};
                  const id = String(e._id || e.id || "");
                  const ongoing = Array.isArray(r.ongoing) ? r.ongoing : [];
                  const prepRoleLabel = ongoing[0]?.roleName || "";
                  const creds = credsByEmployeeId[id];
                  const showCreds = Boolean(creds?.loginLink && creds?.password);
                  const reportState = reportByEmployeeId[id];
                  const showReport = Boolean(reportState?.ready && reportState?.report);

                  return (
                    <tr
                      key={id || e.email}
                      ref={(el) => {
                        rowRefs.current[id] = el;
                      }}
                      style={focusId === id ? { background: "#eef2ff" } : undefined}
                    >
                      <td style={td}>
                        <div style={{ fontWeight: 800 }}>{e.fullName || "—"}</div>
                      </td>
                      <td style={td}>{e.department ? String(e.department) : <span style={{ color: "#94a3b8" }}>—</span>}</td>
                      <td style={td}>
                        {prepRoleLabel ? <span>{prepRoleLabel}</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                      <td style={td}>
                        <span style={{ wordBreak: "break-all", fontSize: 13 }}>{e.email || "—"}</span>
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => openScheduleModalForRow(r)}
                            style={btnPrimary}
                            disabled={openCredsLoadingId === id}
                          >
                            Schedule Interview
                          </button>
                          <button
                            type="button"
                            onClick={() => void openReportForRow(r)}
                            style={btnOutline}
                            disabled={openReportLoadingId === id}
                          >
                            {openReportLoadingId === id ? "Loading..." : "Report"}
                          </button>
                        </div>
                        {showCreds ? (
                          <div style={{ marginTop: 10, fontSize: 12, color: "#0f172a", lineHeight: 1.45 }}>
                            <div style={{ fontWeight: 900, fontSize: 12, color: "#312e81" }}>Credentials</div>
                            <div>
                              Link:{" "}
                              <a
                                href={creds.loginUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "#4f46e5", fontWeight: 800, wordBreak: "break-all" }}
                              >
                                Open
                              </a>
                            </div>
                            <div>
                              Password: <code style={{ fontSize: 11 }}>{creds.password}</code>
                            </div>
                            {fmtLocalRange(creds.interviewStartDateTime, creds.interviewEndDateTime) ? (
                              <div style={{ marginTop: 4, color: "#334155" }}>
                                Time:{" "}
                                <span style={{ fontWeight: 800 }}>
                                  {fmtLocalRange(creds.interviewStartDateTime, creds.interviewEndDateTime)}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {reportState?.ready === false && reportState?.message ? (
                          <div style={{ marginTop: 10, fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
                            Report: {reportState.message}
                          </div>
                        ) : null}

                        {showReport && reportState?.report ? (
                          <div style={{ marginTop: 10, fontSize: 12, color: "#0f172a", lineHeight: 1.45 }}>
                            <div style={{ fontWeight: 900, fontSize: 12, color: "#312e81" }}>Interview Report</div>
                            <div>
                              Overall score: <b>{reportState.report.overallScore ?? "N/A"}</b>
                              {typeof reportState.report.overallScore === "number" ? "/10" : ""}
                            </div>
                            <div>
                              Recommendation: <b>{reportState.report.hiringRecommendation ?? "N/A"}</b>
                            </div>
                            {reportState.report.overallReview ? (
                              <div style={{ marginTop: 6, color: "#334155" }}>
                                {reportState.report.overallReview}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ width: "100%", marginTop: 28 }}>
        <SiteFooter />
      </div>
    </div>
  );
}

export default function ScheduleInterviewsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "#64748b" }}>Loading…</div>}>
      <ScheduleInterviewsInner />
    </Suspense>
  );
}

const wrap: React.CSSProperties = {
  marginTop: 2,
  padding: 0,
  display: "grid",
  gap: 14,
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 4px 18px -10px rgba(15,23,42,0.08)",
};

const cardTitle: React.CSSProperties = { fontSize: 15, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 10 };

function titleIcon(accent: string): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: 10,
    background: `${accent}14`,
    color: accent,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    flex: "0 0 auto",
  };
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 720,
  borderCollapse: "collapse",
  fontSize: 13,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 12px",
  fontWeight: 800,
  fontSize: 12,
  color: "#0f172a",
  borderBottom: "1px solid #e5e7eb",
};

const td: React.CSSProperties = {
  padding: "12px 12px",
  verticalAlign: "top",
  borderBottom: "1px solid #f1f5f9",
};

const btnPrimary: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "8px 12px",
  fontWeight: 900,
  fontSize: 12,
  cursor: "pointer",
  background: "linear-gradient(135deg,#312e81,#4f46e5)",
  color: "#fff",
  boxShadow: "0 4px 12px -6px rgba(79,70,229,0.6)",
};

const btnOutline: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  padding: "8px 12px",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 13,
};

const errorStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontSize: 13,
};
