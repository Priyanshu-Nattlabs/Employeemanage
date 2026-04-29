"use client";
import React, { Suspense, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { getApiPrefix } from "@/lib/apiBase";
import { getOrgAuthFromStorage, orgCreateRecommendation } from "@/lib/orgAuth";
import { buildInterviewXAiInterviewUrl } from "@/lib/interviewx";

const API = getApiPrefix();

/* ─── colour helpers ──────────────────────────────────────── */
const TECH_COLORS = ["#3170A5","#0EA5E9","#15614B","#2563EB","#0F2B43","#2C6099","#065F46"];
const SOFT_COLORS = ["#A78BFA","#FBBF24","#F87171","#8B5CF6","#F97316","#EC4899","#6366F1"];
const taskColor = (type: string, idx: number) =>
  type === "non-technical" ? SOFT_COLORS[idx % SOFT_COLORS.length] : TECH_COLORS[idx % TECH_COLORS.length];

const diffColor = (d?: string) => {
  const m: Record<string,[string,string]> = {
    beginner:     ["#dcfce7","#166534"],
    intermediate: ["#fef9c3","#854d0e"],
    advanced:     ["#fee2e2","#991b1b"],
  };
  const c = m[(d||"").toLowerCase()]; return c ? {bg:c[0],text:c[1]} : {bg:"#f1f5f9",text:"#64748b"};
};
const impColor = (i?: string) => {
  const m: Record<string,[string,string]> = {
    essential:     ["#fce7f3","#9d174d"],
    important:     ["#ede9fe","#5b21b6"],
    "good to have":["#f0fdf4","#166534"],
    "good to be":  ["#f0fdf4","#166534"],
  };
  const c = m[(i||"").toLowerCase()]; return c ? {bg:c[0],text:c[1]} : {bg:"#f1f5f9",text:"#475569"};
};

/* ─── style constants ─────────────────────────────────────── */
const card: React.CSSProperties = {
  background:"white", borderRadius:12, border:"1px solid rgba(0,0,0,0.1)",
  padding:20, boxShadow:"0 2px 8px rgba(0,0,0,.06)"
};
const pill = (bg:string, color:string): React.CSSProperties => ({
  display:"inline-block", padding:"3px 10px", borderRadius:999,
  fontSize:11, fontWeight:700, background:bg, color, letterSpacing:".04em"
});
const btn = (color:string, bg:string, border=bg): React.CSSProperties => ({
  padding:"8px 16px", borderRadius:8, border:`1.5px solid ${border}`,
  background:bg, color, fontWeight:600, fontSize:13, cursor:"pointer",
  display:"inline-flex", alignItems:"center", gap:6, transition:"opacity .15s"
});

const normSkill = (v: string) =>
  String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const skillTokens = (v: string) => new Set(normSkill(v).split(" ").filter(Boolean));

const skillsAreSimilar = (a: string, b: string) => {
  const na = normSkill(a);
  const nb = normSkill(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = skillTokens(na);
  const tb = skillTokens(nb);
  const inter = Array.from(ta).filter((t) => tb.has(t)).length;
  return inter >= 1;
};

/** Search links for this topic only (not role/skill). */
function topicPrepUrls(topic: string) {
  const t = topic.trim().replace(/\s+/g, " ");
  const ytQ = `${t} tutorial`;
  const webQ = `${t} tutorial learn`;
  return {
    youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQ)}`,
    web: `https://www.google.com/search?q=${encodeURIComponent(webQ)}`,
  };
}

type StudyPayload = {
  query: string;
  wikipedia: { title: string; url: string; source: string }[];
  books: { title: string; url: string; source: string }[];
  papers: { title: string; url: string; source: string }[];
  videos: { title: string; url: string; source: string }[];
};

const studyResourcesCache = new Map<string, StudyPayload>();
const STUDY_CACHE_VER = "v3-topic-only";

const emptyPayload = (): StudyPayload => ({
  query: "",
  wikipedia: [],
  books: [],
  papers: [],
  videos: [],
});

function videoSourceLabel(source: string) {
  if (source === "peertube") return "PeerTube";
  if (source === "archive") return "Internet Archive";
  return source;
}

/** Lazy-loads catalog results for this topic when the panel opens; manual search links always available. */
function TopicResourcesButton({
  topic,
  compact,
}: {
  topic: string;
  compact?: boolean;
}) {
  const u = topicPrepUrls(topic);
  const cacheKey = `${STUDY_CACHE_VER}\n${topic}`;

  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [payload, setPayload] = useState<StudyPayload | null>(() => studyResourcesCache.get(cacheKey) ?? null);
  const [loading, setLoading] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const cached = studyResourcesCache.get(cacheKey);
    if (cached) {
      setPayload(cached);
      return;
    }
    setLoading(true);
    const q = new URLSearchParams({ topic });
    fetch(`${API}/api/blueprint/study-resources?${q.toString()}`)
      .then((r) => r.json())
      .then((data: StudyPayload) => {
        studyResourcesCache.set(cacheKey, data);
        setPayload(data);
      })
      .catch(() => {
        const e = emptyPayload();
        studyResourcesCache.set(cacheKey, e);
        setPayload(e);
      })
      .finally(() => setLoading(false));
  }, [open, cacheKey, topic]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const positionPopover = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.min(340, window.innerWidth - 16);
    let left = r.right - w;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
    setPlace({ top: r.bottom + 6, left, width: w });
  };

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) {
      positionPopover();
      setOpen(true);
    } else {
      setOpen(false);
      setPlace(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onScroll = () => positionPopover();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const secTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    margin: "10px 0 6px",
  };
  const rowLink: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    color: "#2563eb",
    textDecoration: "none",
    marginBottom: 6,
    lineHeight: 1.45,
    wordBreak: "break-word",
  };
  const pillSm = (bg: string, color: string): React.CSSProperties => ({
    display: "inline-block",
    fontSize: 9,
    fontWeight: 800,
    padding: "1px 5px",
    borderRadius: 4,
    background: bg,
    color,
    marginRight: 6,
    verticalAlign: "middle",
  });

  const wiki = payload?.wikipedia ?? [];
  const books = payload?.books ?? [];
  const papers = payload?.papers ?? [];
  const videos = payload?.videos ?? [];

  const panel =
    open &&
    place &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={popRef}
        style={{
          position: "fixed",
          top: place.top,
          left: place.left,
          width: place.width,
          maxHeight: "min(70vh, 480px)",
          overflowY: "auto",
          zIndex: 200000,
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          boxShadow: "0 20px 50px rgba(0,0,0,.18)",
          padding: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 4 }}>Study resources</div>
        <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>
          Everything below is matched to this topic only (not your role). Open the panel to load catalog results.
        </p>

        <div style={secTitle}>Search the web</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <a href={u.youtube} target="_blank" rel="noopener noreferrer" style={{ ...rowLink, display: "inline-block", marginBottom: 0, padding: "6px 10px", background: "#fef2f2", borderRadius: 8, color: "#b91c1c", fontWeight: 700 }}>
            ▶ YouTube
          </a>
          <a href={u.web} target="_blank" rel="noopener noreferrer" style={{ ...rowLink, display: "inline-block", marginBottom: 0, padding: "6px 10px", background: "#f8fafc", borderRadius: 8, fontWeight: 700 }}>
            Web
          </a>
        </div>

        <div style={secTitle}>Videos {loading && "(loading…)"}</div>
        {!loading && videos.length === 0 && <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>No catalog matches yet.</p>}
        {!loading &&
          videos.map((v, i) => (
            <a key={`v-${i}-${v.url}`} href={v.url} target="_blank" rel="noopener noreferrer" style={rowLink}>
              <span style={pillSm(v.source === "peertube" ? "#fce7f3" : "#fef3c7", v.source === "peertube" ? "#9d174d" : "#b45309")}>{videoSourceLabel(v.source)}</span>
              {v.title}
            </a>
          ))}

        <div style={secTitle}>Encyclopedia & articles</div>
        {!loading && wiki.length === 0 && <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>No Wikipedia matches.</p>}
        {!loading &&
          wiki.map((w, i) => (
            <a key={`w-${i}-${w.url}`} href={w.url} target="_blank" rel="noopener noreferrer" style={rowLink}>
              <span style={pillSm("#d1fae5", "#047857")}>Wikipedia</span>
              {w.title}
            </a>
          ))}

        <div style={secTitle}>Books</div>
        {!loading && books.length === 0 && <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>No Open Library matches.</p>}
        {!loading &&
          books.map((b, i) => (
            <a key={`b-${i}-${b.url}`} href={b.url} target="_blank" rel="noopener noreferrer" style={rowLink}>
              <span style={pillSm("#fef3c7", "#b45309")}>Book</span>
              {b.title}
            </a>
          ))}

        <div style={secTitle}>Research papers</div>
        {!loading && papers.length === 0 && <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>No Semantic Scholar matches.</p>}
        {!loading &&
          papers.map((p, i) => (
            <a key={`p-${i}-${p.url}`} href={p.url} target="_blank" rel="noopener noreferrer" style={rowLink}>
              <span style={pillSm("#ede9fe", "#5b21b6")}>Paper</span>
              {p.title}
            </a>
          ))}
      </div>,
      document.body
    );

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
        style={{
          fontSize: compact ? 10 : 12,
          fontWeight: 800,
          padding: compact ? "4px 8px" : "6px 12px",
          borderRadius: 8,
          border: "1px solid #BFDBFE",
          background: open ? "#EFF6FF" : "#F8FAFC",
          color: "#3170A5",
          cursor: "pointer",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        📚 {compact ? "" : "Resources"}
      </button>
      {panel}
    </div>
  );
}

/* ─── tooltip state shape ─────────────────────────────────── */
type Tooltip = {
  x:number; y:number; above:boolean;
  skillName:string; month:number; color:string;
  topKey:string; taskStart:number; taskEnd:number;
  taskType:string; taskDiff:string;
};

/* ══════════════════════════════════════════════════════════ */
export default function RolePage() {
  return (
    <Suspense>
      <RolePageContent />
    </Suspense>
  );
}

function RolePageContent() {
  const params       = useParams<{ roleName: string }>();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const roleName     = decodeURIComponent(params.roleName);

  /* context passed from industry / education pages */
  const ctxIndustry  = searchParams.get("industry")  ?? "";
  const ctxEducation = searchParams.get("education") ?? "";
  const ctxSpecialization = searchParams.get("specialization") ?? "";
  const targetStartDate = searchParams.get("targetStartDate") ?? "";
  const targetCompletionDate = searchParams.get("targetCompletionDate") ?? "";
  const employeeLevel = searchParams.get("employeeLevel") ?? "";
  const levelQuery = employeeLevel ? `?level=${enc(employeeLevel)}` : "";
  const targetDurationMonths = Number(searchParams.get("targetDurationMonths") || "");

  /* manager → "recommend role" flow context (passed via querystring from /dashboard/manager) */
  const recommendFor   = searchParams.get("recommendFor")   ?? "";
  const recommendName  = searchParams.get("recommendName")  ?? "";
  const recommendEmail = searchParams.get("recommendEmail") ?? "";
  const recommendDept  = searchParams.get("recommendDept")  ?? "";
  const isRecommendMode = !!recommendFor;

  const [recommendNote, setRecommendNote] = useState("");
  const [recommendSending, setRecommendSending] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);

  const submitRecommendation = async () => {
    if (!isRecommendMode) return;
    const auth = getOrgAuthFromStorage();
    if (!auth?.token) {
      setRecommendError("Your session expired — please log in again.");
      return;
    }
    setRecommendSending(true);
    setRecommendError(null);
    try {
      await orgCreateRecommendation(auth.token, {
        employeeId: recommendFor,
        roleName,
        note: recommendNote.trim() || undefined,
      });
      const params = new URLSearchParams();
      params.set("recommended", roleName);
      if (recommendName) params.set("for", recommendName);
      router.push(`/dashboard/manager?${params.toString()}`);
    } catch (e: any) {
      setRecommendError(e?.message || "Could not send the recommendation. Please try again.");
      setRecommendSending(false);
    }
  };

  const [mounted,         setMounted]         = useState(false);
  const [userId,          setUserId]          = useState("demo-student-1");
  const [profileRemainingMonths, setProfileRemainingMonths] = useState<number | null>(null);
  const [data,            setData]            = useState<any>(null);
  const [contextualData,  setContextualData]  = useState<any>(null);
  const [ctxLoading,      setCtxLoading]      = useState(false);
  const [mappings,        setMappings]        = useState<any>(null);
  const [prep,            setPrep]            = useState<any>(null);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [savedMsg,        setSavedMsg]        = useState("");
  const [topicsCache,     setTopicsCache]     = useState<Record<string, Record<string,string[]>>>({});
  const [topicsLoading,   setTopicsLoading]   = useState<Record<string,boolean>>({});
  const [tooltip,         setTooltip]         = useState<Tooltip|null>(null);
  const [expandedSkills,  setExpandedSkills]  = useState<Record<string, boolean>>({});
  const [trendingJobs,    setTrendingJobs]    = useState<any>(null);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingErr,     setTrendingErr]     = useState<string>("");
  const [knownSkillsSelection, setKnownSkillsSelection] = useState<string[]>([]);
  const [savingKnownSkills, setSavingKnownSkills] = useState(false);
  const [mockInterviewLaunching, setMockInterviewLaunching] = useState(false);
  const [previousLevelSkills, setPreviousLevelSkills] = useState<string[]>([]);
  const [skillCompareLoading, setSkillCompareLoading] = useState(false);
  const [proficiencyDelta, setProficiencyDelta] = useState<Array<{ skillName: string; increasePct: number; reason?: string; previousSkill?: string }>>([]);
  /** Base role doc (JD + skills) when chart snapshot omits them */
  const [baseRole,        setBaseRole]        = useState<any>(null);

  /* ── chart customization modal ── */
  const [showCustomize,      setShowCustomize]      = useState(false);
  const [custDuration,       setCustDuration]       = useState("");
  const [custBreakMonths,    setCustBreakMonths]     = useState<Set<number>>(new Set());
  const [custPriority,       setCustPriority]       = useState<string[]>([]);

  useEffect(() => { setMounted(true); }, []);

  /* ── load ────────────────────────────────────────────────────────────────
     If an active preparation with a saved chart exists, use that chart so the
     learner always sees the exact plan they committed to.
     Otherwise call the chart endpoint to generate a fresh chart.           */
  const load = async (uid?: string) => {
    setLoading(true); setTooltip(null); setTopicsCache({});
    const u = uid ?? userId;
    try {
      const [pR, mR, roleR] = await Promise.all([
        fetch(`${API}/api/role-preparation/${enc(roleName)}?studentId=${enc(u)}`),
        fetch(`${API}/api/blueprint/role/${enc(roleName)}/mappings`),
        fetch(`${API}/api/blueprint/role/${enc(roleName)}${levelQuery}`),
      ]);
      const prepData     = await pR.json().catch(() => null);
      const mappingsData = await mR.json().catch(() => null);
      const roleJson     = await roleR.json().catch(() => null);
      setPrep(prepData);
      setMappings(mappingsData);
      setBaseRole(roleJson && typeof roleJson === "object" && !Array.isArray(roleJson) ? roleJson : null);

      // If an active prep has a saved chart snapshot, use it directly
      if (prepData?.isActive && (prepData?.ganttChartData as any)?.plan) {
        const saved: any = prepData.ganttChartData;
        setData(saved);
        if (saved.topicsCache) setTopicsCache(saved.topicsCache);
        return;
      }

      // No saved chart → generate chart using the deterministic algorithm
      let chartData: any = null;
      try {
        const durationQuery = Number.isFinite(targetDurationMonths) && targetDurationMonths > 0
          ? `&duration=${encodeURIComponent(String(targetDurationMonths))}`
          : "";
        const levelParam = employeeLevel ? `&level=${enc(employeeLevel)}` : "";
        const rR = await fetch(`${API}/api/blueprint/role/${enc(roleName)}/gantt?userId=${enc(u)}${durationQuery}${levelParam}`);
        const body = await rR.json().catch(() => null);
        if (body?.plan && Array.isArray(body.plan.tasks)) {
          chartData = body;
        }
      } catch (e) {
        console.warn("[JBv2] Gantt generation failed:", e);
      }

      setData(chartData);
    } finally { setLoading(false); }
  };

  /**
   * Replan using existing skills — used by "Apply & Regenerate" in modal.
   * This guarantees priority/break changes apply to the exact same skill names.
   */
  const replan = async (settings: { priorityOrder?: string[]; breakMonths?: number[]; duration?: string }) => {
    const existingSkills = data?.skillRequirements;
    if (!existingSkills?.length) { load(); return; }
    setLoading(true); setTooltip(null); setTopicsCache({});
    try {
      const body = JSON.stringify({
        skills:        existingSkills,
        priorityOrder: settings.priorityOrder,
        breakMonths:   settings.breakMonths,
        duration:      settings.duration ? Number(settings.duration) : undefined,
      });
      const r = await fetch(`${API}/api/blueprint/role/${enc(roleName)}/gantt/replan`, {
        method: "POST", headers: { "content-type": "application/json" }, body,
      });
      const result = await r.json().catch(() => null);
      if (result) setData((prev: any) => ({ ...prev, skillRequirements: result.skillRequirements, plan: result.plan, customized: true }));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const uid = getOrgAuthFromStorage()?.user?.id || "demo-student-1";
    setUserId(uid);

    // Initial calculation from localStorage to avoid extra fetch if possible,
    // though we still fetch for fresh data.
    try {
      const y = Number(localStorage.getItem("jbv2_expectedGraduationYear") || "");
      const m = Number(localStorage.getItem("jbv2_expectedGraduationMonth") || "");
      if (y && !Number.isNaN(y)) {
        const month = m >= 1 && m <= 12 ? m : 6;
        const now = new Date();
        const grad = new Date(y, month - 1, 1);
        const diff = (grad.getFullYear() - now.getFullYear()) * 12 + (grad.getMonth() - now.getMonth());
        setProfileRemainingMonths(diff <= 0 ? 3 : Math.min(60, diff));
      }
    } catch { /* ignore */ }

    // Load months remaining immediately so the "Plan Months" stat is correct
    // even before the chart/JD APIs return.
    void (async () => {
      try {
        const r = await fetch(`${API}/api/blueprint/remaining-months?userId=${enc(uid)}`);
        const d = await r.json().catch(() => null);
        const months = typeof d?.months === "number" ? d.months : null;
        setProfileRemainingMonths(months);
      } catch {
        setProfileRemainingMonths(null);
      }
      await load(uid);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleName]);

  useEffect(() => {
    if (prep?.isActive) {
      setKnownSkillsSelection(Array.isArray(prep?.knownSkillsForTest) ? prep.knownSkillsForTest : []);
      return;
    }
    setKnownSkillsSelection([]);
  }, [prep?.isActive, prep?.knownSkillsForTest, roleName]);

  /* If graduation year/month is saved on Profile while this page is open,
     the chart should regenerate (only when prep is not locked). */
  const lastProfileUpdateRef = useRef<number>(0);
  useEffect(() => {
    const read = () => {
      try {
        const v = Number(localStorage.getItem("jbv2_profileUpdatedAt") || "0");
        return Number.isFinite(v) ? v : 0;
      } catch {
        return 0;
      }
    };
    lastProfileUpdateRef.current = read();

    const maybeReload = () => {
      const v = read();
      if (!v || v === lastProfileUpdateRef.current) return;
      if (prep?.isActive) return; // keep locked chart unchanged
      lastProfileUpdateRef.current = v;
      load(userId);
    };

    window.addEventListener("focus", maybeReload);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "jbv2_profileUpdatedAt") maybeReload();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", maybeReload);
      window.removeEventListener("storage", onStorage);
    };
  }, [prep?.isActive, userId, roleName]);

  /* fetch contextual JD + skills whenever context changes */
  useEffect(() => {
    if (!ctxIndustry && !ctxEducation && !ctxSpecialization) { setContextualData(null); return; }
    setCtxLoading(true);
    const q = new URLSearchParams();
    if (ctxIndustry)  q.set("industry",  ctxIndustry);
    if (ctxEducation) q.set("education", ctxEducation);
    if (ctxSpecialization) q.set("specialization", ctxSpecialization);
    if (employeeLevel) q.set("level", employeeLevel);
    fetch(`${API}/api/blueprint/role/${enc(roleName)}/contextual?${q.toString()}`, { method: "POST" })
      .then(r => r.json()).catch(() => null)
      .then(d => { setContextualData(d); setCtxLoading(false); });
  }, [roleName, ctxIndustry, ctxEducation, ctxSpecialization, employeeLevel]);

  useEffect(() => {
    const currentLevel = Number(employeeLevel);
    if (!Number.isFinite(currentLevel) || currentLevel <= 1) {
      setPreviousLevelSkills([]);
      setProficiencyDelta([]);
      return;
    }
    const previousLevel = String(currentLevel - 1);
    setSkillCompareLoading(true);
    Promise.all([
      fetch(`${API}/api/blueprint/role/${enc(roleName)}?level=${enc(previousLevel)}`).then((r) => r.json()).catch(() => null),
      fetch(`${API}/api/blueprint/role/${enc(roleName)}/proficiency-delta?level=${enc(employeeLevel)}`).then((r) => r.json()).catch(() => null),
    ])
      .then(([d, delta]) => {
        const reqSkills = Array.isArray(d?.skillRequirements)
          ? d.skillRequirements.map((s: any) => String(s?.skillName || "").trim()).filter(Boolean)
          : [];
        const legacyTech = Array.isArray(d?.skills?.technical) ? d.skills.technical.map((s: any) => String(s || "").trim()).filter(Boolean) : [];
        const legacySoft = Array.isArray(d?.skills?.soft) ? d.skills.soft.map((s: any) => String(s || "").trim()).filter(Boolean) : [];
        setPreviousLevelSkills(Array.from(new Set([...reqSkills, ...legacyTech, ...legacySoft])));
        const items = Array.isArray(delta?.items)
          ? delta.items
              .map((x: any) => ({
                skillName: String(x?.skillName || "").trim(),
                increasePct: Math.max(5, Math.min(70, Number(x?.increasePct) || 0)),
                reason: String(x?.reason || "").trim(),
                previousSkill: String(x?.previousSkill || "").trim(),
              }))
              .filter((x: any) => x.skillName)
              .sort((a: any, b: any) => b.increasePct - a.increasePct)
          : [];
        setProficiencyDelta(items);
      })
      .finally(() => setSkillCompareLoading(false));
  }, [roleName, employeeLevel]);

  /* ── trending jobs insights (Jsearch) ── */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setTrendingLoading(true);
      setTrendingErr("");
      try {
        const q = new URLSearchParams();
        if (ctxIndustry) q.set("industry", ctxIndustry);
        if (ctxEducation) q.set("education", ctxEducation);
        if (ctxSpecialization) q.set("specialization", ctxSpecialization);

        const qs = q.toString();
        const url = `${API}/api/blueprint/role/${enc(roleName)}/trending-jobs${qs ? `?${qs}` : ""}`;
        const r = await fetch(url);
        const d = await r.json().catch(() => null);
        if (cancelled) return;
        setTrendingJobs(d);
      } catch (e: any) {
        if (cancelled) return;
        setTrendingErr(e?.message || "Failed to load trending jobs insights.");
        setTrendingJobs(null);
      } finally {
        if (!cancelled) setTrendingLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [roleName, ctxIndustry, ctxEducation, ctxSpecialization]);

  /* ── topics: background-fetch all tasks as soon as chart arrives ── */
  const fetchTopics = async (task: any) => {
    const key = `${task.name}_${task.start}_${task.end}`;
    const cached = topicsCache[key];
    const cachedHas = cached && typeof cached === "object" && !Array.isArray(cached) && Object.keys(cached).length > 0;
    if (cachedHas) return;
    if (topicsLoading[key]) return;
    setTopicsLoading(p => ({ ...p, [key]:true }));
    try {
      const totalMonthsForReq = data?.plan?.totalMonths || 12;
      let t: any = {};
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(`${API}/api/blueprint/role/${enc(roleName)}/skill/${enc(task.name)}/topics?totalMonths=${totalMonthsForReq}&startMonth=${task.start}&endMonth=${task.end}`);
        t = await r.json().catch(() => ({}));
        const okShape = t && typeof t === "object" && !Array.isArray(t);
        if (okShape && Object.keys(t).length > 0) break;
        // If response is empty, retry once. Some third-party/AI calls may return empty occasionally.
        await new Promise(res => setTimeout(res, 300));
      }
      if (!t || typeof t !== "object" || Array.isArray(t)) t = {};
      setTopicsCache(p => ({ ...p, [key]: t }));
    } finally { setTopicsLoading(p => ({ ...p, [key]:false })); }
  };

  useEffect(() => {
    const tasks: any[] = data?.plan?.tasks || [];
    if (!tasks.length) return;
    tasks.forEach((t, i) => setTimeout(() => fetchTopics(t), i * 100));
  }, [data?.plan?.tasks, data?.plan?.totalMonths, roleName]);

  // If user expands a skill panel but topics weren't loaded (or loaded empty),
  // fetch topics for that skill immediately.
  useEffect(() => {
    const expanded = Object.entries(expandedSkills)
      .filter(([, v]) => !!v)
      .map(([k]) => k);
    if (!expanded.length) return;

    const planTasks: any[] = data?.plan?.tasks || [];
    if (!planTasks.length) return;

    for (const skillName of expanded) {
      const task = planTasks.find(t => t?.name === skillName);
      if (!task) continue;
      const key = `${task.name}_${task.start}_${task.end}`;
      const cached = topicsCache[key];
      const cachedHas = cached && typeof cached === "object" && !Array.isArray(cached) && Object.keys(cached).length > 0;
      if (!cachedHas && !topicsLoading[key]) {
        void fetchTopics(task);
      }
    }
  }, [expandedSkills, data?.plan?.tasks, topicsCache, topicsLoading, roleName]);

  /* ── start / lock preparation ── */
  const startPrep = async () => {
    if (!data?.plan) return;
    setSaving(true);
    // Save the full chart snapshot so it loads identically next time
    const snapshot = { ...data, topicsCache, savedAt: new Date().toISOString() };
    const res = await fetch(`${API}/api/role-preparation/start/${enc(roleName)}?studentId=${enc(userId)}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ganttChartData: snapshot,
        targetStartDate: targetStartDate || undefined,
        targetCompletionDate: targetCompletionDate || undefined,
        employeeLevel: employeeLevel || undefined,
      }),
    });
    setSavedMsg("Preparation locked & saved!"); setTimeout(() => setSavedMsg(""), 3000);
    await load();
    setSaving(false);
  };

  /* ── stop / unlock preparation ── */
  const stopPrep = async () => {
    setSaving(true);
    const res = await fetch(`${API}/api/role-preparation/${enc(roleName)}?studentId=${enc(userId)}`, { method: "DELETE" });
    setSavedMsg("Preparation stopped."); setTimeout(() => setSavedMsg(""), 2500);
    await load();
    setSaving(false);
  };

  const saveKnownSkillsAndStart = async () => {
    setSavingKnownSkills(true);
    setSavedMsg("");
    try {
      const snapshot = data?.plan ? { ...data, topicsCache, savedAt: new Date().toISOString() } : undefined;
      await fetch(
        `${API}/api/role-preparation/known-skills/${enc(roleName)}?studentId=${enc(userId)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            knownSkills: knownSkillsSelection,
            ganttChartData: snapshot,
          }),
        }
      );
      setSavedMsg("Known skills saved. Complete the combined test to unlock preparation start.");
      setTimeout(() => setSavedMsg(""), 3000);
      await load();
    } finally {
      setSavingKnownSkills(false);
    }
  };

  const markUndone = async (skillName:string) => {
    const res = await fetch(`${API}/api/role-preparation/skill/${enc(roleName)}/${enc(skillName)}?studentId=${enc(userId)}&completed=false`, { method:"PUT" });
    await load();
  };

  const startMockInterview = () => {
    if (mockInterviewLaunching) return;
    const auth = getOrgAuthFromStorage();
    const fullName = String(auth?.user?.fullName || "").trim();
    const email = String(auth?.user?.email || "").trim();
    setMockInterviewLaunching(true);
    try {
      const ixUrl = buildInterviewXAiInterviewUrl({
        prefillRole: roleName,
        candidateEmail: email,
        candidateName: fullName,
      });
      if (typeof window !== "undefined") window.location.assign(ixUrl);
    } finally {
      setTimeout(() => setMockInterviewLaunching(false), 700);
    }
  };

  const toggleTopicDone = async (skillName: string, month: number, topicIndex: number, completed: boolean) => {
    const res = await fetch(
      `${API}/api/role-preparation/subtopic/${enc(roleName)}/${enc(skillName)}?studentId=${enc(userId)}&month=${month}&topicIndex=${topicIndex}&completed=${completed}`,
      { method: "PUT" }
    );
    setPrep((prev: any) => {
      if (!prev) return prev;
      const next = { ...prev, skillProgress: { ...(prev.skillProgress || {}) } };
      const old = next.skillProgress[skillName] || { completed: false, subtopicCompletion: {} };
      const st = { ...(old.subtopicCompletion || {}) };
      st[`month_${month}_topic_${topicIndex}`] = completed;
      next.skillProgress[skillName] = { ...old, subtopicCompletion: st };
      return next;
    });
  };

  /* ── cell hover → show tooltip ── */
  const showTooltip = (e: React.MouseEvent<HTMLTableCellElement>, task: any, mn: number, color: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const above = rect.bottom + 260 > window.innerHeight;
    setTooltip({
      x: rect.left + rect.width / 2,
      y: above ? rect.top - 12 : rect.bottom + 12,
      above,
      skillName: task.name,
      month: mn,
      color,
      topKey: `${task.name}_${task.start}_${task.end}`,
      taskStart: task.start,
      taskEnd: task.end,
      taskType: task.type,
      taskDiff: task.difficulty
    });
  };

  /* ── derived ──
     If contextualData is ready, use it for JD + skills; use base data for Gantt.
     baseRole fills JD/skills when prep snapshot or AI chart payload omits them. */
  const activeData     = contextualData || data;   // contextual overrides JD/skills
  const tasks: any[]      = data?.plan?.tasks || [];
  const totalMonths =
    loading
      ? (profileRemainingMonths ?? data?.plan?.totalMonths ?? 12)
      : (data?.plan?.totalMonths ?? profileRemainingMonths ?? 12);
  const planBreakMonths   = useMemo(() => new Set<number>(data?.plan?.breakMonths || []), [data?.plan?.breakMonths]);
  const completedCount = prep ? Object.values(prep.skillProgress||{}).filter((v:any)=>v?.completed).length : 0;
  const totalCount     = tasks.length;
  const pct            = totalCount ? Math.round((completedCount/totalCount)*100) : 0;
  const mockInterviewEligible = true;

  const { techSkills, softSkills } = useMemo(() => {
    const extract = (r: any) => {
      const t = r?.skills?.technical;
      const s = r?.skills?.soft;
      if (Array.isArray(t) || Array.isArray(s)) {
        return {
          tech: (Array.isArray(t) ? t : []) as string[],
          soft: (Array.isArray(s) ? s : []) as string[],
        };
      }
      const reqs = r?.skillRequirements || [];
      return {
        tech: reqs.filter((x: any) => (x.skillType || "").toLowerCase() === "technical").map((x: any) => x.skillName).filter(Boolean),
        soft: reqs.filter((x: any) => {
          const st = (x.skillType || "").toLowerCase();
          return st === "non-technical" || st.includes("soft");
        }).map((x: any) => x.skillName).filter(Boolean),
      };
    };
    let tech: string[] = [];
    let soft: string[] = [];
    for (const r of [contextualData, data, baseRole]) {
      if (!r) continue;
      const { tech: t, soft: s } = extract(r);
      if (!tech.length && t.length) tech = t;
      if (!soft.length && s.length) soft = s;
      if (tech.length && soft.length) break;
    }
    return { techSkills: tech, softSkills: soft };
  }, [contextualData, data, baseRole]);

  const mergedJobDescription = useMemo(() => {
    return (
      contextualData?.jobDescription ||
      data?.jobDescription ||
      baseRole?.jobDescription ||
      null
    );
  }, [contextualData, data, baseRole]);

  const allRoleSkillNames = useMemo<string[]>(() => {
    const fromReq =
      (activeData?.skillRequirements || data?.skillRequirements || baseRole?.skillRequirements || [])
        .map((s: any) => String(s?.skillName || "").trim())
        .filter((x: string): x is string => Boolean(x));
    return Array.from(new Set(fromReq));
  }, [activeData?.skillRequirements, data?.skillRequirements, baseRole?.skillRequirements]);

  const previousSkillKeySet = useMemo(() => {
    const out = new Set<string>();
    for (const s of previousLevelSkills) out.add(String(s || "").trim().toLowerCase());
    for (const p of proficiencyDelta) out.add(String(p?.skillName || "").trim().toLowerCase());
    for (const p of proficiencyDelta) out.add(String(p?.previousSkill || "").trim().toLowerCase());
    return out;
  }, [previousLevelSkills, proficiencyDelta]);

  const previousComparableSkills = useMemo(() => {
    const out = new Set<string>();
    for (const s of previousLevelSkills) out.add(String(s || "").trim());
    for (const p of proficiencyDelta) {
      if (p?.skillName) out.add(String(p.skillName).trim());
      if (p?.previousSkill) out.add(String(p.previousSkill).trim());
    }
    return Array.from(out).filter(Boolean);
  }, [previousLevelSkills, proficiencyDelta]);

  const isSkillCommonWithPrevious = (skill: string) => {
    const key = String(skill || "").trim().toLowerCase();
    if (!key) return false;
    if (previousSkillKeySet.has(key)) return true;
    return previousComparableSkills.some((prevSkill) => skillsAreSimilar(skill, prevSkill));
  };

  const knownSkillsSet = new Set<string>((knownSkillsSelection || []).map((s) => String(s)));
  const testQueueSkills: string[] = Array.isArray(prep?.knownSkillsForTest) ? prep.knownSkillsForTest : [];
  const passedKnownSkills: string[] = Array.isArray(prep?.passedKnownSkills) ? prep.passedKnownSkills : [];
  const knownSkillsTestSubmitted = !!prep?.knownSkillsTestSubmitted;
  const canActivatePreparation = testQueueSkills.length === 0 || knownSkillsTestSubmitted;

  /* Build skill-requirement cards directly from Gantt tasks (source of truth).
     Augment with prerequisites / description from skillRequirements where names match.
     This avoids name-mismatch issues when generated skills vary. */
  const chartSkillReqs = useMemo(() => {
    if (!tasks.length) return [];
    // build lookup by skill name from contextual (preferred) or base DB data
    const reqMap = new Map<string, any>();
    for (const s of (contextualData?.skillRequirements || data?.skillRequirements || [])) {
      if (s.skillName) reqMap.set(s.skillName, s);
    }
    return tasks.map((t: any) => {
      const matched = reqMap.get(t.name);
      return {
        skillName:          t.name,
        skillType:          t.type,
        timeRequiredMonths: t.timeRequired ?? (t.end - t.start + 1),
        difficulty:         t.difficulty   || matched?.difficulty   || "intermediate",
        importance:         t.importance   || matched?.importance   || "Important",
        description:        t.description  || matched?.description  || "",
        prerequisites:      matched?.prerequisites || [],
        isOptional:         t.isOptional   ?? matched?.isOptional   ?? false,
      };
    });
  }, [tasks, contextualData?.skillRequirements, data?.skillRequirements]);

  const taskKeyBySkill = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of tasks) m[t.name] = `${t.name}_${t.start}_${t.end}`;
    return m;
  }, [tasks]);

  const topicStats = (skillName: string) => {
    const key = taskKeyBySkill[skillName];
    const topicByMonth = (key && topicsCache[key]) ? topicsCache[key] : {};
    const subDone = prep?.skillProgress?.[skillName]?.subtopicCompletion || {};
    const skillCompleted = !!prep?.skillProgress?.[skillName]?.completed;
    if (skillCompleted) {
      return { total: 1, done: 1, pct: 100, key, topicByMonth };
    }
    let total = 0;
    let done = 0;
    for (const [month, arr] of Object.entries(topicByMonth)) {
      const topics = Array.isArray(arr) ? arr : [];
      topics.forEach((_, i) => {
        total++;
        if (subDone[`month_${month}_topic_${i}`]) done++;
      });
    }
    const pct = total ? Math.round((done * 100) / total) : 0;
    return { total, done, pct, key, topicByMonth };
  };

  /* hydration-safe month labels */
  const labels = useMemo(() => {
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return Array.from({ length: totalMonths }, (_, i) => {
      if (!mounted) return { short:`M${i+1}`, year:"" };
      const now = new Date();
      const t = new Date(now.getFullYear(), now.getMonth() + i);
      return { short: names[t.getMonth()], year: String(t.getFullYear()) };
    });
  }, [totalMonths, mounted]);

  /* tooltip content lookup */
  const tooltipMonthTopics: string[] | null = tooltip
    ? (topicsCache[tooltip.topKey]?.[tooltip.month] ?? null)
    : null;
  const tooltipIsLoading = tooltip ? !!topicsLoading[tooltip.topKey] : false;
  const showSkillSelectionOnly = !prep?.knownSkillsConfigured;
  const waitForSkillComparison = Number(employeeLevel) > 1 && skillCompareLoading;

  if (showSkillSelectionOnly) {
    return (
      <div style={{ maxWidth: 1200 }}>
        <p style={{ color:"#64748b", fontSize:13, marginBottom:14 }}>
          <Link href="/" style={{ color:"#3b82f6" }}>Home</Link> {" › "}
          {ctxIndustry && <><Link href={`/industry/${enc(ctxIndustry)}`} style={{ color:"#3b82f6" }}>{ctxIndustry}</Link>{" › "}</>}
          {ctxEducation && <><Link href={`/education/${enc(ctxEducation)}${ctxIndustry?`?industry=${enc(ctxIndustry)}`:""}`} style={{ color:"#3b82f6" }}>{ctxEducation}</Link>{" › "}</>}
          {!ctxIndustry && !ctxEducation && <><Link href="/role" style={{ color:"#3b82f6" }}>Roles</Link>{" › "}</>}
          {roleName}
        </p>

        <div style={{
          background:"linear-gradient(135deg, #0F1724 0%, #0F2B43 55%, #2C6099 100%)",
          borderRadius:12, padding:"24px 28px", marginBottom:16,
          boxShadow:"0 8px 32px rgba(15,23,36,.35)"
        }}>
          <h1 style={{ margin:0, fontSize:28, fontWeight:900, color:"white", letterSpacing:"-.5px" }}>{roleName}</h1>
          <p style={{ margin:"8px 0 0", color:"rgba(255,255,255,.78)", fontSize:14 }}>
            Step 1: select skills you already know. Step 2: take one combined test. Then start preparation.
          </p>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`/role/${enc(roleName)}/analytics`} style={{ textDecoration: "none" }}>
              <button style={{ ...btn("white","rgba(255,255,255,.1)","rgba(255,255,255,.25)"), fontSize:13 }}>📊 Analytics</button>
            </Link>
            <button
              onClick={startMockInterview}
              disabled={!mockInterviewEligible || mockInterviewLaunching}
              title={
                mockInterviewEligible
                  ? "Start InterviewX technical mock interview directly"
                  : "Complete all target-role skills to unlock mock interview"
              }
              style={{
                ...btn(
                  "white",
                  mockInterviewEligible ? "rgba(20,184,166,.28)" : "rgba(148,163,184,.24)",
                  mockInterviewEligible ? "rgba(45,212,191,.7)" : "rgba(148,163,184,.4)"
                ),
                fontSize: 13,
                opacity: mockInterviewEligible ? 1 : 0.65,
                cursor: mockInterviewEligible ? "pointer" : "not-allowed",
              }}
            >
              {mockInterviewLaunching ? "Opening..." : "🎤 Mock Interview"}
            </button>
          </div>
        </div>

        {waitForSkillComparison && (
          <div style={{ ...card, marginBottom: 16, borderLeft: "4px solid #3170A5" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "#0F1724" }}>Step 2: Skills you already know</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
              Comparing with previous level… Please wait.
            </p>
          </div>
        )}
        {allRoleSkillNames.length > 0 && !waitForSkillComparison && (
          <div style={{ ...card, marginBottom: 16, borderLeft: "4px solid #3170A5" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "#0F1724" }}>Step 2: Skills you already know</h3>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>
              Select skills you already know. These move to the test section and are removed from the learning blueprint for now.
            </p>
            {proficiencyDelta.length > 0 && (
              <div style={{ marginBottom: 12, border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#1e3a8a", marginBottom: 8 }}>
                  AI estimated proficiency growth vs Level {Number(employeeLevel) - 1}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {proficiencyDelta.slice(0, 8).map((p) => (
                    <div key={p.skillName}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                        <span style={{ color: "#0f172a", fontWeight: 700 }}>{p.skillName}</span>
                        <span style={{ color: "#1e40af", fontWeight: 800 }}>+{p.increasePct}%</span>
                      </div>
                      <div style={{ height: 6, background: "#e2e8f0", borderRadius: 999, overflow: "hidden", marginTop: 4 }}>
                        <div style={{ width: `${p.increasePct}%`, height: "100%", background: "linear-gradient(90deg,#22c55e,#3b82f6)" }} />
                      </div>
                      {p.reason ? <div style={{ marginTop: 3, fontSize: 11, color: "#64748b" }}>{p.reason}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Number(employeeLevel) > 1 && (
              <div style={{ margin: "0 0 10px", fontSize: 12, color: "#475569", display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={{ background: "#ECFDF5", border: "1px solid #86EFAC", borderRadius: 999, padding: "4px 10px", fontWeight: 700, color: "#166534" }}>
                  Common with Level {Number(employeeLevel) - 1}
                </span>
                <span style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 999, padding: "4px 10px", fontWeight: 700, color: "#9A3412" }}>
                  New at Level {employeeLevel}
                </span>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginBottom: 12 }}>
              {allRoleSkillNames.map((skill) => {
                const checked = knownSkillsSet.has(skill);
                const isCommon = isSkillCommonWithPrevious(skill);
                const baseBg = isCommon ? "#ECFDF5" : "#FFF7ED";
                const baseBorder = isCommon ? "#86EFAC" : "#FDBA74";
                return (
                  <label key={skill} style={{ display: "flex", gap: 8, alignItems: "center", border: `1px solid ${checked ? "#93C5FD" : baseBorder}`, borderRadius: 8, padding: "8px 10px", background: checked ? "#EFF6FF" : baseBg }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setKnownSkillsSelection((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(skill);
                          else next.delete(skill);
                          return Array.from(next);
                        });
                      }}
                    />
                    <span style={{ fontSize: 13, color: "#0f172a" }}>{skill}</span>
                  </label>
                );
              })}
            </div>
            <button
              onClick={saveKnownSkillsAndStart}
              disabled={savingKnownSkills}
              style={{ ...btn("white", "#3170A5", "#3170A5"), border: "none" as any }}
            >
              {savingKnownSkills ? "Saving..." : "Save Skills & Open Blueprint"}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ══ RENDER ═══════════════════════════════════════════════ */
  return (
    <div style={{ maxWidth:1200 }}>

      {/* hover-tooltip — fixed overlay, pointer-events:none */}
      {tooltip && (
        <div style={{
          position:"fixed",
          left: tooltip.x,
          top:  tooltip.y,
          transform: tooltip.above ? "translate(-50%,-100%)" : "translateX(-50%)",
          zIndex:9999,
          pointerEvents:"none",
          minWidth:240, maxWidth:360,
          background:"white",
          border:`2px solid ${tooltip.color}40`,
          borderRadius:14,
          boxShadow:`0 12px 40px rgba(0,0,0,.18), 0 0 0 1px ${tooltip.color}20`,
          overflow:"hidden"
        }}>
          {/* tooltip header */}
          <div style={{ background:tooltip.color, padding:"10px 14px" }}>
            <div style={{ fontWeight:800, fontSize:13, color:"white" }}>{tooltip.skillName}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.8)", marginTop:2 }}>
              Month {tooltip.month} of {tooltip.taskEnd} &nbsp;·&nbsp;
              {tooltip.taskType === "non-technical" ? "🎯 Soft Skill" : "💻 Technical"}
              &nbsp;·&nbsp;{tooltip.taskDiff}
            </div>
          </div>
          {/* tooltip body — pointer-events:auto so prep links work */}
          <div style={{ padding:"10px 14px", pointerEvents:"auto" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#3170A5", textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>
              📚 Learning Topics — Month {tooltip.month}
            </div>
            <p style={{ margin:"0 0 6px", fontSize:10, color:"#94a3b8", lineHeight:1.4 }}>
              Open Resources for this topic: web search, videos, articles, books, and papers (not tied to your role).
            </p>
            {tooltipIsLoading && (
              <div style={{ display:"flex", alignItems:"center", gap:7, color:"#94a3b8", fontSize:12 }}>
                <span style={{ width:12, height:12, border:"2px solid #e9d5ff", borderTop:`2px solid ${tooltip.color}`, borderRadius:"50%", animation:"spin 1s linear infinite", display:"inline-block", flexShrink:0 }}/>
                Generating topics…
              </div>
            )}
            {!tooltipIsLoading && tooltipMonthTopics && tooltipMonthTopics.length > 0 ? (
              <ul style={{ margin:0, paddingLeft:0, listStyle:"none" }}>
                {tooltipMonthTopics.map((t,i) => (
                  <li
                    key={i}
                    style={{
                      fontSize:12,
                      color:"#374151",
                      lineHeight:1.5,
                      marginBottom:8,
                      paddingBottom:6,
                      borderBottom: i < tooltipMonthTopics.length - 1 ? "1px solid #f1f5f9" : "none",
                    }}
                  >
                    <div style={{ display:"flex", alignItems:"flex-start", gap:8, flexWrap:"nowrap", justifyContent:"space-between", width:"100%" }}>
                      <span style={{ flex:1, minWidth:0, paddingRight:6 }}>{t}</span>
                      <TopicResourcesButton topic={t} compact />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (!tooltipIsLoading && (
              <p style={{ margin:0, fontSize:12, color:"#94a3b8" }}>
                {Object.keys(topicsCache[tooltip.topKey]||{}).length > 0
                  ? "No topics for this specific month."
                  : "Hover again after topics load…"}
              </p>
            ))}
          </div>
          {/* caret */}
          <div style={{
            position:"absolute", left:"50%", transform:"translateX(-50%)",
            ...(tooltip.above
              ? { bottom:-8, borderLeft:"8px solid transparent", borderRight:"8px solid transparent", borderTop:`8px solid ${tooltip.color}40`, width:0, height:0 }
              : { top:-8,    borderLeft:"8px solid transparent", borderRight:"8px solid transparent", borderBottom:`8px solid ${tooltip.color}`, width:0, height:0 })
          }}/>
        </div>
      )}

      {/* breadcrumb */}
      <p style={{ color:"#64748b", fontSize:13, marginBottom:14 }}>
        <Link href="/" style={{ color:"#3b82f6" }}>Home</Link> {" › "}
        {ctxIndustry && <><Link href={`/industry/${enc(ctxIndustry)}`} style={{ color:"#3b82f6" }}>{ctxIndustry}</Link>{" › "}</>}
        {ctxEducation && <><Link href={`/education/${enc(ctxEducation)}${ctxIndustry?`?industry=${enc(ctxIndustry)}`:""}`} style={{ color:"#3b82f6" }}>{ctxEducation}</Link>{" › "}</>}
        {!ctxIndustry && !ctxEducation && <><Link href={`/role${isRecommendMode ? `?recommendFor=${enc(recommendFor)}${recommendName?`&recommendName=${enc(recommendName)}`:""}${recommendEmail?`&recommendEmail=${enc(recommendEmail)}`:""}${recommendDept?`&recommendDept=${enc(recommendDept)}`:""}` : ""}`} style={{ color:"#3b82f6" }}>Roles</Link>{" › "}</>}
        {roleName}
      </p>

      {/* ── RECOMMEND-MODE BANNER (manager flow) ──────────────── */}
      {isRecommendMode && (
        <div style={{
          background:"linear-gradient(135deg, #ede9fe 0%, #fae8ff 100%)",
          border:"1px solid rgba(124,58,237,0.35)",
          borderRadius:14, padding:"18px 22px", marginBottom:18,
          boxShadow:"0 6px 24px -14px rgba(124,58,237,0.55)",
        }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:14, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:260 }}>
              <div style={{ fontSize:11, fontWeight:800, color:"#6d28d9", textTransform:"uppercase", letterSpacing:".12em", marginBottom:4 }}>
                Recommend a role
              </div>
              <div style={{ fontSize:18, fontWeight:900, color:"#0B1723", lineHeight:1.3 }}>
                Recommend <span style={{ color:"#7c3aed" }}>{roleName}</span>
                {recommendName ? <> to <span style={{ color:"#7c3aed" }}>{recommendName}</span></> : null}
                ?
              </div>
              <p style={{ margin:"6px 0 0", fontSize:13, color:"#475569" }}>
                Review the job description below, optionally add a note, and send the recommendation.
                {recommendName ? <> {recommendName} will see it as a notification on their portal.</> : null}
              </p>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={recommendSending}
                style={{
                  background:"white", border:"1px solid rgba(124,58,237,0.35)",
                  color:"#5b21b6", fontWeight:700, fontSize:13,
                  padding:"9px 16px", borderRadius:10, cursor:recommendSending?"not-allowed":"pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRecommendation}
                disabled={recommendSending}
                style={{
                  background:"linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)",
                  color:"white", border:"none", fontWeight:900, fontSize:14,
                  padding:"10px 20px", borderRadius:10,
                  cursor:recommendSending?"not-allowed":"pointer",
                  boxShadow:"0 8px 22px -10px rgba(124,58,237,0.7)",
                  display:"inline-flex", alignItems:"center", gap:8,
                  opacity:recommendSending?0.7:1,
                }}
              >
                {recommendSending ? "Sending…" : <>💡 Recommend this role</>}
              </button>
            </div>
          </div>

          <div style={{ marginTop:14 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:800, color:"#5b21b6", textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>
              Note (optional)
            </label>
            <textarea
              value={recommendNote}
              onChange={(e) => setRecommendNote(e.target.value)}
              placeholder={`Add a short message for ${recommendName || "the employee"} (e.g. "I think this fits your skillset — give it a look!")`}
              maxLength={500}
              rows={2}
              style={{
                width:"100%", boxSizing:"border-box",
                border:"1px solid rgba(124,58,237,0.25)", borderRadius:10,
                padding:"10px 12px", fontSize:13, fontFamily:"inherit",
                resize:"vertical", background:"white", color:"#0B1723",
                outline:"none",
              }}
            />
          </div>

          {recommendError ? (
            <p style={{ margin:"10px 0 0", fontSize:12, color:"#b91c1c", fontWeight:700 }}>
              ⚠ {recommendError}
            </p>
          ) : null}
        </div>
      )}

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div style={{
        background:"linear-gradient(135deg, #0F1724 0%, #0F2B43 55%, #2C6099 100%)",
        borderRadius:12, padding:"32px 36px", marginBottom:20,
        boxShadow:"0 8px 32px rgba(15,23,36,.35)", position:"relative", overflow:"hidden"
      }}>
        <div style={{ position:"absolute",top:-80,right:-80,width:280,height:280,background:"rgba(49,112,165,.15)",borderRadius:"50%",filter:"blur(60px)" }}/>
        <div style={{ position:"absolute",bottom:-40,left:60,width:160,height:160,background:"rgba(255,255,255,.04)",borderRadius:"50%",filter:"blur(30px)" }}/>
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
            <div style={{ flex:1, minWidth:280 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,.55)", textTransform:"uppercase", letterSpacing:".1em", marginBottom:6 }}>Role</div>
              <h1 style={{ margin:0, fontSize:34, fontWeight:900, color:"white", letterSpacing:"-1px", lineHeight:1.1 }}>{roleName}</h1>
              {(ctxIndustry || ctxEducation || ctxSpecialization) && (
                <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.2)", borderRadius:999, padding:"5px 14px", fontSize:12, fontWeight:700, color:"white", marginTop:10 }}>
                  🎯 {[ctxIndustry, ctxEducation, ctxSpecialization].filter(Boolean).join(" · ")}
                </div>
              )}
              <p style={{ margin:"10px 0 0", color:"rgba(255,255,255,.75)", fontSize:14, maxWidth:600, lineHeight:1.6 }}>
                {activeData?.description || activeData?.jobDescription?.summary || data?.description || baseRole?.description || baseRole?.jobDescription?.summary || "Career blueprint and personalised learning roadmap for this role."}
              </p>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end" }}>
              {prep?.isActive ? (
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end" }}>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(34,197,94,.2)", border:"1px solid rgba(134,239,172,.4)", borderRadius:8, padding:"9px 16px", fontSize:13, fontWeight:800, color:"#bbf7d0" }}>
                    🔒 Preparation Active
                  </span>
                  <button style={{ ...btn("rgba(255,255,255,.8)","rgba(255,255,255,.08)","rgba(255,255,255,.2)"), fontSize:12 }} onClick={stopPrep} disabled={saving}>
                    {saving ? "…" : "✕ Stop"}
                  </button>
                </div>
              ) : (
                <button
                  style={{ background:"#3170A5", border:"none", color:"white", fontWeight:800, fontSize:14, padding:"11px 24px", borderRadius:8, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8, boxShadow:"0 4px 14px rgba(49,112,165,.5)", transition:"opacity .15s" }}
                  onClick={startPrep}
                  disabled={saving || !data?.plan || !canActivatePreparation}
                  title={
                    !data?.plan
                      ? "Wait for chart to load"
                      : !canActivatePreparation
                      ? "Submit the combined known-skills test first"
                      : "Lock this chart and start tracking progress"
                  }
                >
                  {saving ? "Saving…" : "▶ Start Preparation"}
                </button>
              )}
              <Link href={`/role/${enc(roleName)}/analytics`} style={{ textDecoration:"none" }}>
                <button style={{ ...btn("white","rgba(255,255,255,.1)","rgba(255,255,255,.25)"), fontSize:13 }}>📊 Analytics</button>
              </Link>
              <button
                onClick={startMockInterview}
                disabled={!mockInterviewEligible || mockInterviewLaunching}
                title={
                  mockInterviewEligible
                    ? "Start InterviewX technical mock interview directly"
                    : "Complete all target-role skills to unlock mock interview"
                }
                style={{
                  ...btn(
                    "white",
                    mockInterviewEligible ? "rgba(20,184,166,.28)" : "rgba(148,163,184,.24)",
                    mockInterviewEligible ? "rgba(45,212,191,.7)" : "rgba(148,163,184,.4)"
                  ),
                  fontSize: 13,
                  opacity: mockInterviewEligible ? 1 : 0.65,
                  cursor: mockInterviewEligible ? "pointer" : "not-allowed",
                }}
              >
                {mockInterviewLaunching ? "Opening..." : "🎤 Mock Interview"}
              </button>
            </div>
          </div>
          {savedMsg && <p style={{ marginTop:10, color:"#bbf7d0", fontWeight:600 }}>{savedMsg}</p>}
          {((mappings?.industries||[]).length > 0 || (mappings?.educations||[]).length > 0) && (
            <div style={{ marginTop:16, display:"flex", gap:6, flexWrap:"wrap" }}>
              {(mappings?.industries||[]).map((i:string) => (
                <span key={i} style={{ background:"rgba(255,255,255,.12)", color:"rgba(255,255,255,.9)", borderRadius:999, padding:"4px 12px", fontSize:12, fontWeight:600, border:"1px solid rgba(255,255,255,.15)" }}>🏭 {i}</span>
              ))}
              {(mappings?.educations||[]).map((e:string) => (
                <span key={e} style={{ background:"rgba(255,255,255,.12)", color:"rgba(255,255,255,.9)", borderRadius:999, padding:"4px 12px", fontSize:12, fontWeight:600, border:"1px solid rgba(255,255,255,.15)" }}>🎓 {e}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CONTEXTUAL BANNER ─────────────────────────────── */}
      {(ctxIndustry || ctxEducation || ctxSpecialization) && (
        <div style={{ background:"linear-gradient(90deg,#EFF6FF,#F0F9FF)", border:"1px solid #BAE6FD", borderRadius:10, padding:"12px 18px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>{ctxLoading ? "⏳" : "🤖"}</span>
            <div>
              <p style={{ margin:0, fontWeight:800, fontSize:14, color:"#0F1724" }}>
                {ctxLoading ? "Generating contextual profile…" : "Personalised for your context"}
              </p>
              <p style={{ margin:"2px 0 0", fontSize:12, color:"#64748b" }}>
                {ctxLoading
                  ? `Tailoring JD and skills for ${roleName} in ${[ctxIndustry, ctxEducation, ctxSpecialization].filter(Boolean).join(" · ")}…`
                  : `Job description and skills are customised for ${roleName} in ${[ctxIndustry, ctxEducation, ctxSpecialization].filter(Boolean).join(" · ")}`
                }
              </p>
            </div>
          </div>
          <Link href={`/role/${enc(roleName)}`} style={{ textDecoration:"none", fontSize:12, fontWeight:700, color:"#3170A5", background:"white", border:"1px solid #BAE6FD", borderRadius:8, padding:"6px 14px", whiteSpace:"nowrap" }}>
            ✕ Clear context
          </Link>
        </div>
      )}

      {(!prep?.knownSkillsConfigured) && waitForSkillComparison && (
        <div style={{ ...card, marginBottom: 16, borderLeft: "4px solid #3170A5" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "#0F1724" }}>Step 2: Skills you already know</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Comparing with previous level… Please wait.
          </p>
        </div>
      )}

      {(!prep?.knownSkillsConfigured) && allRoleSkillNames.length > 0 && !waitForSkillComparison && (
        <div style={{ ...card, marginBottom: 16, borderLeft: "4px solid #3170A5" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "#0F1724" }}>Step 2: Skills you already know</h3>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>
            Select skills you already know. These move to the test section and are removed from the learning blueprint for now.
          </p>
          {proficiencyDelta.length > 0 && (
            <div style={{ marginBottom: 12, border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#1e3a8a", marginBottom: 8 }}>
                AI estimated proficiency growth vs Level {Number(employeeLevel) - 1}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {proficiencyDelta.slice(0, 8).map((p) => (
                  <div key={p.skillName}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                      <span style={{ color: "#0f172a", fontWeight: 700 }}>{p.skillName}</span>
                      <span style={{ color: "#1e40af", fontWeight: 800 }}>+{p.increasePct}%</span>
                    </div>
                    <div style={{ height: 6, background: "#e2e8f0", borderRadius: 999, overflow: "hidden", marginTop: 4 }}>
                      <div style={{ width: `${p.increasePct}%`, height: "100%", background: "linear-gradient(90deg,#22c55e,#3b82f6)" }} />
                    </div>
                    {p.reason ? <div style={{ marginTop: 3, fontSize: 11, color: "#64748b" }}>{p.reason}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          )}
          {Number(employeeLevel) > 1 && (
            <div style={{ margin: "0 0 10px", fontSize: 12, color: "#475569", display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ background: "#ECFDF5", border: "1px solid #86EFAC", borderRadius: 999, padding: "4px 10px", fontWeight: 700, color: "#166534" }}>
                Common with Level {Number(employeeLevel) - 1}
              </span>
              <span style={{ background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 999, padding: "4px 10px", fontWeight: 700, color: "#9A3412" }}>
                New at Level {employeeLevel}
              </span>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginBottom: 12 }}>
            {allRoleSkillNames.map((skill) => {
              const checked = knownSkillsSet.has(skill);
              const isCommon = isSkillCommonWithPrevious(skill);
              const baseBg = isCommon ? "#ECFDF5" : "#FFF7ED";
              const baseBorder = isCommon ? "#86EFAC" : "#FDBA74";
              return (
                <label key={skill} style={{ display: "flex", gap: 8, alignItems: "center", border: `1px solid ${checked ? "#93C5FD" : baseBorder}`, borderRadius: 8, padding: "8px 10px", background: checked ? "#EFF6FF" : baseBg }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setKnownSkillsSelection((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(skill);
                        else next.delete(skill);
                        return Array.from(next);
                      });
                    }}
                  />
                  <span style={{ fontSize: 13, color: "#0f172a" }}>{skill}</span>
                </label>
              );
            })}
          </div>
          <button
            onClick={saveKnownSkillsAndStart}
            disabled={savingKnownSkills}
            style={{ ...btn("white", "#3170A5", "#3170A5"), border: "none" as any }}
          >
            {savingKnownSkills ? "Saving..." : "Save Skills & Continue"}
          </button>
        </div>
      )}

      {/* ── STATS ─────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10, marginBottom:20 }}>
        {[
          { label:"Total Skills", val:tasks.length||data?.skillRequirements?.length||"–", accent:"#3170A5" },
          { label:"Completed",    val:completedCount, accent:"#15614B" },
          { label:"Remaining",    val:Math.max(0,totalCount-completedCount), accent:"#0F2B43" },
          { label:"Readiness",    val:`${pct}%`, accent:"#0EA5E9" },
          {
            label:"Plan Months",
            val: (!loading && typeof data?.plan?.totalMonths === "number")
              ? data.plan.totalMonths
              : "–",
            accent:"#2C6099"
          },
          { label:"Leftover",    val:data?.plan?.leftoverMonths ?? "–", accent:"#64748b" },
        ].map(s => (
          <div key={s.label} style={{ background:"white", borderRadius:10, border:"1px solid rgba(0,0,0,.08)", padding:"18px 16px", textAlign:"center", boxShadow:"0 1px 4px rgba(0,0,0,.05)", borderTop:`3px solid ${s.accent}` }}>
            <div style={{ fontSize:26, fontWeight:900, color:s.accent, lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:12, color:"#64748b", marginTop:5, fontWeight:600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {prep?.knownSkillsConfigured && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ ...card, borderTop: "3px solid #2563EB" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "#0F1724" }}>🧠 Combined Test Section</h3>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#64748b" }}>
              One medium-hard test is generated with 5 questions per selected skill. Passing is evaluated per skill at 80%.
            </p>
            {testQueueSkills.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>No known skills selected for test.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ border: "1px solid #dbeafe", borderRadius: 8, padding: "10px", background: "#EFF6FF" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#1e3a8a", fontWeight: 700 }}>
                    Included skills: {testQueueSkills.join(", ")}
                  </p>
                  <Link href={`/role/${enc(roleName)}/test/known-skills`} style={{ textDecoration: "none" }}>
                    <div style={{ border: "1px solid #93c5fd", borderRadius: 8, padding: "9px 10px", color: "#1e3a8a", fontWeight: 800, background: "white", textAlign: "center" }}>
                      {knownSkillsTestSubmitted ? "Retake Combined Test" : "Take Combined Test"}
                    </div>
                  </Link>
                </div>
              </div>
            )}
            <Link href={`/role/${enc(roleName)}/report`} style={{ textDecoration: "none" }}>
              <div style={{ marginTop: 10, border: "1px solid #bae6fd", borderRadius: 8, padding: "8px 10px", color: "#0c4a6e", fontWeight: 700, background: "#f0f9ff", textAlign: "center" }}>
                📄 View Detailed Test Report
              </div>
            </Link>
            {!canActivatePreparation && (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "#b45309" }}>
                Submit this combined test to unlock Start Preparation.
              </p>
            )}
          </div>
          <div style={{ ...card, borderTop: "3px solid #16A34A" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 15, color: "#0F1724" }}>🏆 Completed (Badges)</h3>
            {passedKnownSkills.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>No skill badges earned yet.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {passedKnownSkills.map((skill) => (
                  <span key={skill} style={{ ...pill("#ECFDF5", "#166534"), fontSize: 12 }}>🏅 {skill}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── JOB DESCRIPTION + SKILLS ─────────────────────────── */}
      {(mergedJobDescription || techSkills.length > 0 || softSkills.length > 0) && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
          {mergedJobDescription && (() => {
            const jd = mergedJobDescription;
            const isCtx = !!(ctxIndustry || ctxEducation) && !!contextualData?.jobDescription;
            return (
            <div style={{ background:"white", borderRadius:10, border:"1px solid rgba(0,0,0,.1)", padding:"20px 22px", boxShadow:"0 1px 4px rgba(0,0,0,.05)", borderTop:`3px solid ${isCtx ? "#3170A5" : "#2C6099"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <h3 style={{ margin:0, color:"#0F1724", fontSize:16, fontWeight:800 }}>📋 Job Description</h3>
                {isCtx && (
                  <span style={{ fontSize:10, fontWeight:800, background:"#EFF6FF", color:"#1e40af", borderRadius:999, padding:"3px 9px", letterSpacing:".04em" }}>
                    Contextual
                  </span>
                )}
              </div>
              {(["summary","industry","responsibilities","requirements","expectedSalary"] as const).map(k =>
                (jd as any)[k] ? (
                  <div key={k} style={{ marginBottom:10, paddingBottom:10, borderBottom:"1px solid #F1F5F9" }}>
                    <div style={{ fontWeight:700, fontSize:11, color:"#98A0B2", textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>{k === "expectedSalary" ? "Salary" : k}</div>
                    <div style={{ fontSize:13, color:"#0F1724", lineHeight:1.5 }}>{(jd as any)[k]}</div>
                  </div>
                ) : null
              )}
            </div>
          );
          })()}
          {(techSkills.length > 0 || softSkills.length > 0) && (() => {
            const isCtxSkills = !!(ctxIndustry || ctxEducation) && !!contextualData?.skillRequirements?.length;
            return (
            <div style={{ background:"white", borderRadius:10, border:"1px solid rgba(0,0,0,.1)", padding:"20px 22px", boxShadow:"0 1px 4px rgba(0,0,0,.05)", borderTop:`3px solid ${isCtxSkills ? "#0EA5E9" : "#3170A5"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <h3 style={{ margin:0, color:"#0F1724", fontSize:16, fontWeight:800 }}>⚡ Skills Required</h3>
                {isCtxSkills && (
                  <span style={{ fontSize:10, fontWeight:800, background:"#EFF6FF", color:"#1e40af", borderRadius:999, padding:"3px 9px", letterSpacing:".04em" }}>
                    Contextual
                  </span>
                )}
              </div>
              {techSkills.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:800, color:"#3170A5", letterSpacing:"0.06em", textTransform:"uppercase" }}>Technical</p>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {techSkills.map(s=><span key={s} style={pill("#EFF6FF","#1e40af")}>{s}</span>)}
                  </div>
                </div>
              )}
              {softSkills.length > 0 && (
                <div>
                  <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:800, color:"#7c3aed", letterSpacing:"0.06em", textTransform:"uppercase" }}>Soft Skills</p>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {softSkills.map(s=><span key={s} style={pill("#FAF5FF","#6d28d9")}>{s}</span>)}
                  </div>
                </div>
              )}
            </div>
            );
          })()}
        </div>
      )}

      {/* ── TRENDING JOBS INSIGHTS ────────────────────────────── */}
      <div style={{
        background: "white",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,.1)",
        boxShadow: "0 2px 8px rgba(0,0,0,.06)",
        marginBottom: 20,
        overflow: "hidden",
      }}>
        {/* Card header */}
        <div style={{
          background: "linear-gradient(135deg, #0F1724 0%, #0F2B43 60%, #2C6099 100%)",
          padding: "18px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>📈</span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "white", letterSpacing: "-.02em" }}>
                Trending Jobs Insights
              </h3>
              {(ctxIndustry || ctxSpecialization) && (
                <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(255,255,255,.15)", color: "rgba(255,255,255,.9)", borderRadius: 999, padding: "2px 8px", letterSpacing: ".04em" }}>
                  {[ctxIndustry, ctxSpecialization].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,.6)" }}>
              Live jobs, top companies &amp; market insights powered by Jsearch
            </p>
          </div>
          {trendingLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,.8)", fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.3)", borderTop: "2px solid white", borderRadius: "50%", animation: "spin 1s linear infinite", display: "inline-block" }} />
              Fetching live jobs…
            </div>
          )}
        </div>

        <div style={{ padding: "20px 24px" }}>
          {!trendingLoading && trendingErr && (
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>{trendingErr}</p>
          )}
          {!trendingLoading && trendingJobs && trendingJobs.available === false && (
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>{trendingJobs.message || "Trending insights unavailable."}</p>
          )}

          {trendingLoading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ height: 110, borderRadius: 10, background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
              ))}
            </div>
          )}

          {!trendingLoading && trendingJobs?.available && (
            <div>
              {/* Live jobs grid */}
              {Array.isArray(trendingJobs.jobs) && trendingJobs.jobs.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: "#0F1724" }}>💼 Live Job Openings</span>
                    <span style={{ fontSize: 11, fontWeight: 800, background: "#ECFDF5", color: "#065F46", borderRadius: 999, padding: "2px 8px", border:"1px solid #D1FAE5" }}>
                      {trendingJobs.jobs.length} found
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 10 }}>
                    {trendingJobs.jobs.slice(0, 6).map((j: any, idx: number) => (
                      <div key={j.job_id || `${j.title}-${j.company}-${idx}`} style={{
                        border: "1px solid rgba(0,0,0,.08)",
                        borderRadius: 10,
                        padding: "14px 16px",
                        background: "white",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        borderLeft: "4px solid #3170A5",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: "#0F1724", lineHeight: 1.35, marginBottom: 3 }}>
                              {j.title || "Untitled role"}
                            </div>
                            {j.company && (
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#3170A5" }}>
                                {j.company}
                              </div>
                            )}
                          </div>
                          {j.applyLink ? (
                            <a
                              href={j.applyLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                flexShrink: 0,
                                padding: "6px 14px",
                                borderRadius: 6,
                                background: "#2563EB",
                                color: "white",
                                fontWeight: 800,
                                fontSize: 11,
                                textDecoration: "none",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Apply ↗
                            </a>
                          ) : null}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {j.location && (
                            <span style={{ fontSize: 11, color: "#64748b" }}>📍 {j.location}</span>
                          )}
                          {j.postedAt && (
                            <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>
                              {mounted && (() => {
                                try {
                                  const d = new Date(j.postedAt);
                                  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
                                  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : `${diff}d ago`;
                                } catch { return ""; }
                              })()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {Array.isArray(trendingJobs.topJobTitles) && trendingJobs.topJobTitles.length > 0 && (
                  <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "14px 16px", border: "1px solid #BFDBFE" }}>
                    <div style={{ fontWeight: 900, fontSize: 11, color: "#3170A5", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
                      🏷 Top Job Titles
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {trendingJobs.topJobTitles.map((t: any, i: number) => (
                        <div key={t.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "#0F2B43", fontWeight: i === 0 ? 900 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {i === 0 && "🥇 "}{t.name}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#3170A5", flexShrink: 0, background: "white", borderRadius: 999, padding: "1px 7px", border:"1px solid #BFDBFE" }}>
                            {t.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(trendingJobs.topCompanies) && trendingJobs.topCompanies.length > 0 && (
                  <div style={{ background: "#FFFBEB", borderRadius: 10, padding: "14px 16px", border: "1px solid #FDE68A" }}>
                    <div style={{ fontWeight: 900, fontSize: 11, color: "#854D0E", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
                      🏢 Top Companies
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {trendingJobs.topCompanies.map((t: any, i: number) => (
                        <div key={t.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "#5E2603", fontWeight: i === 0 ? 900 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {i === 0 && "⭐ "}{t.name}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#854D0E", flexShrink: 0, background: "white", borderRadius: 999, padding: "1px 7px", border:"1px solid #FDE68A" }}>
                            {t.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(trendingJobs.topSkills) && trendingJobs.topSkills.length > 0 && (
                  <div style={{ background: "#FAF5FF", borderRadius: 10, padding: "14px 16px", border: "1px solid #E9D5FF" }}>
                    <div style={{ fontWeight: 900, fontSize: 11, color: "#6d28d9", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
                      ⚡ In-demand Skills
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {trendingJobs.topSkills.map((t: any) => (
                        <span key={t.name} style={{ fontSize: 11, fontWeight: 700, background: "white", color: "#6d28d9", borderRadius: 999, padding: "3px 9px", border: "1px solid #E9D5FF" }}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!trendingJobs.jobs?.length && !trendingJobs.topJobTitles?.length && !trendingJobs.topCompanies?.length && (
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>No trending data found right now. Try again shortly.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── READINESS BAR ────────────────────────────────────── */}
      {prep && (
        <div style={{ ...card, marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontWeight:800, color:"#0F1724", fontSize:14 }}>Role Readiness</span>
            <span style={{ fontWeight:900, color:"#3170A5", fontSize:20 }}>{pct}%</span>
          </div>
          <div style={{ height:10, borderRadius:999, background:"#F1F5F9", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct}%`, borderRadius:999, background:"linear-gradient(90deg,#3170A5,#0EA5E9)", transition:"width .6s" }}/>
          </div>
          <p style={{ margin:"6px 0 0", fontSize:12, color:"#64748b" }}>{completedCount}/{totalCount} skills completed</p>
        </div>
      )}

      {/* ══ GANTT ══════════════════════════════════════════════ */}
      <div style={{ background:"white", borderRadius:12, border:"1px solid rgba(0,0,0,.1)", marginBottom:20, padding:0, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>

        {/* header */}
        <div style={{ background:"linear-gradient(135deg, #0F1724 0%, #0F2B43 60%, #2C6099 100%)", padding:"20px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div>
            <h2 style={{ margin:0, fontSize:18, fontWeight:900, color:"white", display:"flex", alignItems:"center", gap:8 }}>
              📊 Learning Gantt
            </h2>
            <p style={{ margin:"4px 0 0", color:"rgba(255,255,255,.7)", fontSize:13 }}>
              Personalised learning timeline · hover a bar to see monthly topics
            </p>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {prep?.isActive ? (
              <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(255,255,255,.12)", border:"1px solid rgba(255,255,255,.25)", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, color:"white" }}>
                🔒 Chart Locked
              </span>
            ) : (
              <>
                <button
                  style={{ ...btn("white","rgba(255,255,255,.12)","rgba(255,255,255,.3)"), fontSize:12 }}
                  onClick={() => {
                    if (custPriority.length === 0 && tasks.length > 0) {
                      setCustPriority(tasks.map((t:any) => t.name));
                    } else if (custPriority.length === 0 && data?.skillRequirements?.length > 0) {
                      setCustPriority(data.skillRequirements.map((s:any) => s.skillName));
                    }
                    setShowCustomize(true);
                  }}
                  disabled={loading}
                >
                  ⚙️ Customize
                </button>
                <button style={{ ...btn("white","rgba(255,255,255,.12)","rgba(255,255,255,.3)"), fontSize:12 }} onClick={()=>load()} disabled={loading}>
                  {loading ? (
                    <><span style={{ width:12, height:12, border:"2px solid rgba(255,255,255,.4)", borderTop:"2px solid white", borderRadius:"50%", animation:"spin 1s linear infinite", display:"inline-block" }}/>Generating…</>
                  ) : "🔄 Regenerate"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* loading state */}
        {loading && (
          <div style={{ padding:52, textAlign:"center", color:"#3170A5" }}>
            <div style={{ width:48, height:48, border:"4px solid #DBEAFE", borderTop:"4px solid #3170A5", borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto 16px" }}/>
            <p style={{ fontWeight:800, margin:"0 0 4px", fontSize:16, color:"#0F1724" }}>Generating your learning plan…</p>
            <p style={{ fontSize:13, color:"#94a3b8", margin:0 }}>Building a personalised schedule</p>
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div style={{ padding:52, textAlign:"center", color:"#64748b" }}>
            <p style={{ fontSize:32, margin:"0 0 10px" }}>📅</p>
            <p style={{ fontWeight:700, margin:"0 0 6px" }}>No scheduled tasks yet.</p>
            <p style={{ fontSize:13 }}>Update your profile with a graduation year, then click Regenerate.</p>
          </div>
        )}

        {/* GANTT TABLE */}
        {!loading && tasks.length > 0 && (
          <div style={{ overflowX:"auto" }} onMouseLeave={()=>setTooltip(null)}>
            <table style={{ borderCollapse:"collapse", width:"100%", minWidth:200+totalMonths*78 }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  <th style={{ padding:"13px 18px", textAlign:"left", minWidth:215, fontSize:11, fontWeight:800, color:"#475569", textTransform:"uppercase", letterSpacing:".08em", borderBottom:"2px solid #e2e8f0", borderRight:"1px solid #e2e8f0" }}>
                    Skill &amp; Type
                  </th>
                  {labels.map((l,i) => {
                    const mn = i + 1;
                    const isBreak = planBreakMonths.has(mn);
                    return (
                      <th key={i} style={{ padding:"11px 2px", textAlign:"center", minWidth:66, borderBottom:"2px solid #e2e8f0", borderRight:"1px solid #f1f5f9", background: isBreak ? "#fff1f2" : undefined }}>
                        <div style={{ fontSize:13, fontWeight:900, color: isBreak ? "#dc2626" : "#1e293b" }}>
                          {isBreak ? "☕" : `M${mn}`}
                        </div>
                        <div style={{ fontSize:10, color: isBreak ? "#fca5a5" : "#94a3b8", fontWeight:600 }} suppressHydrationWarning>
                          {isBreak ? "Break" : l.short}
                        </div>
                      </th>
                    );
                  })}
                  <th style={{ padding:"11px 10px", minWidth:100, textAlign:"center", borderBottom:"2px solid #e2e8f0", fontSize:11, fontWeight:700, color:"#475569", textTransform:"uppercase" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task:any, ri:number) => {
                  const color  = taskColor(task.type, ri);
                  const diff   = diffColor(task.difficulty);
                  const imp    = impColor(task.importance);
                  const isDone = !!prep?.skillProgress?.[task.name]?.completed;
                  const topKey = `${task.name}_${task.start}_${task.end}`;
                  const topicsReady = !topicsLoading[topKey] && !!topicsCache[topKey];

                  return (
                    <React.Fragment key={task.id||task.name}>
                      <tr style={{ borderBottom:"1px solid #f1f5f9", background:isDone?"rgba(220,252,231,.35)":ri%2===0?"white":"#fafbff" }}>

                        {/* skill label */}
                        <td style={{ padding:"13px 18px", borderRight:"1px solid #e2e8f0", verticalAlign:"middle" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <div style={{ width:10, height:10, borderRadius:"50%", background:color, flexShrink:0, boxShadow:`0 0 0 3px ${color}28` }}/>
                            <div>
                              <div style={{ fontWeight:700, fontSize:14, color:isDone?"#15803d":"#0f172a", textDecoration:isDone?"line-through":"none" }}>
                                {task.name}
                              </div>
                              {task.description && (
                                <div style={{ fontSize:11, color:"#64748b", marginTop:2, maxWidth:185 }}>{task.description}</div>
                              )}
                              <div style={{ marginTop:4, display:"flex", flexWrap:"wrap", gap:3 }}>
                                <span style={pill(task.type==="non-technical"?"#FAF5FF":"#EFF6FF", task.type==="non-technical"?"#6d28d9":"#3170A5")}>
                                  {task.type==="non-technical"?"🎯 Soft":"💻 Tech"}
                                </span>
                                <span style={pill(diff.bg,diff.text)}>{task.difficulty||"intermediate"}</span>
                                <span style={pill(imp.bg,imp.text)}>{task.importance||"Important"}</span>
                                {task.isOptional && <span style={pill("#fef9c3","#854d0e")}>Optional</span>}
                                {task.parallel   && <span style={pill("#fdf4ff","#7e22ce")} title="This skill runs in parallel with another">⚡ Parallel</span>}
                                {topicsLoading[topKey] && (
                                  <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10, color:"#6366f1" }}>
                                    <span style={{ width:8, height:8, border:"1.5px solid #e9d5ff", borderTop:`1.5px solid ${color}`, borderRadius:"50%", animation:"spin 1s linear infinite", display:"inline-block" }}/>
                                    topics…
                                  </span>
                                )}
                                {topicsReady && <span style={pill("#f0fdf4","#16a34a")}>✓ topics</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* month cells */}
                        {labels.map((_,mi) => {
                          const mn        = mi+1;
                          const isBreakMo = planBreakMonths.has(mn);
                          const inRange   = !isBreakMo && mn >= task.start && mn <= task.end;
                          const isStart   = mn === task.start && !isBreakMo;
                          const isEnd     = mn === task.end   && !isBreakMo;
                          const isHov     = tooltip?.skillName===task.name && tooltip?.month===mn;
                          return (
                            <td key={mi}
                              style={{ borderRight:"1px solid #f1f5f9", verticalAlign:"middle", height:58, padding:0, background: isBreakMo ? "#fff1f2" : undefined }}
                              onMouseEnter={e => inRange && showTooltip(e, task, mn, color)}
                              onMouseLeave={()=>setTooltip(null)}
                            >
                              {isBreakMo ? (
                                /* red break column stripe */
                                <div style={{ height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
                                  <span style={{ fontSize:14 }}>☕</span>
                                </div>
                              ) : inRange ? (
                                <div style={{
                                  height:36,
                                  background: isDone ? "#22c55e" : isHov ? color+"cc" : color,
                                  borderRadius: isStart&&isEnd?10 : isStart?"10px 0 0 10px" : isEnd?"0 10px 10px 0" : 0,
                                  marginLeft:isStart?4:0, marginRight:isEnd?4:0,
                                  display:"flex", alignItems:"center", justifyContent:"center",
                                  transition:"background .1s, transform .1s",
                                  transform: isHov ? "scaleY(1.08)" : "scaleY(1)",
                                  boxShadow: isHov ? `0 4px 14px ${color}55` : "none"
                                }}>
                                  <span style={{ fontSize:8, fontWeight:800, color:"white" }}>
                                    {isStart&&isEnd?"▶◀":isStart?"▶":isEnd?"◀":""}
                                  </span>
                                </div>
                              ) : (
                                <div style={{ height:5, width:5, borderRadius:"50%", background:"#e2e8f0", margin:"0 auto" }}/>
                              )}
                            </td>
                          );
                        })}

                        {/* actions */}
                        <td style={{ padding:"8px 10px", textAlign:"center", verticalAlign:"middle" }}>
                          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                            {prep?.isActive ? (
                              <Link href={`/role/${enc(roleName)}/test/${enc(task.name)}`} style={{ textDecoration:"none" }}>
                                <button
                                  style={{
                                    width:"100%", fontSize:11, padding:"6px 0",
                                    background: isDone ? "#ECFDF5" : "#2563EB",
                                    color: isDone ? "#065F46" : "white",
                                    border: isDone ? "1px solid #D1FAE5" : "none",
                                    borderRadius:6, fontWeight:700, cursor:"pointer",
                                    display:"flex", alignItems:"center", justifyContent:"center", gap:4,
                                  }}
                                >
                                  {isDone ? "🔄 Retake" : "🧠 Take Test"}
                                </button>
                              </Link>
                            ) : (
                              <button
                                disabled
                                title="Start Preparation first to unlock tests"
                                style={{ background:"#F1F5F9", color:"#94a3b8", border:"none", borderRadius:6, width:"100%", fontSize:11, padding:"6px 0", opacity:.6, cursor:"not-allowed", display:"flex", alignItems:"center", justifyContent:"center" }}
                              >
                                🔒 Locked
                              </button>
                            )}
                            {isDone && prep?.isActive && (
                              <button style={{ ...btn("#854D0E","#FEF3C7","#FDE68A"), fontSize:10, justifyContent:"center", width:"100%", padding:"5px 0" }} onClick={()=>markUndone(task.name)}>
                                ↩ Undo
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* footer legend */}
        {!loading && tasks.length > 0 && (
          <div style={{ padding:"12px 20px", background:"#F8FAFC", borderTop:"1px solid #e2e8f0", display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
              <span style={pill("#EFF6FF","#3170A5")}>💻 Technical</span>
              <span style={pill("#FAF5FF","#6d28d9")}>🎯 Non-Technical</span>
              <span style={pill("#ECFDF5","#065F46")}>✅ Completed</span>
              {planBreakMonths.size > 0 && <span style={pill("#FEF2F2","#991B1B")}>☕ Break Month</span>}
              {tasks.some((t:any) => t.parallel) && <span style={pill("#FFFBEB","#854D0E")}>⚡ Parallel</span>}
              <span style={{ fontSize:11, color:"#94a3b8" }}>· Hover a bar cell to see monthly topics</span>
            </div>
            {(data?.plan?.warnings||[]).length > 0 && (
              <span style={{ fontSize:12, color:"#854D0E", fontWeight:600 }}>⚠ {data.plan.warnings.length} warning{data.plan.warnings.length>1?"s":""}</span>
            )}
          </div>
        )}
      </div>

      {/* ── WARNINGS ─────────────────────────────────────────── */}
      {(data?.plan?.warnings||[]).length > 0 && (
        <div style={{ background:"#FFFBEB", borderRadius:10, border:"1px solid #FDE68A", padding:"16px 20px", marginBottom:20 }}>
          <h3 style={{ margin:"0 0 10px", color:"#854D0E", fontSize:14, fontWeight:800 }}>⚠ Scheduling Warnings</h3>
          <ul style={{ margin:0, paddingLeft:18 }}>
            {data.plan.warnings.map((w:string,i:number) => <li key={i} style={{ fontSize:13, color:"#78350f", marginBottom:4 }}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* ── SKILL REQUIREMENT CARDS ──────────────────────────── */}
      {chartSkillReqs.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <h2 style={{ marginBottom:14, fontSize:17, fontWeight:900, color:"#0F1724" }}>🎯 Skill Requirements</h2>
          <div style={{ display:"grid", gap:8 }}>
            {chartSkillReqs.map((s:any) => {
              const isDone = !!prep?.skillProgress?.[s.skillName]?.completed;
              const score  = prep?.skillProgress?.[s.skillName]?.score;
              const diff   = diffColor(s.difficulty);
              const imp    = impColor(s.importance);
              return (
                <div key={s.skillName} style={{ background:"white", borderRadius:10, border:"1px solid rgba(0,0,0,.08)", borderLeft:`4px solid ${isDone?"#15614B":"#3170A5"}`, padding:0, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
                  {/* row card */}
                  <div
                    style={{ padding:"14px 16px", display:"grid", gridTemplateColumns:"1.4fr 1fr auto", gap:12, alignItems:"center", cursor:"pointer", background: expandedSkills[s.skillName] ? "#F8FAFC" : "white" }}
                    onClick={() => setExpandedSkills(p => ({ ...p, [s.skillName]: !p[s.skillName] }))}
                    title="Click to expand monthly topics"
                  >
                    {/* left: title + desc */}
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
                        <span style={{ fontWeight:800, fontSize:14, color:isDone?"#15614B":"#0F1724", textDecoration:isDone?"line-through":"none" }}>{s.skillName}</span>
                        {isDone && <span style={pill("#ECFDF5","#065F46")}>✅ Done</span>}
                      </div>
                      {s.description && <p style={{ margin:0, fontSize:12, color:"#64748b", lineHeight:1.4 }}>{s.description}</p>}
                    </div>

                    {/* middle: chips/details */}
                    <div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:4 }}>
                        <span style={pill(diff.bg,diff.text)}>{s.difficulty||"intermediate"}</span>
                        <span style={pill(imp.bg,imp.text)}>{s.importance||"Important"}</span>
                        <span style={pill("#F1F5F9","#475569")}>⏱ {s.timeRequiredMonths||1} mo</span>
                        {s.isOptional && <span style={pill("#FFFBEB","#854D0E")}>Optional</span>}
                      </div>
                      {typeof score==="number" && (
                        <span style={pill("#F8FAFC",score>=80?"#15614B":"#991B1B")}>Last: {score}%</span>
                      )}
                    </div>

                    {/* right: actions */}
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {(() => {
                        const ts = topicStats(s.skillName);
                        const p = Math.max(0, Math.min(100, ts.pct));
                        const ringColor = p >= 100 ? "#15614B" : "#3170A5";
                        return (
                          <div
                            title={`Topic completion: ${p}%`}
                            style={{
                              width: 34, height: 34, borderRadius: "50%",
                              background: `conic-gradient(${ringColor} ${p * 3.6}deg, #e2e8f0 0deg)`,
                              display: "grid", placeItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "white", display: "grid", placeItems: "center" }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: "#475569" }}>{p}</span>
                            </div>
                          </div>
                        );
                      })()}
                      {prep?.isActive ? (
                        <Link href={`/role/${enc(roleName)}/test/${enc(s.skillName)}`} style={{ textDecoration:"none" }} onClick={(e)=>e.stopPropagation()}>
                          <button style={{
                            background: isDone ? "#ECFDF5" : "#2563EB",
                            color: isDone ? "#065F46" : "white",
                            border: isDone ? "1px solid #D1FAE5" : "none",
                            borderRadius:8, fontWeight:700, fontSize:11, cursor:"pointer",
                            padding:"8px 14px", display:"flex", alignItems:"center", gap:4,
                          }}>
                            {isDone ? "🔄 Retake" : "🧠 Take Test"}
                          </button>
                        </Link>
                      ) : (
                        <button disabled title="Start Preparation first" style={{ background:"#F1F5F9", color:"#94a3b8", border:"none", borderRadius:8, fontSize:11, padding:"8px 12px", opacity:.5, cursor:"not-allowed" }}>
                          🔒 Start Prep
                        </button>
                      )}
                      <span style={{ fontSize:12, color:"#94a3b8", minWidth:16, textAlign:"center" }}>{expandedSkills[s.skillName] ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* prereqs */}
                  {s.prerequisites?.length > 0 && (
                    <div style={{ padding:"0 14px 10px", borderTop:"1px dashed #eef2f7" }}>
                      <p style={{ margin:"8px 0 0", fontSize:11, color:"#94a3b8" }}>Prereqs: {s.prerequisites.join(", ")}</p>
                    </div>
                  )}

                  {/* Expandable monthly topics with completion checkboxes */}
                  {expandedSkills[s.skillName] && (() => {
                    const ts = topicStats(s.skillName);
                    const key = ts.key;
                    const loadingTopics = key ? !!topicsLoading[key] : false;
                    const months = Object.entries(ts.topicByMonth).sort((a, b) => Number(a[0]) - Number(b[0]));
                    return (
                      <div style={{ margin:"8px 0 10px", border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden" }}>
                        <div style={{ padding:"8px 10px", background:"#F8FAFC", borderBottom:"1px solid #e2e8f0", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6 }}>
                          <span style={{ fontSize:11, fontWeight:800, color:"#0F1724", letterSpacing:".03em" }}>📚 Monthly Topics</span>
                          <span style={{ fontSize:10, color:"#94a3b8", maxWidth:360 }}>
                            Resources use the topic text on each line (not the job role).
                          </span>
                          <span style={{ fontSize:11, fontWeight:700, color:"#3170A5" }}>
                            {ts.done}/{ts.total} complete
                          </span>
                        </div>
                        <div style={{ padding:10, display:"grid", gap:8 }}>
                          {loadingTopics && <p style={{ margin:0, fontSize:12, color:"#94a3b8" }}>Generating topics…</p>}
                          {!loadingTopics && months.length === 0 && (
                            <p style={{ margin:0, fontSize:12, color:"#94a3b8" }}>Topics are still loading. Hover the Gantt bars once or wait a few seconds.</p>
                          )}
                          {!loadingTopics && months.map(([month, topics]) => {
                            const list = Array.isArray(topics) ? topics : [];
                            return (
                              <div key={month} style={{ border:"1px solid #eef2f7", borderRadius:8, padding:"8px 9px" }}>
                                <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:800, color:"#3170A5" }}>Month {month}</p>
                                <div style={{ display:"grid", gap:5 }}>
                                  {list.map((topic, i) => {
                                    const doneTopic = !!prep?.skillProgress?.[s.skillName]?.subtopicCompletion?.[`month_${month}_topic_${i}`];
                                    return (
                                      <div
                                        key={`${month}_${i}`}
                                        style={{
                                          display:"flex",
                                          alignItems:"flex-start",
                                          gap:8,
                                          fontSize:12,
                                          color:"#334155",
                                          padding:"6px 4px",
                                          borderRadius:8,
                                          background: doneTopic ? "#f0fdf4" : "transparent",
                                          justifyContent:"space-between",
                                        }}
                                      >
                                        <label style={{ display:"flex", alignItems:"flex-start", gap:7, cursor:"pointer", flex:1, minWidth:0 }}>
                                          <input
                                            type="checkbox"
                                            checked={doneTopic}
                                            onChange={e => toggleTopicDone(s.skillName, Number(month), i, e.target.checked)}
                                            style={{ marginTop:2, flexShrink:0 }}
                                          />
                                          <span style={{ textDecoration:doneTopic ? "line-through" : "none", color: doneTopic ? "#16a34a" : "#334155" }}>{topic}</span>
                                        </label>
                                        <TopicResourcesButton topic={String(topic)} />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── USER BAR ─────────────────────────────────────────── */}
      <div style={{ ...card, display:"flex", gap:14, alignItems:"center", flexWrap:"wrap", fontSize:13 }}>
        <span style={{ color:"#0F1724" }}>👤 <b>{userId}</b></span>
        <Link href="/profile" style={{ color:"#3170A5", fontWeight:600 }}>Edit Profile / Graduation Year</Link>
        <Link href={`/role/${enc(roleName)}/analytics`} style={{ color:"#3170A5", fontWeight:600 }}>📊 Full Analytics</Link>
      </div>

      {/* ══ CUSTOMIZE CHART MODAL ══════════════════════════════════ */}
      {showCustomize && (
        <div
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCustomize(false); }}
        >
          <div style={{ background:"white", borderRadius:20, width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(0,0,0,.3)" }}>
            {/* Modal header */}
            <div style={{ background:"linear-gradient(135deg, #0F1724, #2C6099)", borderRadius:"20px 20px 0 0", padding:"22px 28px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <h3 style={{ margin:0, color:"white", fontSize:20, fontWeight:900 }}>⚙️ Customize Chart</h3>
                <p style={{ margin:"4px 0 0", color:"rgba(255,255,255,.7)", fontSize:13 }}>Personalise your learning roadmap before regenerating</p>
              </div>
              <button onClick={() => setShowCustomize(false)} style={{ background:"rgba(255,255,255,.15)", border:"none", color:"white", borderRadius:10, width:34, height:34, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            </div>

            <div style={{ padding:28 }}>

              {/* ── Duration ── */}
              <div style={{ marginBottom:28 }}>
                <label style={{ display:"block", fontWeight:800, fontSize:14, color:"#0f172a", marginBottom:8 }}>
                  ⏱ Total Learning Duration
                </label>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <input
                    type="range" min="3" max="60" step="1"
                    value={custDuration ? Number(custDuration) : 12}
                    onChange={e => setCustDuration(e.target.value)}
                    style={{ flex:1, accentColor:"#6366f1" }}
                  />
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <input
                      type="number" min="1" max="60"
                      value={custDuration}
                      onChange={e => setCustDuration(e.target.value)}
                      placeholder="12"
                      style={{ width:64, padding:"6px 10px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:14, textAlign:"center", outline:"none" }}
                    />
                    <span style={{ fontSize:13, color:"#64748b", whiteSpace:"nowrap" }}>months</span>
                  </div>
                </div>
                <p style={{ margin:"6px 0 0", fontSize:12, color:"#94a3b8" }}>Leave blank to auto-calculate the optimal duration</p>
              </div>

              {/* ── Break months picker ── */}
              <div style={{ marginBottom:28 }}>
                <label style={{ display:"block", fontWeight:800, fontSize:14, color:"#0f172a", marginBottom:4 }}>
                  ☕ Break Months
                  {custBreakMonths.size > 0 && (
                    <span style={{ marginLeft:8, fontSize:12, fontWeight:600, color:"#dc2626", background:"#fff1f2", padding:"2px 8px", borderRadius:20 }}>
                      {custBreakMonths.size} selected
                    </span>
                  )}
                </label>
                <p style={{ margin:"0 0 10px", fontSize:12, color:"#94a3b8" }}>
                  Click months to mark them as breaks. No skill will be scheduled in a break month — they appear as red ☕ columns on the chart.
                </p>
                {(() => {
                  const totalMo = custDuration ? Number(custDuration) : (data?.plan?.totalMonths || 12);
                  return (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {Array.from({ length: Math.max(1, totalMo) }, (_, i) => {
                        const mo = i + 1;
                        const selected = custBreakMonths.has(mo);
                        return (
                          <button
                            key={mo}
                            onClick={() => {
                              const next = new Set(custBreakMonths);
                              selected ? next.delete(mo) : next.add(mo);
                              setCustBreakMonths(next);
                            }}
                            style={{
                              width:42, height:38, borderRadius:8, border:"1.5px solid",
                              borderColor: selected ? "#dc2626" : "#e2e8f0",
                              background: selected ? "#fef2f2" : "#f8fafc",
                              color: selected ? "#dc2626" : "#475569",
                              fontWeight:700, fontSize:12, cursor:"pointer",
                              transition:"all .12s",
                            }}
                          >
                            {selected ? "☕" : `M${mo}`}
                          </button>
                        );
                      })}
                      {custBreakMonths.size > 0 && (
                        <button
                          onClick={() => setCustBreakMonths(new Set())}
                          style={{ padding:"0 12px", height:38, borderRadius:8, border:"1.5px solid #e2e8f0", background:"white", color:"#94a3b8", fontSize:11, fontWeight:600, cursor:"pointer" }}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ── Skills priority ── */}
              <div style={{ marginBottom:28 }}>
                <label style={{ display:"block", fontWeight:800, fontSize:14, color:"#0f172a", marginBottom:4 }}>
                  🎯 Skills Priority Order
                </label>
                <p style={{ margin:"0 0 12px", fontSize:12, color:"#94a3b8" }}>Drag using ↑ ↓ to set the order in which skills will be learned (top = first)</p>

                {custPriority.length === 0 ? (
                  <div style={{ padding:"18px", background:"#f8fafc", borderRadius:12, textAlign:"center", color:"#94a3b8", fontSize:13 }}>
                    Load the chart first, then open this modal to reorder skills.
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {custPriority.map((skill, idx) => (
                      <div key={skill} style={{ display:"flex", alignItems:"center", gap:10, background: idx % 2 === 0 ? "#f8fafc" : "white", border:"1px solid #e2e8f0", borderRadius:10, padding:"10px 14px" }}>
                        <span style={{ fontWeight:800, fontSize:12, color:"#3170A5", minWidth:22, textAlign:"center", background:"#EFF6FF", borderRadius:6, padding:"2px 6px" }}>{idx + 1}</span>
                        <span style={{ flex:1, fontSize:13, fontWeight:600, color:"#0f172a" }}>{skill}</span>
                        <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                          <button
                            disabled={idx === 0}
                            onClick={() => {
                              const next = [...custPriority];
                              [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                              setCustPriority(next);
                            }}
                            style={{ background: idx === 0 ? "#f1f5f9" : "#EFF6FF", border:"none", borderRadius:6, cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "#cbd5e1" : "#3170A5", fontSize:13, width:26, height:22, display:"flex", alignItems:"center", justifyContent:"center" }}
                          >▲</button>
                          <button
                            disabled={idx === custPriority.length - 1}
                            onClick={() => {
                              const next = [...custPriority];
                              [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                              setCustPriority(next);
                            }}
                            style={{ background: idx === custPriority.length - 1 ? "#f1f5f9" : "#EFF6FF", border:"none", borderRadius:6, cursor: idx === custPriority.length - 1 ? "default" : "pointer", color: idx === custPriority.length - 1 ? "#cbd5e1" : "#3170A5", fontSize:13, width:26, height:22, display:"flex", alignItems:"center", justifyContent:"center" }}
                          >▼</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Apply button ── */}
              <div style={{ display:"flex", gap:10 }}>
                <button
                  onClick={() => setShowCustomize(false)}
                  style={{ flex:1, padding:"11px 0", borderRadius:10, border:"1.5px solid #e2e8f0", background:"white", color:"#475569", fontWeight:700, fontSize:14, cursor:"pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowCustomize(false);
                    replan({
                      duration:      custDuration || undefined,
                      priorityOrder: custPriority.length > 0 ? custPriority : undefined,
                      breakMonths:   custBreakMonths.size > 0 ? [...custBreakMonths].sort((a,b)=>a-b) : undefined,
                    });
                  }}
                  style={{ flex:2, padding:"11px 0", borderRadius:10, border:"none", background:"linear-gradient(135deg, #0F1724, #3170A5)", color:"white", fontWeight:800, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
                >
                  🔄 Apply &amp; Regenerate Chart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function enc(s:string) { return encodeURIComponent(s); }
