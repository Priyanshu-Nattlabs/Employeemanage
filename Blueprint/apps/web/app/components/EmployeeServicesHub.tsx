"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isNew = searchParams?.get("new") === "1";

  useEffect(() => {
    if (!isNew) return;
    const sp = new URLSearchParams(searchParams?.toString() || "");
    sp.delete("new");
    const next = sp.toString();
    const url = next ? `${pathname}?${next}` : pathname;
    window.history.replaceState({}, "", url);
    // intentionally run once on mount for current URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <h1 className="emp-h1">
                {isNew ? "Welcome" : "Welcome back"}, {user.fullName?.split(" ")[0] || "there"}
              </h1>
              <p className="emp-sub">
                Choose how you want to grow today: structured role development in TalentX, or interview readiness
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
                <a href={blueprintHref} className="emp-card" aria-label="Open TalentX">
                  <span className="emp-shine" aria-hidden />
                  <div className="emp-card-top">
                    <div>
                      <div className="emp-card-kicker">TalentX</div>
                      <h2 className="emp-card-title">Role pathways and skill development</h2>
                      <p className="emp-card-desc">
                        Turn company role standards into a clear path: pick a target role, see skill gaps, follow guided
                        prep and assessments, and show readiness with data your leaders can review.
                      </p>
                    </div>
                  </div>
                  <div className="emp-card-visual">
                    <img src={heroImg} alt="" decoding="async" />
                  </div>
                  <div className="emp-card-footer">
                    <span className="emp-cta">
                      Open TalentX <span aria-hidden>{"\u2192"}</span>
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
      </div>

      <div className="emp-footer-wrap">
        <InterviewXFooter />
      </div>
    </div>
  );
}
