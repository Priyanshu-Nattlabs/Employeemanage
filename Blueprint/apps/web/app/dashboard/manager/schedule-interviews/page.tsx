"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getOrgAuthFromStorage,
  orgCreateScheduledInterview,
  orgListEmployeesManagerSummary,
  orgListScheduledInterviews,
  orgPatchScheduledInterview,
  orgScheduledInterviewSummaryByEmployee,
  type ScheduledInterviewEmployeeSummary,
} from "@/lib/orgAuth";
import { SiteFooter } from "@/app/components/SiteFooter";
import { appPath } from "@/lib/apiBase";

type EmployeeRow = {
  employee: any;
  ongoing: Array<{ roleName: string; pct: number; startedAt?: string | null }>;
  avgPct: number;
  latestTest: { roleName?: string; skillName?: string; score?: number | null; passed?: boolean; completedAt?: string | null } | null;
};

function ScheduleInterviewsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = (searchParams?.get("focus") || "").trim();

  const [{ token, user }, setAuth] = useState<{ token: string; user: any | null }>({ token: "", user: null });
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [summaryByEmp, setSummaryByEmp] = useState<Record<string, ScheduledInterviewEmployeeSummary>>({});
  const [scheduledList, setScheduledList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const [modalRow, setModalRow] = useState<EmployeeRow | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [durationMin, setDurationMin] = useState(45);
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [reportModal, setReportModal] = useState<{ id: string; employeeLabel: string } | null>(null);
  const [reportUrlInput, setReportUrlInput] = useState("");
  const [reportSaving, setReportSaving] = useState(false);

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
        const [summary, summMap, list] = await Promise.all([
          orgListEmployeesManagerSummary(token),
          orgScheduledInterviewSummaryByEmployee(token),
          orgListScheduledInterviews(token),
        ]);
        if (cancelled) return;
        setRows(Array.isArray(summary) ? summary : []);
        setSummaryByEmp(summMap && typeof summMap === "object" ? summMap : {});
        setScheduledList(Array.isArray(list) ? list : []);
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

  useEffect(() => {
    if (!focusId || loading) return;
    const el = rowRefs.current[focusId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, loading, rows]);

  const openScheduleModal = (r: EmployeeRow) => {
    const e = r.employee || {};
    const ongoing = Array.isArray(r.ongoing) ? r.ongoing : [];
    const defaultRole = ongoing[0]?.roleName || "";
    setModalRow(r);
    setTargetRole(defaultRole);
    setScheduledAtLocal("");
    setDurationMin(45);
    setLocation("");
    setMeetingLink("");
    setNotes("");
    router.replace(appPath("/dashboard/manager/schedule-interviews"));
  };

  const submitSchedule = async () => {
    if (!token || !modalRow?.employee) return;
    const tr = String(targetRole || "").trim();
    if (!tr) {
      setError("Choose or enter the target role.");
      return;
    }
    if (!scheduledAtLocal) {
      setError("Pick date and time.");
      return;
    }
    const iso = new Date(scheduledAtLocal).toISOString();
    setSaving(true);
    setError("");
    try {
      await orgCreateScheduledInterview(token, {
        employeeId: String(modalRow.employee._id || modalRow.employee.id),
        targetRoleName: tr,
        scheduledAt: iso,
        durationMinutes: durationMin || undefined,
        location: location.trim() || undefined,
        meetingLink: meetingLink.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setModalRow(null);
      const [summMap, list] = await Promise.all([
        orgScheduledInterviewSummaryByEmployee(token),
        orgListScheduledInterviews(token),
      ]);
      setSummaryByEmp(summMap && typeof summMap === "object" ? summMap : {});
      setScheduledList(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message || "Could not schedule");
    } finally {
      setSaving(false);
    }
  };

  const submitReport = async () => {
    if (!token || !reportModal?.id) return;
    const url = reportUrlInput.trim();
    setReportSaving(true);
    setError("");
    try {
      await orgPatchScheduledInterview(token, reportModal.id, {
        status: "COMPLETED",
        reportUrl: url || undefined,
      });
      setReportModal(null);
      setReportUrlInput("");
      const [summMap, list] = await Promise.all([
        orgScheduledInterviewSummaryByEmployee(token),
        orgListScheduledInterviews(token),
      ]);
      setSummaryByEmp(summMap && typeof summMap === "object" ? summMap : {});
      setScheduledList(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message || "Could not save report");
    } finally {
      setReportSaving(false);
    }
  };

  const sortedScheduled = useMemo(() => {
    return scheduledList.slice().sort((a, b) => {
      const ta = new Date(a.scheduledAt || a.createdAt || 0).getTime();
      const tb = new Date(b.scheduledAt || b.createdAt || 0).getTime();
      return tb - ta;
    });
  }, [scheduledList]);

  if (!user && typeof window !== "undefined") {
    const { token: t } = getOrgAuthFromStorage();
    if (!t) window.location.href = "/auth/manager/login";
  }

  if (!user) return null;

  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
            <Link href={appPath("/dashboard/manager")} style={{ color: "#312e81" }}>
              ← Back to dashboard
            </Link>
          </div>
          <h1 style={{ margin: "10px 0 4px", fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Schedule interviews</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b", maxWidth: 720 }}>
            Each candidate&apos;s name, email, department, and preparation roles are listed below. Schedule picks date, time,
            and optional location or meeting link. After an interview finishes in InterviewX (or elsewhere), paste the report URL here so it appears on the main dashboard column.
          </p>
        </div>
      </div>

      {error ? (
        <div style={errorStyle}>{error}</div>
      ) : null}

      {/* Candidate roster */}
      <div style={card}>
        <div style={cardTitle}>
          <span style={titleIcon("#6366f1")}>👥</span>
          Candidates in your scope
        </div>
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 14, marginTop: 12 }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Employee", "Department", "Email", "Prep roles", "Interview status", ""].map((h) => (
                  <th key={h || "a"} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: "#64748b" }}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: "#64748b" }}>
                    No employees in scope.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const e = r.employee || {};
                  const id = String(e._id || e.id || "");
                  const ongoing = Array.isArray(r.ongoing) ? r.ongoing : [];
                  const summ = summaryByEmp[id];
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
                        <span style={{ wordBreak: "break-all", fontSize: 13 }}>{e.email || "—"}</span>
                      </td>
                      <td style={td}>
                        {ongoing.length ? (
                          <span>{ongoing.map((o) => o.roleName).join(", ")}</span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>None yet — enter role when scheduling</span>
                        )}
                      </td>
                      <td style={td}>
                        {!summ ? (
                          <span style={{ color: "#94a3b8" }}>Not scheduled</span>
                        ) : summ.reportUrl ? (
                          <a href={summ.reportUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 800, color: "#15803d" }}>
                            Report available
                          </a>
                        ) : summ.status === "SCHEDULED" ? (
                          <span title={summ.scheduledAt || ""}>Scheduled{summ.scheduledAt ? ` · ${new Date(summ.scheduledAt).toLocaleString()}` : ""}</span>
                        ) : (
                          <span>{summ.status}</span>
                        )}
                      </td>
                      <td style={td}>
                        <button type="button" onClick={() => openScheduleModal(r)} style={btnPrimary}>
                          Schedule interview
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent scheduled rows — attach InterviewX report URL */}
      <div style={card}>
        <div style={cardTitle}>
          <span style={titleIcon("#10b981")}>📋</span>
          Scheduled &amp; reports
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
          When an interview is completed, open &quot;Add report link&quot; and paste the InterviewX report URL (or any link). It also appears on the dashboard column for that employee.
        </div>
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 14, marginTop: 12 }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Candidate", "Role", "When", "Status", ""].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedScheduled.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14, color: "#64748b" }}>
                    No interviews scheduled yet.
                  </td>
                </tr>
              ) : (
                sortedScheduled.slice(0, 40).map((row: any) => {
                  const when = row.scheduledAt ? new Date(row.scheduledAt).toLocaleString() : "—";
                  const label = row.employeeName || row.employeeEmail || "—";
                  return (
                    <tr key={String(row._id)}>
                      <td style={td}>
                        <div style={{ fontWeight: 800 }}>{label}</div>
                        <div style={{ fontSize: 12, color: "#64748b", wordBreak: "break-all" }}>{row.employeeEmail}</div>
                      </td>
                      <td style={td}>{row.targetRoleName}</td>
                      <td style={td}>{when}</td>
                      <td style={td}>{row.status}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {row.reportUrl ? (
                            <a href={row.reportUrl} target="_blank" rel="noopener noreferrer" style={linkBtn}>
                              Open report
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setReportModal({
                                  id: String(row._id),
                                  employeeLabel: label,
                                });
                                setReportUrlInput("");
                              }}
                              style={btnOutline}
                            >
                              Add report link
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalRow ? (
        <div style={modalBackdrop} role="presentation" onClick={() => !saving && setModalRow(null)}>
          <div
            style={modalBoxSchedule}
            role="dialog"
            aria-modal
            aria-labelledby="sched-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div style={{ flexShrink: 0 }}>
              <h2 id="sched-title" style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 900 }}>
                Schedule interview
              </h2>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>
                <div>
                  <b>Name:</b> {modalRow.employee?.fullName || "—"}
                </div>
                <div>
                  <b>Email:</b> {modalRow.employee?.email || "—"}
                </div>
                <div>
                  <b>Department:</b> {modalRow.employee?.department || "—"}
                </div>
              </div>
            </div>

            <div style={modalBodyScroll}>
            <label style={lbl}>
              Target role (preparing for)
              {Array.isArray(modalRow.ongoing) && modalRow.ongoing.length > 0 ? (
                <select
                  value={
                    modalRow.ongoing.some((o) => o.roleName === targetRole)
                      ? targetRole
                      : "__other__"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__other__") setTargetRole("");
                    else setTargetRole(v);
                  }}
                  style={inp}
                >
                  {modalRow.ongoing.map((o) => (
                    <option key={o.roleName} value={o.roleName}>
                      {o.roleName}
                    </option>
                  ))}
                  <option value="__other__">Other…</option>
                </select>
              ) : null}
              {(!modalRow.ongoing?.length ||
                (modalRow.ongoing?.length > 0 && !modalRow.ongoing.some((o) => o.roleName === targetRole))) && (
                <input
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="Role title (e.g. from prep or InterviewX)"
                  style={{ ...inp, marginTop: modalRow.ongoing?.length ? 8 : 0 }}
                />
              )}
            </label>

            <label style={lbl}>
              Date &amp; time
              <input type="datetime-local" value={scheduledAtLocal} onChange={(e) => setScheduledAtLocal(e.target.value)} style={inp} />
            </label>

            <label style={lbl}>
              Duration (minutes)
              <input
                type="number"
                min={5}
                step={5}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value) || 45)}
                style={inp}
              />
            </label>

            <label style={lbl}>
              Location <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} style={inp} placeholder="Room, office, etc." />
            </label>

            <label style={lbl}>
              Meeting link <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span>
              <input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} style={inp} placeholder="https://…" />
            </label>

            <label style={{ ...lbl, marginBottom: 0 }}>
              Notes <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ ...inp, minHeight: 64, maxHeight: 120, resize: "vertical" }}
              />
            </label>
            </div>

            <div style={modalFooter}>
              <button type="button" disabled={saving} onClick={() => setModalRow(null)} style={btnOutline}>
                Cancel
              </button>
              <button type="button" disabled={saving} onClick={() => void submitSchedule()} style={btnPrimary}>
                {saving ? "Saving…" : "Save schedule"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reportModal ? (
        <div style={modalBackdrop} role="presentation" onClick={() => !reportSaving && setReportModal(null)}>
          <div style={modalBoxReport} role="dialog" aria-modal onClick={(ev) => ev.stopPropagation()}>
            <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 900 }}>Add InterviewX report link</h2>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
              Candidate: <b>{reportModal.employeeLabel}</b>. Paste the full report URL from your browser after the interview completes.
            </p>
            <input
              value={reportUrlInput}
              onChange={(e) => setReportUrlInput(e.target.value)}
              placeholder="https://…"
              style={{ ...inp, marginBottom: 12 }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" disabled={reportSaving} onClick={() => setReportModal(null)} style={btnOutline}>
                Cancel
              </button>
              <button type="button" disabled={reportSaving} onClick={() => void submitReport()} style={btnPrimary}>
                {reportSaving ? "Saving…" : "Mark complete & save link"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

const linkBtn: React.CSSProperties = {
  fontWeight: 800,
  color: "#15803d",
  textDecoration: "underline",
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

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.45)",
  zIndex: 50,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
  overflowY: "auto",
  overscrollBehavior: "contain",
  WebkitOverflowScrolling: "touch",
};

const modalBoxBase: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  maxWidth: 480,
  width: "100%",
  boxSizing: "border-box",
  boxShadow: "0 20px 50px -20px rgba(15,23,42,0.35)",
  border: "1px solid #e5e7eb",
};

/** Tall schedule form: cap height and scroll fields; footer stays pinned */
const modalBoxSchedule: React.CSSProperties = {
  ...modalBoxBase,
  display: "flex",
  flexDirection: "column",
  maxHeight: "min(92vh, calc(100dvh - 32px))",
  marginTop: "max(0px, env(safe-area-inset-top))",
  overflow: "hidden",
};

const modalBodyScroll: React.CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  paddingRight: 4,
  marginRight: -2,
};

const modalFooter: React.CSSProperties = {
  flexShrink: 0,
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
  paddingTop: 14,
  marginTop: 12,
  borderTop: "1px solid #e5e7eb",
};

const modalBoxReport: React.CSSProperties = {
  ...modalBoxBase,
  maxHeight: "min(90vh, calc(100dvh - 32px))",
  overflow: "auto",
};

const lbl: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 800,
  color: "#334155",
  marginBottom: 10,
};

const inp: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
