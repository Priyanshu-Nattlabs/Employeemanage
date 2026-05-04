"use client";

import { motion } from "framer-motion";
import { appPath, publicAssetUrl } from "@/lib/apiBase";
import { InterviewXFooter } from "./InterviewXFooter";

const sectionIn = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" as const },
  transition: { duration: 0.55 },
};

export function PublicHomePage() {
  return (
    <div className="public-home">
      <style>{`
        :root {
          --bg: #f6f8fc;
          --surface: rgba(255,255,255,0.86);
          --card: #ffffff;
          --ink: #0b1220;
          --muted: #475467;
          --border: rgba(15, 23, 42, 0.10);
          --border-strong: rgba(15, 23, 42, 0.14);
          --shadow: 0 18px 45px rgba(15, 23, 42, 0.10);
          --shadow-soft: 0 10px 26px rgba(15, 23, 42, 0.07);
          /* SaarthiX palette cues (adapted to corporate) */
          --brandA: #054a90;
          --brandB: #3170a5;
          --brandC: #4f46e5;
          --brandMint: #00bfa6;

          /* Footer theme (InterviewXFooter uses these vars) */
          --ix-footer-bg: linear-gradient(180deg, #f5f9ff 0%, #eef5ff 45%, #eaf2ff 100%);
          --ix-footer-text: var(--ink);
          --ix-footer-muted: #667085;
          --ix-footer-accent: var(--brandA);
          --ix-footer-border: rgba(2, 6, 23, 0.06);
          --ix-footer-card-bg: rgba(255, 255, 255, 0.92);
          --ix-footer-card-border: rgba(2, 6, 23, 0.08);
          --ix-footer-icon: rgba(15, 23, 42, 0.72);
          --ix-footer-accent-border: rgba(5, 74, 144, 0.32);
          --ix-footer-bar-bg: #0b1220;
          --ix-footer-bar-text: rgba(226, 232, 240, 0.74);
          --ix-footer-bar-text-hover: #e2e8f0;
        }

        .public-home { position: relative; margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw); margin-top: -18px; width: 100vw; overflow-x: hidden; background: var(--bg); color: var(--ink); }
        .public-bg {
          pointer-events: none;
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 18% 24%, rgba(56, 189, 248, 0.18) 0%, transparent 48%),
            radial-gradient(circle at 82% 18%, rgba(99, 102, 241, 0.14) 0%, transparent 46%),
            radial-gradient(circle at 70% 82%, rgba(34, 197, 94, 0.10) 0%, transparent 50%),
            linear-gradient(125deg, #dff1ff 0%, #e4e8ff 50%, #e8fff5 100%);
        }

        .hero-shell { position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; padding: 56px 20px 42px; }
        .public-wrap { position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; padding: 18px 20px 28px; }
        .public-grid2 { display: grid; gap: 34px; grid-template-columns: 1fr; align-items: center; }
        .public-badge {
          display: inline-flex;
          border: 1px solid rgba(15,23,42,0.14);
          background: rgba(255,255,255,.78);
          border-radius: 999px;
          padding: 7px 14px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .14em;
          color: rgba(11,18,32,0.78);
          text-transform: uppercase;
        }
        .public-h1 {
          margin: 0;
          font-size: clamp(34px, 4.2vw, 58px);
          font-weight: 900;
          line-height: 1.05;
          letter-spacing: -0.03em;
          color: var(--ink);
          max-width: 760px;
        }
        .public-p { margin: 0; max-width: 680px; color: rgba(71,84,103,0.92); line-height: 1.85; font-size: 16px; }
        .public-btns { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }

        .btn-primary,
        .btn-secondary,
        .btn-ghost {
          border-radius: 14px;
          padding: 12px 16px;
          font-weight: 900;
          font-size: 14px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease, color .18s ease;
        }
        .btn-primary {
          border: none;
          background: linear-gradient(90deg, var(--brandC), var(--brandA) 55%, var(--brandMint));
          color: #fff;
          box-shadow: 0 14px 30px rgba(31,95,191,.18);
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 18px 45px rgba(31,95,191,.22); }
        .btn-secondary {
          background: rgba(255,255,255,0.85);
          color: var(--ink);
          border: 1px solid rgba(15,23,42,0.14);
          box-shadow: 0 10px 22px rgba(15,23,42,0.06);
        }
        .btn-secondary:hover { transform: translateY(-1px); border-color: rgba(15,23,42,0.22); }
        .btn-ghost {
          background: transparent;
          color: rgba(11,18,32,0.78);
          border: 1px dashed rgba(15,23,42,0.22);
        }
        .btn-ghost:hover { transform: translateY(-1px); border-color: rgba(15,23,42,0.35); color: var(--ink); }

        .hero-visual {
          position: relative;
          border-radius: 22px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.70);
          backdrop-filter: blur(10px);
          box-shadow: var(--shadow);
          padding: 16px;
          overflow: hidden;
        }
        .hero-visual::before {
          content: "";
          position: absolute;
          inset: -30%;
          background:
            radial-gradient(circle at 18% 24%, rgba(56, 189, 248, 0.22) 0%, transparent 46%),
            radial-gradient(circle at 82% 18%, rgba(99, 102, 241, 0.16) 0%, transparent 44%),
            radial-gradient(circle at 70% 82%, rgba(34, 197, 94, 0.12) 0%, transparent 46%);
          filter: blur(24px);
          opacity: 0.85;
          pointer-events: none;
          animation: heroAmbient 14s ease-in-out infinite alternate;
        }
        @keyframes heroAmbient {
          0% { transform: translate3d(-1.5%, 1.2%, 0) scale(1); opacity: 0.70; }
          100% { transform: translate3d(1.5%, -1.2%, 0) scale(1.04); opacity: 0.92; }
        }
        .hero-visual::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.08;
          mix-blend-mode: overlay;
          background-image:
            repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 3px),
            repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.04) 0 1px, transparent 1px 3px);
          mask-image: radial-gradient(circle at 30% 35%, rgba(0, 0, 0, 0.9), transparent 70%);
        }

        .hero-lines {
          position: absolute;
          inset: 0;
          z-index: 1;
          width: 100%;
          height: 100%;
          opacity: 0.85;
          pointer-events: none;
        }
        .hero-line {
          fill: none;
          stroke: rgba(164, 190, 226, 0.56);
          stroke-width: 2.4;
          stroke-linecap: round;
          stroke-dasharray: 9 12;
          filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.55))
            drop-shadow(0 0 12px rgba(141, 180, 255, 0.35));
          animation: heroLineFlow 7.5s linear infinite;
        }
        .hero-line.b { animation-duration: 8.2s; animation-direction: reverse; }
        .hero-line.c { animation-duration: 9s; }
        @keyframes heroLineFlow {
          0% { stroke-dashoffset: 0; opacity: 0.55; }
          50% { opacity: 1; }
          100% { stroke-dashoffset: 86; opacity: 0.55; }
        }

        .hero-sparkles { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
        .hero-sparkle {
          position: absolute;
          display: block;
          clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
          background: radial-gradient(circle, rgba(255, 255, 255, 0.98) 0%, rgba(221, 235, 255, 0.92) 50%, rgba(150, 190, 255, 0.35) 100%);
          filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.85))
            drop-shadow(0 0 10px rgba(166, 202, 255, 0.65))
            drop-shadow(0 0 18px rgba(125, 174, 255, 0.35));
          transform-origin: center;
          opacity: 0.65;
          animation: heroSparkleMove 3.2s ease-in-out infinite;
        }
        @keyframes heroSparkleMove {
          0%, 100% { opacity: 0.55; transform: translate(0,0) scale(0.88) rotate(0deg); }
          50% { opacity: 0.95; transform: translate(var(--drift, 0px, -7px)) scale(1.18) rotate(12deg); }
        }
        .hero-shotRow { position: relative; display: block; }
        .hero-shot {
          width: 100%;
          height: auto;
          display: block;
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,0.10);
          box-shadow: 0 16px 36px rgba(15,23,42,0.16);
        }

        .section { position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; padding: 54px 20px; }
        .section-title { margin: 0; font-size: clamp(24px, 3.2vw, 36px); font-weight: 900; color: var(--ink); letter-spacing: -0.02em; }
        .modules-grid { display: grid; gap: 14px; grid-template-columns: 1fr; margin-top: 14px; }
        .module-card { border: 1px solid rgba(15,23,42,0.10); background: rgba(255,255,255,0.86); backdrop-filter: blur(10px); border-radius: 18px; padding: 18px; box-shadow: var(--shadow-soft); transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .module-card:hover { transform: translateY(-2px); border-color: rgba(15,23,42,0.18); box-shadow: 0 18px 46px rgba(15,23,42,0.12); }
        .module-head { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
        .module-icon { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; font-weight: 1000; color: var(--ink); background: linear-gradient(135deg, rgba(79,70,229,.16), rgba(0,191,166,.14)); border: 1px solid rgba(15,23,42,0.12); }
        .module-title { margin: 0; font-size: 16px; font-weight: 900; color: var(--ink); letter-spacing: -0.01em; }
        .module-desc { margin: 8px 0 0; color: rgba(71,84,103,0.92); font-size: 13px; line-height: 1.75; }
        .module-tags { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
        .tag { font-size: 11px; font-weight: 900; color: rgba(11,18,32,0.86); background: rgba(0,191,166,.12); border: 1px solid rgba(0,191,166,.28); padding: 4px 9px; border-radius: 999px; }
        .tag.alt { background: rgba(79,70,229,.10); border-color: rgba(79,70,229,.22); }
        .module-cta { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px; }
        .module-link { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; border-radius: 14px; font-size: 13px; font-weight: 900; text-decoration: none; border: 1px solid rgba(15,23,42,0.14); background: rgba(255,255,255,0.90); color: var(--ink); box-shadow: 0 10px 22px rgba(15,23,42,0.06); }
        .module-link.primary { border: none; background: linear-gradient(90deg, var(--brandC), var(--brandA) 55%, var(--brandMint)); color: #fff; box-shadow: 0 14px 30px rgba(31,95,191,.16); }
        .module-link:hover { filter: brightness(0.99); }
        .enterprise-grid { display: grid; gap: 14px; grid-template-columns: 1fr; margin-top: 14px; }
        .enterprise-card { border-radius: 18px; border: 1px solid rgba(15,23,42,0.10); background: rgba(255,255,255,0.86); backdrop-filter: blur(10px); padding: 18px; box-shadow: var(--shadow-soft); }
        .enterprise-h { margin: 0; font-size: 12px; font-weight: 1000; color: rgba(71,84,103,0.85); letter-spacing: .14em; text-transform: uppercase; }
        .enterprise-ul { margin: 10px 0 0; padding-left: 18px; color: rgba(71,84,103,0.92); font-size: 13px; line-height: 1.75; }

        @media (min-width: 980px) {
          .public-grid2 { grid-template-columns: 1.05fr .95fr; align-items: center; }
          .modules-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .enterprise-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
        }

        @media (prefers-reduced-motion: reduce) {
          .btn-primary, .btn-secondary, .btn-ghost, .module-card { transition: none; }
          .btn-primary:hover, .btn-secondary:hover, .btn-ghost:hover, .module-card:hover { transform: none; }
          .hero-visual::before { animation: none; }
          .hero-line { animation: none; }
          .hero-sparkle { animation: none; }
        }
      `}</style>
      <div className="public-bg" />

      <section className="hero-shell">
        <div className="public-grid2">
          <motion.div {...sectionIn}>
            <span className="public-badge">WORKFORCE INTELLIGENCE PLATFORM</span>
            <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
              <h1 className="public-h1">If talent is your edge, this is your operating system.</h1>
              <p className="public-p">
                A connected platform for <b>role blueprinting</b>, <b>AI interviews</b>, <b>interview preparation</b>, and <b>manager monitoring</b> — so hiring and development are driven by consistent evidence.
              </p>
            </div>
            <div className="public-btns">
              <a href={appPath("/auth/employee/register")} className="btn-secondary">
                Get Started
              </a>
            </div>
          </motion.div>

          <motion.div {...sectionIn} transition={{ duration: 0.7 }}>
            <div className="hero-visual" aria-label="Career progression illustration">
              <svg className="hero-lines" viewBox="0 0 1600 720" preserveAspectRatio="none" aria-hidden>
                <path className="hero-line a" d="M-40 500 C 210 380, 360 590, 640 470 C 860 380, 1140 560, 1660 410" />
                <path className="hero-line b" d="M-30 620 C 220 520, 460 650, 760 560 C 980 490, 1240 640, 1660 530" />
                <path className="hero-line c" d="M200 120 C 500 200, 760 80, 1060 170 C 1260 230, 1430 140, 1660 210" />
              </svg>
              <div className="hero-sparkles" aria-hidden>
                {[
                  { left: "38%", top: "16%", size: 18, delay: "0.2s", drift: "1px, -8px" },
                  { left: "56%", top: "78%", size: 22, delay: "1s", drift: "-2px, -9px" },
                  { left: "70%", top: "62%", size: 20, delay: "1.7s", drift: "2px, -7px" },
                  { left: "84%", top: "26%", size: 24, delay: "0.6s", drift: "-1px, -10px" },
                  { left: "92%", top: "44%", size: 18, delay: "2.1s", drift: "1px, -6px" },
                ].map((s, idx) => (
                  <span
                    key={idx}
                    className="hero-sparkle"
                    style={{
                      left: s.left,
                      top: s.top,
                      width: `${s.size}px`,
                      height: `${s.size}px`,
                      animationDelay: s.delay,
                      ["--drift" as any]: s.drift,
                    }}
                  />
                ))}
              </div>
              <div className="hero-shotRow">
                <img
                  className="hero-shot"
                  src={publicAssetUrl("/ui-images/corporate-career-ladder.png")}
                  alt="Career progression from entry level through executive, aligned with role development and readiness"
                  loading="eager"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section" aria-labelledby="modules-heading">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <h2 id="modules-heading" className="section-title">Four connected modules, one talent system</h2>
          <p style={{ margin: 0, color: "#1F5FBF", fontSize: 13 }}>Blueprint → Evaluate → Prepare → Monitor — all aligned to roles.</p>
        </div>

        <div className="modules-grid">
          <motion.div {...sectionIn} className="module-card">
            <div className="module-head">
              <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
                <div className="module-icon" aria-hidden>BP</div>
                <div style={{ minWidth: 0 }}>
                  <h3 className="module-title">Blueprint (Role Pathways)</h3>
                  <p className="module-desc">
                    Define target roles, required skills, and a guided roadmap. Employees get clarity; managers get consistency.
                  </p>
                </div>
              </div>
            </div>
            <div className="module-tags" aria-label="Blueprint highlights">
              <span className="tag">Skill gaps</span>
              <span className="tag alt">Roadmaps</span>
              <span className="tag">Assessments</span>
            </div>
            <div className="module-cta">
              <a href={appPath("/role/")} className="module-link primary">
                Explore Blueprints <span aria-hidden>→</span>
              </a>
              <a href={appPath("/target-role")} className="module-link">
                Start a plan <span aria-hidden>→</span>
              </a>
            </div>
          </motion.div>

          <motion.div {...sectionIn} className="module-card">
            <div className="module-head">
              <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
                <div className="module-icon" aria-hidden>AI</div>
                <div style={{ minWidth: 0 }}>
                  <h3 className="module-title">AI Interviews (InterviewX)</h3>
                  <p className="module-desc">
                    Schedule role-aligned AI interviews, generate reports, and review proctoring summaries for credibility.
                  </p>
                </div>
              </div>
            </div>
            <div className="module-tags" aria-label="AI Interview highlights">
              <span className="tag alt">Reports</span>
              <span className="tag">Rubrics</span>
              <span className="tag alt">Proctoring</span>
            </div>
            <div className="module-cta">
              <a href={appPath("/auth/manager/login")} className="module-link primary">
                Manager / HR access <span aria-hidden>→</span>
              </a>
              <a href={appPath("/dashboard/manager/schedule-interviews")} className="module-link">
                Open schedule hub <span aria-hidden>→</span>
              </a>
            </div>
          </motion.div>

          <motion.div {...sectionIn} className="module-card">
            <div className="module-head">
              <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
                <div className="module-icon" aria-hidden>IP</div>
                <div style={{ minWidth: 0 }}>
                  <h3 className="module-title">Interview Preparation</h3>
                  <p className="module-desc">
                    Technical + HR practice, structured feedback, and mentor interview requests — so candidates improve faster.
                  </p>
                </div>
              </div>
            </div>
            <div className="module-tags" aria-label="Interview prep highlights">
              <span className="tag">Technical</span>
              <span className="tag alt">HR round</span>
              <span className="tag">Mentors</span>
            </div>
            <div className="module-cta">
              <a href={appPath("/auth/employee/login")} className="module-link primary">
                Employee login <span aria-hidden>→</span>
              </a>
              <a href={appPath("/auth/employee/register")} className="module-link">
                Create account <span aria-hidden>→</span>
              </a>
            </div>
          </motion.div>

          <motion.div {...sectionIn} className="module-card">
            <div className="module-head">
              <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
                <div className="module-icon" aria-hidden>MN</div>
                <div style={{ minWidth: 0 }}>
                  <h3 className="module-title">Monitoring & Analytics</h3>
                  <p className="module-desc">
                    A manager dashboard for activity, progress distribution, team comparisons, and employee tracking by role.
                  </p>
                </div>
              </div>
            </div>
            <div className="module-tags" aria-label="Monitoring highlights">
              <span className="tag alt">Activity feed</span>
              <span className="tag">KPI view</span>
              <span className="tag alt">Tracking</span>
            </div>
            <div className="module-cta">
              <a href={appPath("/auth/manager/login")} className="module-link primary">
                Open dashboard <span aria-hidden>→</span>
              </a>
              <a href={appPath("/dashboard/manager")} className="module-link">
                Manager view <span aria-hidden>→</span>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <motion.section {...sectionIn} className="section" aria-labelledby="enterprise-heading">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <h2 id="enterprise-heading" className="section-title">Enterprise-ready by design</h2>
          <p style={{ margin: 0, color: "#1F5FBF", fontSize: 13 }}>Practical governance, clear audit trails, and role-based access.</p>
        </div>
        <div className="enterprise-grid">
          <div className="enterprise-card">
            <p className="enterprise-h">Security</p>
            <ul className="enterprise-ul">
              <li>Role-based access for employees, managers, HR, and admins</li>
              <li>Reports and scores stored per candidate and interview</li>
              <li>Proctoring summary surfaced in interview reports (when enabled)</li>
            </ul>
          </div>
          <div className="enterprise-card">
            <p className="enterprise-h">Operations</p>
            <ul className="enterprise-ul">
              <li>Manager dashboard with activity feed and engagement views</li>
              <li>Bulk invite employees via Excel for faster onboarding</li>
              <li>Consistent role blueprints to standardize expectations</li>
            </ul>
          </div>
          <div className="enterprise-card">
            <p className="enterprise-h">Decisioning</p>
            <ul className="enterprise-ul">
              <li>Promotion readiness based on assessments + progress</li>
              <li>Compare team progress distribution across roles</li>
              <li>Track employee preparation analytics by role</li>
            </ul>
          </div>
        </div>
      </motion.section>

      {/* Footer must be the final full-bleed section */}
      <div style={{ marginTop: 22, position: "relative", zIndex: 1 }}>
        <InterviewXFooter />
      </div>
    </div>
  );
}

