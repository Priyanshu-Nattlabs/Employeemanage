"use client";

export default function AdminLoginDeprecated() {
  if (typeof window !== "undefined") {
    window.location.replace("/auth/manager/login");
  }
  return null;
}

