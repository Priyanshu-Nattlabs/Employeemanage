"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { appPath, publicAssetUrl } from "@/lib/apiBase";
import type { OrgUser } from "@/lib/orgAuth";
import { buildInterviewXStudentPrepHomeUrl } from "@/lib/interviewx";
import { InterviewXFooter } from "./InterviewXFooter";

import "./EmployeeServicesHub.css";

const fade = { opacity: 0, y: 22 };
const fadeIn = { opacity: 1, y: 0 };

const INTERVIEW_PREP_TIPS = [
  "Check your lighting",
  "Frame yourself well",
  "Test audio and internet",
  "Dress professionally",
  "Be camera-ready",
];

export function EmployeeServicesHub(props: { user: OrgUser }) {
  const { user } = props;

  const interviewPrepUrl = useMemo(() => {
    return buildInterviewXStudentPrepHomeUrl({
      email: user.email,
      name: user.fullName,
    });
  }, [user.email, user.fullName]);

  const blueprintHref = appPath("/");
  const heroImg = publicAssetUrl("/ui-images/corporate-career-ladder.png");
  const interviewImg = publicAssetUrl("/ui-images/employee-interview-prep.png");

  return (
    <div className="emp-hub-root">
      <div className="emp-hub">
        <div className="emp-hub-bg" aria-hidden />
        <div className="emp-hub-grid" aria-hidden />

        <div className="emp-wrap">
          <div>
            <motion.div initial={fade} animate={fadeIn} transition={{ duration: 0.5 }}>
              <span className="emp-eyebrow">
                <span className="emp-eyebrow-dot" />
                Employee workspace
              </span>
              <h1 className="emp-h1">Welcome back, {user.fullName?.split(" ")[0] || "there"}</h1>
              <p className="emp-sub">
                Choose how you want to grow today: structured role development in Job Blueprint, or interview readiness
                and practice in InterviewX. Built for teams that care about measurable outcomes.
              </p>
              <div className="emp-meta">
                <span>
                  <b>Company</b> {user.companyName}
                </span>
                <span>
                  <b>Email</b> {user.email}
                </span>
                {user.designation ? (
                  <span>
                    <b>Role</b> {user.designation}
                  </span>
                ) : null}
              </div>
            </motion.div>

            <div className="emp-cards">
              <motion.div initial={fade} animate={fadeIn} transition={{ duration: 0.5, delay: 0.06 }}>
                <a href={blueprintHref} className="emp-card" aria-label="Open Job Blueprint">
                  <span className="emp-shine" aria-hidden />
                  <div className="emp-card-top">
                    <div>
                      <div className="emp-card-kicker">Job Blueprint</div>
                      <h2 className="emp-card-title">Role pathways and skill development</h2>
                      <p className="emp-card-desc">
                        Turn company role standards into a clear path: pick a target role, see skill gaps, follow guided
                        prep and assessments, and show readiness with data your leaders can review.
                      </p>
                    </div>
                    <div className="emp-card-icon bp" aria-hidden>
                      BP
                    </div>
                  </div>
                  <div className="emp-card-visual">
                    <img src={heroImg} alt="" decoding="async" />
                  </div>
                  <div className="emp-card-footer">
                    <span className="emp-cta">
                      Open Blueprint <span aria-hidden>{"\u2192"}</span>
                    </span>
                    <span className="emp-card-hint">Same sign-in</span>
                  </div>
                </a>
              </motion.div>

              <motion.div initial={fade} animate={fadeIn} transition={{ duration: 0.5, delay: 0.12 }}>
                <a
                  href={interviewPrepUrl}
                  className="emp-card emp-card--ix"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open InterviewX interview preparation"
                >
                  <span className="emp-shine" aria-hidden />
                  <div className="emp-card-top">
                    <div>
                      <div className="emp-card-kicker">InterviewX</div>
                      <h2 className="emp-card-title">Interview preparation and practice</h2>
                      <p className="emp-card-desc">
                        Practice technical and HR rounds, get structured feedback, use labs and mentor flows, and walk
                        into real interviews with confidence — aligned to how hiring teams actually evaluate candidates.
                      </p>
                    </div>
                    <div className="emp-card-icon ix" aria-hidden>
                      IX
                    </div>
                  </div>
                  <div className="emp-card-visual" style={{ paddingTop: 8 }}>
                    <img
                      className="emp-interview-photo"
                      src={interviewImg}
                      alt="Professional desk setup for a video interview: lighting, microphone, laptop, and notes"
                      loading="eager"
                      decoding="async"
                    />
                  </div>
                  <div className="emp-ix-tips" aria-label="Interview readiness tips">
                    {INTERVIEW_PREP_TIPS.map((t) => (
                      <span key={t} className="emp-ix-tip">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="emp-card-footer">
                    <span className="emp-cta">
                      Open Interview Prep <span aria-hidden>{"\u2197"}</span>
                    </span>
                    <span className="emp-card-hint">New tab</span>
                  </div>
                </a>
              </motion.div>
            </div>
          </div>
        </div>

        <motion.section
          className="emp-about"
          initial={fade}
          animate={fadeIn}
          transition={{ duration: 0.5, delay: 0.16 }}
          aria-labelledby="emp-about-heading"
        >
          <h2 id="emp-about-heading" className="emp-about-title">
            About these services
          </h2>
          <div className="emp-about-grid">
            <div className="emp-about-card">
              <h3>Job Blueprint</h3>
              <p>
                Job Blueprint connects employees to <b>role-specific learning paths</b>: what to study, how to validate
                skills with tests, and how progress rolls up for managers. It is ideal when your organization wants
                consistent expectations across teams and evidence-backed development conversations.
              </p>
              <ul className="emp-about-list">
                <li>Target roles, roadmaps, and gap analysis in one place</li>
                <li>Assessments and prep tied to real job requirements</li>
                <li>Visibility for HR and managers without losing employee ownership</li>
              </ul>
            </div>
            <div className="emp-about-card">
              <h3>Interview preparation (InterviewX)</h3>
              <p>
                InterviewX focuses on <b>how candidates show up in interviews</b>: communication, problem-solving,
                HR and technical rounds, and repeatable practice. It complements Blueprint by sharpening delivery and
                confidence before high-stakes conversations.
              </p>
              <ul className="emp-about-list">
                <li>Technical and HR practice with clear feedback loops</li>
                <li>Labs and sessions designed for remote and hybrid interviews</li>
                <li>Enterprise-friendly workflows your talent team can standardize on</li>
              </ul>
            </div>
          </div>
        </motion.section>
      </div>

      <div className="emp-footer-wrap">
        <InterviewXFooter />
      </div>
    </div>
  );
}
