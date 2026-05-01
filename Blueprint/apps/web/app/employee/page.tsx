"use client";

import { useEffect, useState } from "react";
import { appPath } from "@/lib/apiBase";
import { getOrgAuthFromStorage, type OrgUser } from "@/lib/orgAuth";
import { EmployeeServicesHub } from "@/app/components/EmployeeServicesHub";

export default function EmployeeServicesPage() {
  const [{ token, user }, setAuth] = useState(() => getOrgAuthFromStorage());

  useEffect(() => {
    const on = () => setAuth(getOrgAuthFromStorage());
    window.addEventListener("jbv2-org-auth-changed", on);
    return () => window.removeEventListener("jbv2-org-auth-changed", on);
  }, []);

  useEffect(() => {
    if (!token) {
      window.location.href = appPath("/auth/employee/login");
      return;
    }
    const u = user as OrgUser | null;
    if (!u || u.accountType !== "EMPLOYEE") {
      window.location.href = appPath("/auth/employee/login");
      return;
    }
    if (u.currentRole === "MANAGER" || u.currentRole === "HR") {
      window.location.href = appPath("/dashboard/manager");
    }
  }, [token, user]);

  if (!token || !user) return null;
  if (user.accountType !== "EMPLOYEE") return null;
  if (user.currentRole === "MANAGER" || user.currentRole === "HR") return null;

  return <EmployeeServicesHub user={user} />;
}
