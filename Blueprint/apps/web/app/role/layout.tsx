"use client";

import { useEffect, useState } from "react";
import { getOrgAuthFromStorage } from "@/lib/orgAuth";

export default function RoleLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    setMounted(true);
    const sync = () => setToken(getOrgAuthFromStorage().token || "");
    sync();
    window.addEventListener("jbv2-org-auth-changed", sync);
    return () => window.removeEventListener("jbv2-org-auth-changed", sync);
  }, []);

  useEffect(() => {
    if (mounted && !token) {
      window.location.href = "/auth/login";
    }
  }, [mounted, token]);

  if (!mounted) return null;
  if (!token) return null;

  return <>{children}</>;
}

