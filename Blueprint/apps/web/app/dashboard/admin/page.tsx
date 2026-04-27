"use client";

export default function AdminDashboardDeprecated() {
  if (typeof window !== "undefined") {
    window.location.replace("/dashboard/manager");
  }
  return null;
}

