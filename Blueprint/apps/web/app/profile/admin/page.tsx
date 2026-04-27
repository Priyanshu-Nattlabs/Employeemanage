"use client";

export default function AdminProfileDeprecated() {
  if (typeof window !== "undefined") {
    window.location.replace("/profile/employee");
  }
  return null;
}

