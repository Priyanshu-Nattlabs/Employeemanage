"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  /** Applied to the trigger control (e.g. hero button or footer link). */
  triggerClassName: string;
  triggerLabel?: string;
};

export function GetStartedRoleChoice({ triggerClassName, triggerLabel = "Get Started" }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open, onKeyDown]);

  const modal = open ? (
    <div
      className="gsrc-overlay"
      role="presentation"
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "rgba(11, 18, 32, 0.45)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        overscrollBehavior: "contain",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="gsrc-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 100%)",
          borderRadius: 18,
          border: "1px solid rgba(15, 23, 42, 0.12)",
          background: "rgba(255, 255, 255, 0.96)",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
          padding: "22px 22px 18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em", color: "#0b1220" }}>
            How do you want to get started?
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 12,
              border: "1px solid rgba(15, 23, 42, 0.12)",
              background: "rgba(255,255,255,0.9)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              color: "#475467",
            }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.6, color: "#667085" }}>
          Register as an employee to prepare and interview, or as a manager to monitor teams and schedule interviews.
        </p>
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          <Link
            href="/auth/employee/register"
            className="gsrc-choice gsrc-choice--primary"
            onClick={() => setOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 16px",
              borderRadius: 14,
              fontWeight: 900,
              fontSize: 14,
              textDecoration: "none",
              border: "none",
              background: "linear-gradient(90deg, #4f46e5, #054a90 55%, #00bfa6)",
              color: "#fff",
              boxShadow: "0 14px 30px rgba(31, 95, 191, 0.18)",
            }}
          >
            Continue as employee
          </Link>
          <Link
            href="/auth/manager/register"
            className="gsrc-choice"
            onClick={() => setOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 16px",
              borderRadius: 14,
              fontWeight: 900,
              fontSize: 14,
              textDecoration: "none",
              border: "1px solid rgba(15, 23, 42, 0.14)",
              background: "rgba(255, 255, 255, 0.9)",
              color: "#0b1220",
              boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
            }}
          >
            Continue as manager
          </Link>
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 12, color: "#98a2b3", textAlign: "center" }}>
          Already have an account?{" "}
          <Link href="/auth/employee/login" style={{ color: "#054a90", fontWeight: 800 }} onClick={() => setOpen(false)}>
            Employee login
          </Link>
          {" · "}
          <Link href="/auth/manager/login" style={{ color: "#054a90", fontWeight: 800 }} onClick={() => setOpen(false)}>
            Manager login
          </Link>
        </p>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {triggerLabel}
      </button>

      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
