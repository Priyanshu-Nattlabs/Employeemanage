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
  { title: "AI Interviews", desc: "Technical + HR interview automation with adaptive AI prompts.", icon: "AI" },
  { title: "Real-world labs", desc: "Hands-on labs across dev, cloud, DB, and design disciplines.", icon: "LB" },
  { title: "Detailed reports", desc: "Comprehensive candidate and employee evaluation snapshots.", icon: "RP" },
  { title: "Comparison insights", desc: "Side-by-side candidate benchmarking for smarter decisions.", icon: "CP" },
  { title: "Development portal", desc: "Personalized pathways and learning plans for each employee.", icon: "DP" },
  { title: "Manager dashboard", desc: "Analytics-first views for skills, progression, and promotion readiness.", icon: "MG" },
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
        .public-home { position: relative; margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw); margin-top: -18px; width: 100vw; overflow-x: hidden; background: #fff; color: #0f172a; }
        .public-bg { pointer-events: none; position: absolute; inset: 0; background: linear-gradient(180deg, #eef2ff 0%, #f5f3ff 30%, #ffffff 70%); }
        .public-wrap { position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; padding: 28px 20px; }
        .public-grid2 { display: grid; gap: 28px; grid-template-columns: 1fr; }
        .public-badge { display: inline-flex; border: 1px solid rgba(99,102,241,.25); background: rgba(255,255,255,.78); border-radius: 999px; padding: 7px 14px; font-size: 11px; font-weight: 700; letter-spacing: .15em; color: #4f46e5; }
        .public-h1 { margin: 0; font-size: clamp(32px, 4.8vw, 58px); font-weight: 900; line-height: 1.08; letter-spacing: -.02em; }
        .public-p { margin: 0; max-width: 680px; color: #475569; line-height: 1.8; font-size: 16px; }
        .public-btns { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
        .btn-primary { border-radius: 12px; padding: 12px 18px; background: linear-gradient(90deg, #4f46e5, #7c3aed); color: #fff; font-weight: 700; font-size: 14px; text-decoration: none; border: none; }
        .btn-secondary { border-radius: 12px; padding: 12px 18px; background: rgba(255,255,255,.8); color: #334155; font-weight: 700; font-size: 14px; text-decoration: none; border: 1px solid #cbd5e1; }
        .dash-card { position: relative; overflow: hidden; border-radius: 18px; border: 1px solid #e2e8f0; background: rgba(255,255,255,.9); padding: 18px; box-shadow: 0 16px 50px rgba(79,70,229,.12); }
        .dash-grid { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; }
        .metric { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: linear-gradient(180deg, #fff, #f8fafc); }
        .section { position: relative; z-index: 1; max-width: 1240px; margin: 0 auto; padding: 18px 20px 26px; }
        .section-title { margin: 0; font-size: clamp(24px, 3.2vw, 36px); font-weight: 800; color: #0f172a; }
        .problem-grid { margin-top: 14px; display: grid; gap: 14px; grid-template-columns: 1fr; }
        .panel { border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; background: #fff; }
        .caps-grid { margin-top: 14px; display: grid; gap: 14px; grid-template-columns: 1fr; }
        .caps-left { border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; background: #fff; }
        .caps-items { margin-top: 10px; display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0,1fr)); }
        .cap-item { border: 1px solid #e2e8f0; border-radius: 10px; padding: 9px 10px; font-size: 12px; }
        .cta { margin: 18px auto 40px; max-width: 980px; border-radius: 22px; border: 1px solid rgba(99,102,241,.35); background: linear-gradient(90deg, #4f46e5, #7c3aed); color: #fff; text-align: center; padding: 42px 20px; box-shadow: 0 18px 44px rgba(79,70,229,.28); }
        .footer { border-top: 1px solid #e2e8f0; background: #fff; padding: 30px 20px; }
        .footer-grid { max-width: 1240px; margin: 0 auto; display: grid; gap: 20px; grid-template-columns: 1fr; }
        @media (min-width: 980px) {
          .public-grid2 { grid-template-columns: 1.05fr .95fr; align-items: center; }
          .problem-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
          .caps-grid { grid-template-columns: 2fr 1fr; }
          .footer-grid { grid-template-columns: 2fr repeat(4,1fr); }
        }
      `}</style>
      <div className="public-bg" />

      <section className="public-wrap">
        <div className="public-grid2">
          <motion.div {...sectionIn}>
            <span className="public-badge">WORKFORCE INTELLIGENCE PLATFORM</span>
            <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
              <h1 className="public-h1">
                We&apos;re not building a hiring tool.
                <br />
                We&apos;re building the operating system for talent.
              </h1>
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

          <motion.div {...sectionIn} transition={{ duration: 0.7 }} className="dash-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, letterSpacing: ".16em", color: "#6366f1", fontWeight: 700 }}>TalentOS Dashboard</p>
                <p style={{ margin: "5px 0 0", color: "#64748b", fontSize: 13 }}>Hiring + Employee Growth Insights</p>
              </div>
              <span style={{ borderRadius: 999, background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 700, padding: "5px 10px" }}>Live</span>
            </div>
            <div className="dash-grid">
              {["Hiring Quality 91%", "Skill Growth +24%", "Promotion Readiness 63%", "Role Match Score 88%"].map((item) => (
                <div key={item} className="metric">
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: 11 }}>Metric</p>
                  <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700 }}>{item}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, borderRadius: 10, border: "1px solid #c7d2fe", background: "#eef2ff", padding: 12 }}>
              <p style={{ margin: 0, color: "#4338ca", fontSize: 11 }}>Pipeline Health</p>
              <div style={{ marginTop: 8, height: 8, background: "#c7d2fe", borderRadius: 999 }}>
                <div style={{ height: "100%", width: "72%", borderRadius: 999, background: "linear-gradient(90deg, #4f46e5, #7c3aed)" }} />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <motion.section {...sectionIn} className="section">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <h2 className="section-title">Everything TalentOS does - at a glance</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Hire → Develop → Promote in one platform.</p>
        </div>
        <div className="problem-grid">
          <div className="panel">
            <p style={{ margin: 0, fontSize: 11, letterSpacing: ".14em", fontWeight: 700, color: "#e11d48" }}>The Problem</p>
            <h3 style={{ margin: "8px 0 0", fontSize: 16 }}>Hiring is broken. Growth is invisible.</h3>
            <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.65, color: "#64748b" }}>Teams lose time and money because hiring quality and employee progression are hard to measure.</p>
          </div>
          <div className="panel" style={{ borderColor: "#c7d2fe" }}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: ".14em", fontWeight: 700, color: "#4f46e5" }}>The Solution</p>
            <h3 style={{ margin: "8px 0 0", fontSize: 16, color: "#4338ca" }}>One platform for Hire → Develop → Promote</h3>
            <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.65, color: "#64748b" }}>TalentOS connects assessments, learning, and promotion signals into one decision layer.</p>
          </div>
          <div className="panel" style={{ borderColor: "#ddd6fe" }}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: ".14em", fontWeight: 700, color: "#7c3aed" }}>The Flow</p>
            <h3 style={{ margin: "8px 0 0", fontSize: 16, color: "#6d28d9" }}>How it works</h3>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {steps.map((step, idx) => (
                <div key={step} style={{ border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", padding: "7px 10px", fontSize: 12 }}>
                  <span style={{ color: "#7c3aed", fontWeight: 700 }}>{idx + 1}.</span> {step}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="caps-grid">
          <div className="caps-left">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Core Capabilities</h3>
              <span style={{ fontSize: 11, color: "#64748b" }}>6 modules</span>
            </div>
            <div className="caps-items">
              {features.map((item) => (
                <div key={item.title} className="cap-item">
                  <span style={{ color: "#4f46e5", fontWeight: 700 }}>{item.icon}</span> {item.title}
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <h3 style={{ margin: 0, fontSize: 14 }}>Why TalentOS</h3>
            <ul style={{ margin: "10px 0 0", paddingLeft: 16, color: "#64748b", fontSize: 12, lineHeight: 1.8 }}>
              <li>Combines HR Tech + EdTech + AI</li>
              <li>Tracks growth continuously</li>
              <li>Replaces disconnected tools</li>
              <li>Enables data-driven talent decisions</li>
            </ul>
          </div>
        </div>
      </motion.section>

      <motion.section {...sectionIn} className="section">
        <div className="cta">
          <h2 style={{ margin: 0, fontSize: "clamp(28px, 3.8vw, 42px)", fontWeight: 800 }}>Build your future workforce today</h2>
          <div className="public-btns" style={{ justifyContent: "center", marginTop: 18 }}>
            <Link href="/auth/employee/register" className="btn-secondary" style={{ background: "#fff", color: "#4338ca", borderColor: "#fff" }}>
              Get Started
            </Link>
            <Link href="/auth/manager/login" className="btn-secondary" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.7)" }}>
              Request Demo
            </Link>
          </div>
        </div>
      </motion.section>

      <footer className="footer">
        <div className="footer-grid">
          <div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>TalentOS</p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>
              Workforce Intelligence Platform for hiring, evaluating, and developing talent with AI.
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#64748b" }}>Headquarters: Bengaluru, India</p>
          </div>
          <div><p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Product</p><p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.8 }}>AI Interview Engine<br />Skill Labs & Simulations<br />Manager Analytics</p></div>
          <div><p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Company</p><p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.8 }}>About TalentOS<br />Careers (8 open roles)<br />Partners Program</p></div>
          <div><p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Contact</p><p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.8 }}>hello@talentos.ai<br />+1 (000) 123-4567<br />Mon - Fri, 9:00 AM - 6:00 PM</p></div>
          <div><p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Legal</p><p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.8 }}>Privacy Policy<br />Terms of Service<br />Security & Compliance</p></div>
        </div>
        <div style={{ maxWidth: 1240, margin: "16px auto 0", borderTop: "1px solid #e2e8f0", paddingTop: 12, display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap", color: "#64748b", fontSize: 12 }}>
          <p style={{ margin: 0 }}>© {new Date().getFullYear()} TalentOS. All rights reserved.</p>
          <p style={{ margin: 0 }}>Built for modern HR, L&D, and people managers.</p>
        </div>
      </footer>
    </div>
  );
}

