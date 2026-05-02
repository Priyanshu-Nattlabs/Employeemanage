"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { getApiPrefix } from "@/lib/apiBase";
import { getOrgAuthFromStorage } from "@/lib/orgAuth";
import { flowQueryString, pickRoleFlowParams } from "@/lib/roleFlowParams";

const API = getApiPrefix();

type Q = { questionNumber: number; questionText: string; options: string[]; correctAnswer?: string; skillName?: string };
type TestType = {
  _id?: string; id?: string; status: string;
  testType?: string;
  score?: number; passed?: boolean;
  skillBreakdown?: Record<string, { correct: number; total: number; score: number; passed: boolean }>;
  questions: Q[];
  answers: Record<string, string>;
};

/* ── helpers ───────────────────────────────────────────── */
const getTestId = (t: TestType) => (t as any)._id || t.id || "";

const card: React.CSSProperties = {
  background: "white", borderRadius: 18, border: "1px solid #e2e8f0",
  padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,.07)",
};
const btn = (color: string, bg: string, border = bg): React.CSSProperties => ({
  padding: "10px 22px", borderRadius: 10, border: `1.5px solid ${border}`,
  background: bg, color, fontWeight: 700, fontSize: 14,
  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7,
  whiteSpace: "nowrap",
});

/* ── score ring SVG ────────────────────────────────────── */
function ScoreRing({ pct, size = 140, stroke = 13 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * pct) / 100;
  const color = pct >= 80 ? "#22c55e" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff22" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.2s ease" }} />
    </svg>
  );
}

/* ── badge component ───────────────────────────────────── */
function PassBadge({ skillName, roleName, score, date }: { skillName: string; roleName: string; score: number; date: string }) {
  return (
    <div id="jb-badge" style={{
      width: "100%", maxWidth: 520, margin: "0 auto",
      background: "linear-gradient(145deg, #0f172a 0%, #1e1b4b 45%, #0f172a 100%)",
      borderRadius: 28, padding: "0 0 28px", overflow: "hidden",
      boxShadow: "0 32px 80px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)",
      position: "relative",
    }}>
      {/* gold top bar */}
      <div style={{ height: 5, background: "linear-gradient(90deg,#d4af37,#f5e07a,#d4af37)" }} />

      {/* subtle radial glow */}
      <div style={{
        position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
        width: 340, height: 340, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* header row */}
      <div style={{ padding: "22px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "rgba(255,255,255,.5)", fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>
          🗺 JobBlueprint
        </span>
        <span style={{
          background: "linear-gradient(135deg,#d4af37,#f5e07a)", color: "#0f172a",
          fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase",
          padding: "4px 12px", borderRadius: 999,
        }}>
          Verified ✓
        </span>
      </div>

      {/* centre — score ring */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 28px 0" }}>
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <ScoreRing pct={score} size={150} stroke={14} />
          <div style={{ position: "absolute", textAlign: "center" }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: "white", lineHeight: 1 }}>{score}<span style={{ fontSize: 16 }}>%</span></div>
            <div style={{ fontSize: 10, color: "#a5b4fc", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginTop: 2 }}>Score</div>
          </div>
        </div>

        {/* hexagonal seal */}
        <div style={{ position: "relative", marginTop: 4, marginBottom: 8 }}>
          <svg width={54} height={62} viewBox="0 0 54 62">
            <polygon points="27,2 52,15 52,47 27,60 2,47 2,15" fill="none"
              stroke="url(#gHex)" strokeWidth={2} />
            <defs>
              <linearGradient id="gHex" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d4af37" />
                <stop offset="100%" stopColor="#f5e07a" />
              </linearGradient>
            </defs>
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
            🏆
          </div>
        </div>

        <h2 style={{ margin: "0 0 4px", color: "white", fontSize: 22, fontWeight: 900, textAlign: "center", letterSpacing: "-.4px" }}>
          {skillName}
        </h2>
        <p style={{ margin: "0 0 14px", color: "#a5b4fc", fontSize: 13, textAlign: "center" }}>
          Skill Assessment · {roleName}
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <span style={{ background: "rgba(34,197,94,.15)", border: "1px solid rgba(34,197,94,.4)", color: "#86efac", borderRadius: 999, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>
            ✓ Passed
          </span>
          <span style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.6)", borderRadius: 999, padding: "4px 14px", fontSize: 12, fontWeight: 600 }}>
            {date}
          </span>
        </div>

        {/* divider */}
        <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent)", marginBottom: 18 }} />

        <p style={{ margin: 0, color: "rgba(255,255,255,.35)", fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", textAlign: "center" }}>
          Issued by JobBlueprint · Career Platform
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
export default function SkillTestPage() {
  const params   = useParams<{ roleName: string; skillName: string }>();
  const router   = useRouter();
  const searchParams = useSearchParams();
  const roleName = decodeURIComponent(params.roleName);
  const skillName = decodeURIComponent(params.skillName);
  const roleFlowQs = useMemo(() => flowQueryString(pickRoleFlowParams(searchParams)), [searchParams]);
  const roleBase = `/role/${encodeURIComponent(roleName)}`;
  const isCombinedKnownSkillsTest = skillName.toLowerCase() === "known-skills";
  const displayTestTitle = isCombinedKnownSkillsTest ? "Combined Known Skills Test" : skillName;

  const [mounted, setMounted] = useState(false);
  const [blocked, setBlocked] = useState<null | { role: string; loginHref: string; message: string }>(null);
  const [userId,     setUserId]     = useState("demo-student-1");
  const [test,       setTest]       = useState<TestType | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [currentQ,   setCurrentQ]   = useState(0);
  const [copied,     setCopied]     = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [proctoringStarted, setProctoringStarted] = useState(false);
  const [timeLeftSec, setTimeLeftSec] = useState(60 * 60);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const violationLockRef = useRef(false);
  const tabExitTriggeredRef = useRef(false);

  // Ref-based answers map: immune to stale closures — always holds latest picks
  const answersRef = useRef<Record<string, string>>({});

  const qList      = Array.isArray(test?.questions) ? test!.questions : [];
  const questionCount = qList.length;
  // Drive "answered" count from the ref so it's always accurate
  const [answeredCount, setAnsweredCount] = useState(0);
  const answered   = answeredCount;
  const progress   = questionCount ? Math.round((answered / questionCount) * 100) : 0;

  useEffect(() => {
    setMounted(true);
    const authUser = getOrgAuthFromStorage()?.user || null;
    const currentRole = String(authUser?.currentRole || "");

    // Only employees are allowed to attempt skill tests.
    if (currentRole && currentRole !== "EMPLOYEE") {
      const loginHref =
        currentRole === "MANAGER" || currentRole === "HR"
          ? "/auth/employee/login"
          : "/auth/login";
      setBlocked({
        role: currentRole,
        loginHref,
        message: "Managers and HR can track progress, but cannot open or attempt tests on behalf of employees.",
      });
      setLoading(false);
      return;
    }

    const uid = authUser?.id || "demo-student-1";
    setUserId(uid);
    void loadTest(uid, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleName, skillName]);

  if (blocked) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 0 40px" }}>
        <div style={card}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "#0f172a" }}>Test is blocked for {blocked.role}</h2>
          <p style={{ margin: "0 0 18px", color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
            {blocked.message}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href={blocked.loginHref} style={{ textDecoration: "none" }}>
              <button style={btn("white", "#2563eb")}>Login as employee</button>
            </Link>
            <button
              type="button"
              style={btn("#1e293b", "#f1f5f9", "#e2e8f0")}
              onClick={() => router.back()}
            >
              ← Go back
            </button>
            <Link href="/" style={{ textDecoration: "none" }}>
              <button style={btn("#0f172a", "#fff", "#e2e8f0")}>Home</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const safeJson = async (r: Response) => { try { return await r.json(); } catch { return null; } };

  const loadTest = async (uid: string, isRetake = false) => {
    setError("");
    setCurrentQ(0);
    if (isRetake) {
      // Reset ref and answer count for a fresh attempt
      answersRef.current = {};
      setAnsweredCount(0);
    }
    try {
      setLoading(true);
      if (!isRetake) {
        const inProgressUrl = isCombinedKnownSkillsTest
          ? `${API}/api/skill-test/in-progress-known-skills?studentId=${encodeURIComponent(uid)}&roleName=${encodeURIComponent(roleName)}`
          : `${API}/api/skill-test/in-progress?studentId=${encodeURIComponent(uid)}&roleName=${encodeURIComponent(roleName)}&skillName=${encodeURIComponent(skillName)}`;
        // On initial load, check for an existing in-progress test
        const inProg = await fetch(inProgressUrl);
        if (inProg.ok) {
          const existing = await safeJson(inProg);
          if (existing && (existing._id || existing.id)) {
            // Seed the ref from existing answers so progress shows correctly
            answersRef.current = { ...(existing.answers || {}) };
            setAnsweredCount(Object.keys(answersRef.current).length);
            setTest(existing);
            return;
          }
        }
      }
      let started: Response;
      if (isCombinedKnownSkillsTest) {
        const prepRes = await fetch(`${API}/api/role-preparation/${encodeURIComponent(roleName)}?studentId=${encodeURIComponent(uid)}`);
        const prepBody = await safeJson(prepRes);
        const selectedSkills = Array.isArray(prepBody?.knownSkillsForTest) ? prepBody.knownSkillsForTest : [];
        started = await fetch(
          `${API}/api/skill-test/start-known-skills?studentId=${encodeURIComponent(uid)}&roleName=${encodeURIComponent(roleName)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ selectedSkills }),
          }
        );
      } else {
        started = await fetch(
          `${API}/api/skill-test/start?studentId=${encodeURIComponent(uid)}&roleName=${encodeURIComponent(roleName)}&skillName=${encodeURIComponent(skillName)}`,
          { method: "POST" }
        );
      }
      if (!started.ok) {
        const eb = await safeJson(started);
        throw new Error(eb?.message || `Server error ${started.status}`);
      }
      const newTest = await safeJson(started);
      if (!newTest || !(newTest._id || newTest.id)) throw new Error("Server returned an empty response. Please try again.");
      // For a retake the ref was already cleared above; for first load, start fresh
      answersRef.current = isRetake ? {} : { ...(newTest.answers || {}) };
      setAnsweredCount(Object.keys(answersRef.current).length);
      setTest(newTest);
    } catch (e: any) {
      setError(e.message || "Failed to load test");
    } finally {
      setLoading(false);
    }
  };

  const saveAnswer = async (qNum: number, answer: string) => {
    if (!test) return;
    const tid = getTestId(test);
    if (!tid) return;
    // Write to ref first — ref is never stale, unlike closure-captured state
    const isNew = !answersRef.current[String(qNum)];
    answersRef.current = { ...answersRef.current, [String(qNum)]: answer };
    if (isNew) setAnsweredCount(c => c + 1);
    // Functional setState: always builds on the latest committed state
    setTest(prev => prev ? { ...prev, answers: { ...(prev.answers || {}), [String(qNum)]: answer } } : prev);
    // Persist to backend (fire-and-forget; submit will re-send full answers map as safety net)
    await fetch(`${API}/api/skill-test/${tid}/answer`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionNumber: qNum, answer }),
    }).catch(() => {});
  };

  const submit = async () => {
    if (!test) return;
    const tid = getTestId(test);
    if (!tid) { setError("Test ID missing — try refreshing."); return; }
    setSubmitting(true); setError("");
    try {
      // Send the ref-based answers map — it's always complete and never stale
      const r = await fetch(`${API}/api/skill-test/${tid}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: answersRef.current }),
      });
      const body = await safeJson(r);
      if (!r.ok) throw new Error(body?.message || `Submit failed (${r.status})`);
      if (!body || !("status" in body)) throw new Error("Invalid response from server.");
      setTest(body);
    } catch (e: any) {
      setError(e.message || "Failed to submit test");
    } finally {
      setSubmitting(false);
    }
  };

  const stopCamera = () => {
    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startProctoring = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
      setProctoringStarted(true);
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {
        // Fullscreen may fail due to browser policy; test still continues with visibility checks.
      }
    } catch (e: any) {
      setCameraReady(false);
      setCameraError(e?.message || "Camera permission is required for proctored test");
    }
  };

  const handleViolation = async (reason: string) => {
    if (!test || test.status !== "IN_PROGRESS") return;
    if (violationLockRef.current) return;
    violationLockRef.current = true;
    setTimeout(() => { violationLockRef.current = false; }, 500);
    setError(`${reason}.`);
  };

  const handleTabSwitch = () => {
    if (!test || test.status !== "IN_PROGRESS") return;
    if (tabExitTriggeredRef.current) return;
    setTabSwitchCount((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        tabExitTriggeredRef.current = true;
        setError("Third tab switch detected. Exiting test.");
        stopCamera();
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        setTimeout(() => {
          router.push(`${roleBase}${roleFlowQs}`);
        }, 300);
      } else {
        setError(`Warning ${next}/3: Tab switching detected. On 3rd switch, test will be exited.`);
      }
      return next;
    });
  };

  useEffect(() => {
    const stream = mediaStreamRef.current;
    const video = videoRef.current;
    if (!cameraReady || !stream || !video) return;
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    void video.play().catch(() => {});
  }, [cameraReady, currentQ]);

  useEffect(() => {
    if (!proctoringStarted || !test || test.status !== "IN_PROGRESS") return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") handleTabSwitch();
    };
    const onFullscreen = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) void handleViolation("Exited fullscreen mode");
    };
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      void handleViolation("Copy action blocked");
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      void handleViolation("Paste action blocked");
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      void handleViolation("Right click blocked");
    };

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onContext);
    setIsFullscreen(!!document.fullscreenElement);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onContext);
    };
  }, [proctoringStarted, test]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!test) return;
    if (test.status !== "IN_PROGRESS") {
      stopCamera();
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    }
  }, [test]);

  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    if (test?.status === "IN_PROGRESS") {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [test?.status]);

  useEffect(() => {
    if (!test || test.status !== "IN_PROGRESS" || !cameraReady) return;
    const id = window.setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          setError("Time is over. Submitting test...");
          void submit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [test, cameraReady]);

  /* ── Loading ── */
  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", gap:18 }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:52, height:52, border:"4px solid #e9d5ff", borderTop:"4px solid #8b5cf6", borderRadius:"50%", animation:"spin 1s linear infinite" }}/>
      <p style={{ color:"#6366f1", fontWeight:700, fontSize:16 }}>Generating questions for<br/><strong>{displayTestTitle}</strong>…</p>
      <p style={{ color:"#94a3b8", fontSize:13 }}>This may take up to 20 seconds</p>
    </div>
  );

  /* ── Error ── */
  if (error && !test) return (
    <div style={{ maxWidth:500, margin:"60px auto", textAlign:"center" }}>
      <div style={{ fontSize:52, marginBottom:14 }}>⚠️</div>
      <p style={{ color:"#dc2626", fontWeight:700, fontSize:16, marginBottom:8 }}>Failed to load test</p>
      <p style={{ color:"#64748b", fontSize:14, marginBottom:24 }}>{error}</p>
      <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
        <button style={btn("white","#6366f1")} onClick={() => { setLoading(true); void loadTest(userId, false); }}>🔄 Try Again</button>
        <Link href={`${roleBase}${roleFlowQs}`}>
          <button style={btn("#1e293b","#f1f5f9","#e2e8f0")}>← Back to Role</button>
        </Link>
      </div>
    </div>
  );

  if (!test) return <p style={{ padding:24 }}>No test data.</p>;

  if (!cameraReady) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "10px 0 32px" }}>
        <div style={{ ...card }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 22, color: "#0f172a" }}>🔒 Proctored Test Setup</h2>
          <p style={{ margin: "0 0 12px", color: "#475569", fontSize: 14 }}>
            Camera access is required. Tab switching, exiting fullscreen, copy/paste, and right click are monitored.
          </p>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, marginBottom: 12, background: "#f8fafc" }}>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", maxHeight: 260, borderRadius: 10, background: "#0f172a" }} />
          </div>
          {cameraError && <p style={{ margin: "0 0 10px", color: "#dc2626", fontSize: 13 }}>{cameraError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn("white", "#2563eb")} onClick={() => { void startProctoring(); }}>
              Enable Camera & Start Proctoring
            </button>
            <Link href={`${roleBase}${roleFlowQs}`}>
              <button style={btn("#1e293b", "#f1f5f9", "#e2e8f0")}>Cancel</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Result screen ── */
  if (test.status !== "IN_PROGRESS") {
    const passed = (test.score ?? 0) >= 80;
    const score  = test.score ?? 0;
    const today  = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
    const isKnownSkillsResult = test.testType === "KNOWN_SKILLS";
    const skillRows = isKnownSkillsResult
      ? Object.entries((test as any).skillBreakdown || {}).map(([skill, rowAny]) => {
          const row: any = rowAny || {};
          return {
            skill,
            total: Number(row.total || 0),
            correct: Number(row.correct || 0),
            score: Number(row.score || 0),
            passed: !!row.passed,
          };
        })
      : [];
    const skillPassedCount = skillRows.filter((r) => r.passed).length;
    const allSkillsPassed = isKnownSkillsResult ? skillRows.length > 0 && skillRows.every((r) => r.passed) : passed;
    const liText = `🏆 I just passed the "${displayTestTitle}" skill assessment for ${roleName} on JobBlueprint with a score of ${score}%! Career roadmaps and skill tracking. #CareerDevelopment #JobBlueprint`;
    const liUrl  = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://jobblueprint.app")}&summary=${encodeURIComponent(liText)}`;

    return (
      <div style={{ width:"100%", maxWidth:760, margin:"0 auto", padding:"12px 0 40px" }}>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes pop{0%{transform:scale(.8);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}`}</style>

        {/* breadcrumb */}
        <p style={{ color:"#94a3b8", fontSize:13, marginBottom:20 }}>
          <Link href={`${roleBase}${roleFlowQs}`} style={{ color:"#6366f1", textDecoration:"none", fontWeight:600 }}>← {roleName}</Link>
          <span style={{ margin:"0 6px", color:"#e2e8f0" }}>›</span>
          <span>Test Result</span>
        </p>

        {passed ? (
          /* ══ PASSED ══════════════════════════════════════════ */
          <div style={{ animation:"fadeUp .5s ease" }}>
            <PassBadge skillName={displayTestTitle} roleName={roleName} score={score} date={today} />

            {/* action bar */}
            <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:12 }}>
              <a href={liUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
                <button style={{ ...btn("white","#0a66c2"), width:"100%", justifyContent:"center", fontSize:15, padding:"13px 0", borderRadius:14 }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  Share on LinkedIn
                </button>
              </a>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(liText).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2500); });
                }}
                style={{ ...btn(copied?"#16a34a":"#475569","white","#e2e8f0"), justifyContent:"center", fontSize:14, padding:"11px 0", borderRadius:14 }}
              >
                {copied ? "✓ Copied!" : "📋 Copy achievement text"}
              </button>

              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                <button
                  style={{ ...btn("white","#6366f1"), flex:1, justifyContent:"center", borderRadius:12, minWidth:220 }}
                  onClick={() => router.replace(`${roleBase}${roleFlowQs}`)}
                >
                  Go to Blueprint
                </button>
                <button
                  style={{ ...btn("white","#0ea5e9"), flex:1, justifyContent:"center", borderRadius:12, minWidth:220 }}
                  onClick={() => router.replace(`${roleBase}/report${roleFlowQs}`)}
                >
                  Detailed Report
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ══ FAILED ══════════════════════════════════════════ */
          <div style={{ animation:"fadeUp .4s ease" }}>
            <div style={{
              background: "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)",
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 18px 36px rgba(15,23,42,.12)",
              border: "1px solid #e2e8f0",
            }}>
              <div style={{ height: 5, background: "linear-gradient(90deg,#ef4444,#f97316)" }} />
              <div style={{ padding: "30px 26px", textAlign: "center" }}>
                <div style={{ fontSize: 52, marginBottom: 10, animation:"pop .5s ease" }}>😔</div>
                <h2 style={{ margin:"0 0 6px", color:"#0f172a", fontSize:30, fontWeight:900 }}>Not Passed</h2>
                <p style={{ margin:"0 0 20px", color:"#64748b", fontSize:14, fontWeight:700 }}>{displayTestTitle}</p>

                <div style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:20 }}>
                  <ScoreRing pct={score} size={120} stroke={13} />
                  <div style={{ position:"absolute", textAlign:"center" }}>
                    <div style={{ fontSize:28, fontWeight:900, color:"#0f172a" }}>{score}<span style={{ fontSize:14 }}>%</span></div>
                    <div style={{ fontSize:10, color:"#64748b", fontWeight:700, letterSpacing:".08em" }}>SCORE</div>
                  </div>
                </div>

                {isKnownSkillsResult && skillRows.length > 0 && (
                  <div style={{ margin: "0 auto 18px", maxWidth: 560, textAlign: "left", border: "1px solid #e2e8f0", borderRadius: 12, background: "white", padding: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
                      Skill-wise result (pass is 80% per skill)
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {skillRows.map((r) => (
                        <div key={r.skill} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 10px", background: "#f8fafc" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{r.skill}</span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 900,
                                borderRadius: 999,
                                padding: "3px 8px",
                                border: r.passed ? "1px solid #bbf7d0" : "1px solid #fecaca",
                                background: r.passed ? "#ecfdf5" : "#fef2f2",
                                color: r.passed ? "#166534" : "#991b1b",
                              }}
                            >
                              {r.passed ? "PASSED" : "FAILED"} · {r.score}%
                            </span>
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                            Correct: {r.correct}/{r.total}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                      Skills passed: {skillPassedCount}/{skillRows.length}
                    </div>
                  </div>
                )}

                <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:14, padding:"14px 20px", marginBottom:24 }}>
                  {isKnownSkillsResult ? (
                    <>
                      <p style={{ margin:"0 0 4px", color:"#991b1b", fontWeight:800, fontSize:20 }}>
                        Each selected skill requires at least 80% to pass
                      </p>
                      <p style={{ margin:0, color:"#7f1d1d", fontSize:13 }}>
                        {allSkillsPassed
                          ? "Great work — all selected skills are cleared."
                          : "Review the failed skills and retry. Passed skills remain visible in skill-wise breakdown above."}
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin:"0 0 4px", color:"#991b1b", fontWeight:800, fontSize:20 }}>
                        Need ≥ 80% to pass — you scored {score}%
                      </p>
                      <p style={{ margin:0, color:"#7f1d1d", fontSize:13 }}>
                        Review the learning topics from the Gantt chart then retry.
                      </p>
                    </>
                  )}
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <button
                    style={{ ...btn("white","#ef4444"), justifyContent:"center", fontSize:14, padding:"12px 0", borderRadius:12 }}
                    onClick={() => { setTest(null); setLoading(true); void loadTest(userId, true); }}
                  >
                    🔄 Retake Test
                  </button>
                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    <button
                      style={{ ...btn("white","#6366f1"), flex:1, justifyContent:"center", borderRadius:12, minWidth:220 }}
                      onClick={() => router.replace(`${roleBase}${roleFlowQs}`)}
                    >
                      Go to Blueprint
                    </button>
                    <button
                      style={{ ...btn("white","#0ea5e9"), flex:1, justifyContent:"center", borderRadius:12, minWidth:220 }}
                      onClick={() => router.replace(`${roleBase}/report${roleFlowQs}`)}
                    >
                      Detailed Report
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── No questions guard ── */
  if (questionCount === 0) return (
    <div style={{ maxWidth:500, margin:"60px auto", textAlign:"center" }}>
      <p style={{ color:"#dc2626", fontWeight:700, marginBottom:10 }}>No questions in this test.</p>
      <button style={btn("white","#6366f1")} onClick={() => { setTest(null); setLoading(true); void loadTest(userId, true); }}>
        🔄 Regenerate
      </button>
    </div>
  );

  /* ── In progress ── */
  const q = qList[currentQ];
  // Read from ref so the highlighted option is never stale
  const selectedAnswer = answersRef.current[String(q?.questionNumber)] || "";
  const timeMin = String(Math.floor(timeLeftSec / 60)).padStart(2, "0");
  const timeSec = String(timeLeftSec % 60).padStart(2, "0");

  return (
    <div style={{ width:"100%", maxWidth:1220, margin:"0 auto", padding:"2px 0 70px", height:"calc(100vh - 8px)", overflow:"hidden", display:"flex", flexDirection:"column" }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* top strip */}
      <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"8px 10px", marginBottom:8, display:"grid", gridTemplateColumns:"1.05fr .85fr .75fr", gap:6, alignItems:"center", flexShrink:0 }}>
        <div>
          <p style={{ margin:"0 0 4px", fontSize:11, color:"#64748b", fontWeight:800, letterSpacing:".08em", textTransform:"uppercase" }}>Skill Assessment</p>
          <h1 style={{ margin:"0 0 2px", fontSize:19, fontWeight:900, color:"#0f172a" }}>Assessment in Progress</h1>
          <p style={{ margin:0, color:"#334155", fontSize:12 }}>
            {displayTestTitle} · {roleName}
          </p>
          <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:11 }}>Answered {answered}/{questionCount}</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, border:"1px solid #e2e8f0", borderRadius:10, padding:6, background:"#f8fafc" }}>
          <video ref={videoRef} autoPlay muted playsInline style={{ width:106, height:64, borderRadius:8, objectFit:"cover", background:"#0f172a" }} />
          <div style={{ display:"grid", gap:4 }}>
            <span style={{ fontSize:11, fontWeight:800, color:"#047857", background:"#d1fae5", borderRadius:999, padding:"2px 7px", width:"fit-content" }}>Face Detected</span>
            <span style={{ fontSize:11, color:"#334155" }}>{isFullscreen ? "Fullscreen On" : "Fullscreen Off"}</span>
            <span style={{ fontSize:11, color:"#334155" }}>Tab Switches: {tabSwitchCount}/3</span>
          </div>
        </div>
        <div style={{ display:"grid", gap:6 }}>
          <div style={{ border:"1px solid #fde68a", background:"#fffbeb", borderRadius:9, padding:"6px 8px" }}>
            <p style={{ margin:0, fontSize:11, color:"#92400e", fontWeight:700 }}>Violations</p>
            <p style={{ margin:"1px 0 0", fontSize:18, fontWeight:900, color:"#b45309" }}>{tabSwitchCount}</p>
          </div>
          <div style={{ border:"1px solid #ddd6fe", background:"#f5f3ff", borderRadius:9, padding:"6px 8px" }}>
            <p style={{ margin:0, fontSize:11, color:"#5b21b6", fontWeight:700 }}>Time Remaining</p>
            <p style={{ margin:"1px 0 0", fontSize:18, fontWeight:900, color:"#6d28d9" }}>{timeMin}:{timeSec}</p>
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 250px", gap:8, minHeight:0, flex:1, overflow:"hidden" }}>
        <div style={{ minHeight:0, overflow:"hidden", display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ ...card, marginBottom:0, padding: "10px 12px", flexShrink:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ fontWeight:700, color:"#0f172a", fontSize:14 }}>Progress</span>
              <span style={{ fontWeight:800, color:"#6366f1", fontSize:14 }}>{answered} / {questionCount} answered</span>
            </div>
            <div style={{ height:9, borderRadius:999, background:"#f1f5f9", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${progress}%`, borderRadius:999, background:"linear-gradient(90deg,#6366f1,#a855f7)", transition:"width .4s" }}/>
            </div>
          </div>

          {/* question */}
          {q && (
            <div style={{ ...card, marginBottom:0, padding: "10px 12px", flex:1, overflow:"hidden" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                <span style={{ fontSize:12, fontWeight:800, color:"#6366f1", background:"#ede9fe", padding:"5px 12px", borderRadius:999 }}>
                  Question {q.questionNumber} / {questionCount}
                </span>
                {answeredCount === questionCount && questionCount > 0 && (
                  <span style={{ fontSize:11, fontWeight:700, color:"#16a34a", background:"#dcfce7", padding:"4px 10px", borderRadius:999 }}>
                    ✓ All answered
                  </span>
                )}
              </div>
              <p style={{ fontSize:20, color:"#cbd5e1", margin:"0 0 1px", fontWeight:800 }}>{q.questionNumber}</p>
              <p style={{ fontSize:18, fontWeight:800, color:"#0f172a", lineHeight:1.24, margin:"0 0 8px" }}>{q.questionText}</p>
              <div style={{ display:"grid", gap:6 }}>
                {q.options.map((opt, oi) => {
                  const sel = selectedAnswer === opt;
                  const letter = ["A","B","C","D"][oi] || String(oi + 1);
                  return (
                    <button key={opt} onClick={() => saveAnswer(q.questionNumber, opt)} style={{
                      textAlign:"left", padding:"8px 10px", borderRadius:10, cursor:"pointer",
                      border: sel ? "2px solid #3b82f6" : "1.5px solid #e2e8f0",
                      background: sel ? "#eff6ff" : "white",
                      display:"flex", alignItems:"center", gap:14,
                      transition:"all .14s",
                      boxShadow: sel ? "0 4px 18px rgba(59,130,246,.15)" : "none",
                    }}>
                      <span style={{
                        minWidth:28, height:28, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
                        fontWeight:800, fontSize:12, flexShrink:0,
                        background: sel ? "#3b82f6" : "#f1f5f9",
                        color: sel ? "white" : "#64748b",
                      }}>{letter}</span>
                      <span style={{ fontSize:14, color: sel ? "#1e3a8a" : "#0f172a", fontWeight: sel ? 700 : 500 }}>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* right side panel */}
        <div style={{ ...card, alignSelf:"start", padding: "10px 10px", minHeight:0, overflow:"hidden" }}>
          <p style={{ margin:"0 0 10px", fontSize:13, color:"#334155", fontWeight:800 }}>Question Palette</p>
          <div style={{ display:"grid", gap:8, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#475569" }}>
              <span style={{ width:14, height:14, borderRadius:4, background:"#22c55e", display:"inline-block" }} /> Answered
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#475569" }}>
              <span style={{ width:14, height:14, borderRadius:4, background:"#f1f5f9", border:"1px solid #cbd5e1", display:"inline-block" }} /> Not Answered
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#475569" }}>
              <span style={{ width:14, height:14, borderRadius:4, background:"#f59e0b", display:"inline-block" }} /> Current
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:5 }}>
            {qList.map((q2, i) => {
              const ans = answersRef.current[String(q2.questionNumber)];
              const isCurrent = i === currentQ;
              return (
                <button key={i} onClick={() => setCurrentQ(i)} style={{
                  height:31, borderRadius:8, border:"1px solid #e2e8f0", cursor:"pointer", fontWeight:700, fontSize:11,
                  background: isCurrent ? "#f59e0b" : ans ? "#22c55e" : "#f8fafc",
                  color: isCurrent || ans ? "white" : "#64748b",
                  transition:"all .15s",
                }}>{i + 1}</button>
              );
            })}
          </div>
          <p style={{ margin:"10px 0 0", fontSize:12, color:"#64748b" }}>
            Answered: {answered}/{questionCount}
          </p>
          {error && <p style={{ margin:"8px 0 0", fontSize:12, color:"#dc2626" }}>{error}</p>}
          <button
            style={{ ...btn("white", "#16a34a"), marginTop:12, width:"100%", justifyContent:"center", opacity: submitting ? .7 : 1 }}
            onClick={submit}
            disabled={submitting}
          >
            {submitting
              ? <><span style={{ width:13, height:13, border:"2px solid rgba(255,255,255,.4)", borderTop:"2px solid white", borderRadius:"50%", animation:"spin 1s linear infinite", display:"inline-block" }}/>Submitting…</>
              : `✅ Submit`
            }
          </button>
        </div>
      </div>

      {/* fixed bottom controls */}
      <div
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: 8,
          width: "min(1220px, calc(100vw - 20px))",
          zIndex: 1000,
          background: "white",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "8px 10px",
          boxShadow: "0 8px 26px rgba(15,23,42,.12)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            style={btn("#7f1d1d", "#fee2e2", "#fecaca")}
            onClick={() => router.push(`${roleBase}${roleFlowQs}`)}
          >
            Exit
          </button>
          <button
            style={btn("#1e293b","#f1f5f9","#e2e8f0")}
            onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
            disabled={currentQ === 0}
          >
            ← Previous
          </button>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button
            style={btn("white","#6366f1")}
            onClick={() => setCurrentQ(Math.min(questionCount - 1, currentQ + 1))}
            disabled={currentQ === questionCount - 1}
          >
            Next →
          </button>
          <button
            style={{ ...btn("white", "#16a34a"), opacity: submitting ? .7 : 1 }}
            onClick={submit}
            disabled={submitting}
          >
            {submitting
              ? <><span style={{ width:13, height:13, border:"2px solid rgba(255,255,255,.4)", borderTop:"2px solid white", borderRadius:"50%", animation:"spin 1s linear infinite", display:"inline-block" }}/>Submitting…</>
              : `✅ Submit (${answered}/${questionCount})`
            }
          </button>
        </div>
      </div>
    </div>
  );
}
