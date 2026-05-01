"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const sectionIn = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" as const },
  transition: { duration: 0.55 },
};

const features = [
  { title: "AI Interviews", icon: "AI" },
  { title: "Skill Labs", icon: "LB" },
  { title: "Detailed Reports", icon: "RP" },
  { title: "Comparison Insights", icon: "CP" },
  { title: "Development Portal", icon: "DP" },
  { title: "Manager Dashboard", icon: "MG" },
];

const steps = [
  "Create role",
  "Conduct AI interview + labs",
  "Get detailed reports",
  "Employee enters development portal",
  "Track growth & promote",
];

export function PublicHomePage() {
  return (
    <div className="public-home">
      <style>{`
        .public-home { position: relative; margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw); margin-top: -18px; width: 100vw; overflow-x: hidden; background: #ffffff; color: #0B3C8C; }
        .public-bg { pointer-events: none; position: absolute; inset: 0; background: linear-gradient(180deg, #ddd6fe 0%, #cffafe 34%, #ffffff 76%); }
        .hero-shell {
          position: relative;
          z-index: 1;
          max-width: 1240px;
          margin: 0 auto;
          padding: 28px 20px 64px;
          background:
            radial-gradient(55% 60% at 12% 10%, rgba(91,33,182,.20), transparent 72%),
            radial-gradient(45% 50% at 95% 18%, rgba(20,184,166,.18), transparent 70%),
            linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,.12));
        }
        .public-wrap { position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; padding: 18px 20px 28px; }
        .public-grid2 { display: grid; gap: 30px; grid-template-columns: 1fr; align-items: center; }
        .public-badge { display: inline-flex; border: 1px solid rgba(31,95,191,.25); background: rgba(255,255,255,.7); border-radius: 999px; padding: 7px 14px; font-size: 11px; font-weight: 700; letter-spacing: .15em; color: #1F5FBF; }
        .public-h1 { margin: 0; font-size: clamp(30px, 4.1vw, 52px); font-weight: 800; line-height: 1.1; letter-spacing: -.02em; color: #0B3C8C; max-width: 760px; }
        .public-p { margin: 0; max-width: 680px; color: #1F5FBF; line-height: 1.85; font-size: 16px; }
        .public-btns { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
        .btn-primary { border-radius: 12px; padding: 12px 18px; background: linear-gradient(90deg, #1F5FBF, #00BFA6); color: #fff; font-weight: 800; font-size: 14px; text-decoration: none; border: none; box-shadow: 0 8px 20px rgba(31,95,191,.20); }
        .btn-secondary { border-radius: 12px; padding: 12px 18px; background: #fff; color: #0B3C8C; font-weight: 800; font-size: 14px; text-decoration: none; border: 1px solid rgba(31,95,191,.25); }
        .hero-points {
          display: grid;
          gap: 12px;
        }
        .hero-point {
          border-left: 3px solid #00BFA6;
          padding: 10px 0 10px 12px;
          background: linear-gradient(90deg, rgba(79,163,255,.12), rgba(255,255,255,0));
        }
        .section { position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; padding: 30px 20px 34px; }
        .section-title { margin: 0; font-size: clamp(24px, 3.2vw, 34px); font-weight: 800; color: #0B3C8C; }
        .dual-info-grid { margin-top: 14px; display: grid; gap: 16px; grid-template-columns: 1fr; width: 100%; }
        .dual-info-card { border: 1px solid #4FA3FF55; border-radius: 12px; padding: 22px; background: linear-gradient(180deg, #ffffff 0%, #4FA3FF12 100%); box-shadow: 0 6px 18px rgba(11,60,140,.06); }
        .triple-info-card { border: 1px solid #4FA3FF55; border-radius: 12px; padding: 22px; background: linear-gradient(180deg, #ffffff 0%, #4FA3FF12 100%); box-shadow: 0 6px 18px rgba(11,60,140,.06); }
        .triple-info-grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
        .triple-info-col { border: 1px solid #4FA3FF33; border-radius: 10px; padding: 14px; background: #ffffff; }
        .dual-info-title { margin: 0; font-size: 22px; font-weight: 800; color: #0B3C8C; }
        .dual-info-subtitle { margin: 0; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; font-weight: 700; color: #1F5FBF; }
        .dual-info-list { margin: 10px 0 0; padding-left: 18px; color: #1F5FBF; font-size: 13px; line-height: 1.75; }
        .info-card-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 10px 16px;
          border-radius: 12px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 800;
          color: #ffffff;
          background: linear-gradient(90deg, #1F5FBF 0%, #00BFA6 100%);
          box-shadow: 0 8px 18px rgba(31,95,191,.22);
          border: 1px solid rgba(255,255,255,.45);
          transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
        }
        .info-card-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 22px rgba(31,95,191,.28);
          filter: saturate(1.08);
        }
        .caps-grid { margin-top: 10px; display: grid; gap: 14px; grid-template-columns: 1fr; }
        .caps-left { border: 1px solid #4FA3FF55; border-radius: 12px; padding: 18px; background: linear-gradient(180deg, #ffffff 0%, #6FE7D214 100%); }
        .caps-items { margin-top: 10px; display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0,1fr)); }
        .cap-item { border: 1px solid #6FE7D2; border-radius: 10px; padding: 9px 10px; font-size: 12px; color: #0B3C8C; background: #6FE7D21A; }
        .cta {
          margin: 24px auto 36px;
          max-width: 980px;
          border-radius: 16px;
          border: 1px solid rgba(31,95,191,.22);
          background:
            radial-gradient(120% 140% at 0% 0%, rgba(111,231,210,.22), transparent 46%),
            radial-gradient(110% 140% at 100% 100%, rgba(79,163,255,.24), transparent 44%),
            linear-gradient(120deg, #eaf4ff 0%, #dff1ff 50%, #e9f9f6 100%);
          color: #0B3C8C;
          text-align: center;
          padding: 46px 24px;
          box-shadow: 0 10px 24px rgba(11, 60, 140, 0.10);
        }
        .cta-title {
          margin: 0;
          font-size: clamp(30px, 3.7vw, 46px);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #0B3C8C;
          line-height: 1.12;
        }
        .cta-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 10px 18px;
          border-radius: 12px;
          border: 1px solid rgba(31,95,191,.20);
          background: linear-gradient(90deg, #1F5FBF 0%, #00BFA6 100%);
          color: #fff;
          font-size: 14px;
          font-weight: 800;
          text-decoration: none;
          box-shadow: 0 8px 18px rgba(31,95,191,.22);
        }
        .cta-btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 10px 18px;
          border-radius: 12px;
          border: 1px solid rgba(31,95,191,.25);
          background: rgba(255,255,255,.9);
          color: #1F5FBF;
          font-size: 14px;
          font-weight: 800;
          text-decoration: none;
        }
        .footer { border-top: 1px solid #4FA3FF66; background: #ffffff; padding: 28px 20px; }
        .footer-grid { max-width: 1240px; margin: 0 auto; display: grid; gap: 20px; grid-template-columns: 1fr; }
        @media (min-width: 980px) {
          .public-grid2 { grid-template-columns: 1.05fr .95fr; align-items: center; }
          .dual-info-grid { grid-template-columns: 1fr; }
          .triple-info-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .caps-grid { grid-template-columns: 1fr; }
          .footer-grid { grid-template-columns: 2fr repeat(4,1fr); }
        }
      `}</style>
      <div className="public-bg" />

      <section className="hero-shell">
        <div className="public-grid2">
          <motion.div {...sectionIn}>
            <span className="public-badge">WORKFORCE INTELLIGENCE PLATFORM</span>
            <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
              <h1 className="public-h1">If talent is your edge, this is your system.</h1>
              <p className="public-p">
                TalentOS helps companies hire better and grow talent faster using AI-driven interviews, real-world
                simulations, and personalized career pathways.
              </p>
            </div>
            <div className="public-btns">
              <Link href="/auth/employee/register" className="btn-primary">Get Started</Link>
              <Link href="/auth/manager/login" className="btn-secondary">Book Demo</Link>
            </div>
          </motion.div>

          <motion.div {...sectionIn} transition={{ duration: 0.7 }} className="hero-points">
            <div className="hero-point">
              <div style={{ fontSize: 12, color: "#1F5FBF", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>Interview Intelligence</div>
              <div style={{ marginTop: 5, fontSize: 18, color: "#0B3C8C", fontWeight: 800 }}>AI-led interviews that mirror real role expectations</div>
            </div>
            <div className="hero-point">
              <div style={{ fontSize: 12, color: "#1F5FBF", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>Development Clarity</div>
              <div style={{ marginTop: 5, fontSize: 18, color: "#0B3C8C", fontWeight: 800 }}>Skill-gap visibility with guided role-based growth</div>
            </div>
            <div className="hero-point">
              <div style={{ fontSize: 12, color: "#1F5FBF", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>Leadership View</div>
              <div style={{ marginTop: 5, fontSize: 18, color: "#0B3C8C", fontWeight: 800 }}>Promotion readiness insights for confident decisions</div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="section">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <h2 className="section-title">Built for both employees and employers</h2>
          <p style={{ margin: 0, color: "#1F5FBF", fontSize: 13 }}>Grow individual careers and track organizational readiness together.</p>
        </div>
        <div className="dual-info-grid">
          <motion.div {...sectionIn} className="triple-info-card">
            <div className="triple-info-grid">
              <div className="triple-info-col">
                <p className="dual-info-subtitle">For Employees</p>
                <h3 className="dual-info-title" style={{ fontSize: 20 }}>Your development roadmap, personalized</h3>
                <p style={{ margin: "10px 0 0", color: "#1F5FBF", fontSize: 14, lineHeight: 1.7 }}>
                  Set your target role and follow a clear development path.
                </p>
                <ul className="dual-info-list">
                  <li>Map current skills vs target role</li>
                  <li>Track milestones and readiness progress</li>
                </ul>
                <div style={{ marginTop: 18, paddingBottom: 8 }}>
                  <Link href="/auth/employee/login" className="info-card-btn">Employee Login</Link>
                </div>
              </div>

              <div className="triple-info-col">
                <p className="dual-info-subtitle">For Employers</p>
                <h3 className="dual-info-title" style={{ fontSize: 20 }}>Monitor growth and readiness across teams</h3>
                <p style={{ margin: "10px 0 0", color: "#1F5FBF", fontSize: 14, lineHeight: 1.7 }}>
                  View team growth and promotion readiness from one dashboard.
                </p>
                <ul className="dual-info-list">
                  <li>Monitor progress by role and department</li>
                  <li>Identify promotion-ready talent quickly</li>
                </ul>
                <div style={{ marginTop: 18, paddingBottom: 8 }}>
                  <Link href="/auth/manager/login" className="info-card-btn">Manager / HR Login</Link>
                </div>
              </div>

              <div className="triple-info-col">
                <p className="dual-info-subtitle">Interview</p>
                <h3 className="dual-info-title" style={{ fontSize: 20 }}>AI interview readiness and evaluation</h3>
                <p style={{ margin: "10px 0 0", color: "#1F5FBF", fontSize: 14, lineHeight: 1.7 }}>
                  Practice mock interviews and get role-readiness feedback.
                </p>
                <ul className="dual-info-list">
                  <li>Run technical and HR interview simulations</li>
                  <li>Get feedback on role fit and communication</li>
                </ul>
                <div style={{ marginTop: 18, paddingBottom: 8 }}>
                  <Link href="/auth/employee/login" className="info-card-btn">Start Interview Prep</Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <motion.section {...sectionIn} className="section">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <h2 className="section-title">Simple workflow</h2>
          <p style={{ margin: 0, color: "#1F5FBF", fontSize: 13 }}>Hire → Develop → Promote in one connected flow.</p>
        </div>
        <div className="caps-grid">
          <div className="caps-left">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 14, color: "#0B3C8C" }}>Core Capabilities</h3>
              <span style={{ fontSize: 11, color: "#1F5FBF" }}>6 modules</span>
            </div>
            <div className="caps-items">
              {features.map((item) => (
                <div key={item.title} className="cap-item">
                  <span style={{ color: "#1F5FBF", fontWeight: 700 }}>{item.icon}</span> {item.title}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section {...sectionIn} className="section">
        <div className="cta">
          <h2 className="cta-title">Build your future workforce today</h2>
          <div className="public-btns" style={{ justifyContent: "center", marginTop: 18 }}>
            <Link href="/auth/employee/register" className="cta-btn-primary">
              Get Started
            </Link>
            <Link href="/auth/manager/login" className="cta-btn-secondary">
              Request Demo
            </Link>
          </div>
        </div>
      </motion.section>

      <footer className="footer">
        <div className="footer-grid">
          <div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>TalentOS</p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#1F5FBF", lineHeight: 1.7 }}>
              Workforce Intelligence Platform for hiring, evaluating, and developing talent with AI.
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#1F5FBF" }}>Headquarters: Bengaluru, India</p>
          </div>
          <div><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0B3C8C" }}>Product</p><p style={{ margin: "8px 0 0", fontSize: 13, color: "#1F5FBF", lineHeight: 1.8 }}>AI Interview Engine<br />Skill Labs & Simulations<br />Manager Analytics</p></div>
          <div><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0B3C8C" }}>Company</p><p style={{ margin: "8px 0 0", fontSize: 13, color: "#1F5FBF", lineHeight: 1.8 }}>About TalentOS<br />Careers (8 open roles)<br />Partners Program</p></div>
          <div><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0B3C8C" }}>Contact</p><p style={{ margin: "8px 0 0", fontSize: 13, color: "#1F5FBF", lineHeight: 1.8 }}>hello@talentos.ai<br />+1 (000) 123-4567<br />Mon - Fri, 9:00 AM - 6:00 PM</p></div>
          <div><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0B3C8C" }}>Legal</p><p style={{ margin: "8px 0 0", fontSize: 13, color: "#1F5FBF", lineHeight: 1.8 }}>Privacy Policy<br />Terms of Service<br />Security & Compliance</p></div>
        </div>
        <div style={{ maxWidth: 1240, margin: "16px auto 0", borderTop: "1px solid #4FA3FF55", paddingTop: 12, display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap", color: "#1F5FBF", fontSize: 12 }}>
          <p style={{ margin: 0 }}>© {new Date().getFullYear()} TalentOS. All rights reserved.</p>
          <p style={{ margin: 0 }}>Built for modern HR, L&D, and people managers.</p>
        </div>
      </footer>
    </div>
  );
}

