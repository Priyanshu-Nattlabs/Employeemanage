"use client";

import { useEffect } from "react";
import { getApiPrefix } from "@/lib/apiBase";

/**
 * When SomethingX redirects here with ?token=&sxUserId=&email=&name=&userType=,
 * persist identity for Job Blueprint v2 (studentId) and optionally seed user profile.
 * URL params are then stripped to avoid leaking the token in the address bar.
 */
export function SomethingXBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const sxUserId = params.get("sxUserId");
    const token = params.get("token");
    const email = params.get("email");
    const name = params.get("name");
    const course = params.get("course");
    const stream = params.get("stream");
    const year = params.get("year");
    const education = params.get("education");
    const expectedGraduationYear =
      params.get("expectedGraduationYear") || params.get("graduationYear");
    const expectedGraduationMonth =
      params.get("expectedGraduationMonth") || params.get("graduationMonth");
    const userType = params.get("userType") || "STUDENT";

    if (!sxUserId && !token) return;

    if (sxUserId) {
      localStorage.setItem("jbv2_userId", sxUserId);
    }
    if (email || name) {
      try {
        localStorage.setItem(
          "somethingx_auth_user",
          JSON.stringify({
            email: email || "",
            name: name || "User",
            userType,
          })
        );
      } catch {
        /* ignore */
      }
    }
    if (token) {
      try {
        localStorage.setItem("somethingx_auth_token", token);
      } catch {
        /* ignore */
      }
    }

    if (course) localStorage.setItem("jbv2_course", course);
    if (stream) localStorage.setItem("jbv2_stream", stream);
    if (year) localStorage.setItem("jbv2_year", year);
    if (expectedGraduationYear) localStorage.setItem("jbv2_expectedGraduationYear", expectedGraduationYear);
    if (expectedGraduationMonth) localStorage.setItem("jbv2_expectedGraduationMonth", expectedGraduationMonth);

    if (sxUserId && (email || name || education || course || stream || year || expectedGraduationYear || expectedGraduationMonth)) {
      const derivedEducation = education || [course, stream, year].filter(Boolean).join(" - ");
      const body = {
        userId: sxUserId,
        fullName: name || "",
        email: email || "",
        education: derivedEducation || "",
        expectedGraduationYear: expectedGraduationYear || "",
        expectedGraduationMonth: expectedGraduationMonth || "",
      };
      const apiBase = getApiPrefix();
      fetch(`${apiBase}/api/user-profile/${encodeURIComponent(sxUserId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    }

    const clean = new URL(window.location.href);
    clean.searchParams.delete("token");
    clean.searchParams.delete("sxUserId");
    clean.searchParams.delete("email");
    clean.searchParams.delete("name");
    clean.searchParams.delete("userType");
    clean.searchParams.delete("course");
    clean.searchParams.delete("stream");
    clean.searchParams.delete("year");
    clean.searchParams.delete("education");
    clean.searchParams.delete("expectedGraduationYear");
    clean.searchParams.delete("expectedGraduationMonth");
    clean.searchParams.delete("graduationYear");
    clean.searchParams.delete("graduationMonth");
    window.history.replaceState({}, "", clean.pathname + clean.search + clean.hash);
  }, []);

  return null;
}
