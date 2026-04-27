"use client";

export default function AdminRegisterDeprecated() {
  if (typeof window !== "undefined") {
    window.location.replace("/auth/manager/register");
  }
  return null;
}

