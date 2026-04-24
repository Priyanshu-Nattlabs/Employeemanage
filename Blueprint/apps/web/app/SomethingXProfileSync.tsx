"use client";

import { useEffect } from "react";
import { syncSomethingXProfileToJbv2 } from "@/lib/somethingxUserProfileSync";

/** After SSO, keeps JBV2 user_profiles in sync with SomethingX User (name, graduation, education, etc.). */
export function SomethingXProfileSync() {
  useEffect(() => {
    void syncSomethingXProfileToJbv2();
  }, []);
  return null;
}
