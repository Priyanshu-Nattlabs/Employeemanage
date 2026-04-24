"use client";
import { useEffect, useState } from "react";

import { getApiPrefix } from "@/lib/apiBase";
import { syncSomethingXProfileToJbv2 } from "@/lib/somethingxUserProfileSync";

const API = getApiPrefix();

type Profile = {
  userId: string;
  fullName?: string;
  email?: string;
  education?: string;
  expectedGraduationYear?: string;
  expectedGraduationMonth?: string;
  studentRollNumber?: string;
};

export default function ProfilePage() {
  const [userId, setUserId] = useState("demo-student-1");
  const [profile, setProfile] = useState<Profile>({ userId: "demo-student-1" });
  const [saved, setSaved] = useState("");
  const monthOptions = [
    { v: "1", label: "January" },
    { v: "2", label: "February" },
    { v: "3", label: "March" },
    { v: "4", label: "April" },
    { v: "5", label: "May" },
    { v: "6", label: "June" },
    { v: "7", label: "July" },
    { v: "8", label: "August" },
    { v: "9", label: "September" },
    { v: "10", label: "October" },
    { v: "11", label: "November" },
    { v: "12", label: "December" },
  ];

  useEffect(() => {
    const fromLocal = localStorage.getItem("jbv2_userId");
    const uid = fromLocal || "demo-student-1";
    setUserId(uid);
    load(uid);
  }, []);

  const load = async (uid: string) => {
    await syncSomethingXProfileToJbv2({ force: true });
    const res = await fetch(`${API}/api/user-profile/${encodeURIComponent(uid)}`);
    const data = await res.json().catch(() => null);
    setProfile({ userId: uid, ...(data || {}) });
    if (data?.expectedGraduationYear) localStorage.setItem("jbv2_expectedGraduationYear", String(data.expectedGraduationYear));
    if (data?.expectedGraduationMonth) localStorage.setItem("jbv2_expectedGraduationMonth", String(data.expectedGraduationMonth));
  };

  const save = async () => {
    localStorage.setItem("jbv2_userId", userId);
    localStorage.setItem("jbv2_profileUpdatedAt", String(Date.now()));
    localStorage.setItem("jbv2_expectedGraduationYear", String(profile.expectedGraduationYear || ""));
    localStorage.setItem("jbv2_expectedGraduationMonth", String(profile.expectedGraduationMonth || ""));
    const res = await fetch(`${API}/api/user-profile/${encodeURIComponent(userId)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...profile, userId })
    });
    const data = await res.json();
    setProfile(data);
    setSaved("Profile saved");
    setTimeout(() => setSaved(""), 1500);
  };

  const remainingMonthsPreview = (() => {
    const y = Number(profile.expectedGraduationYear || "");
    const m = Number(profile.expectedGraduationMonth || "");
    if (!y || Number.isNaN(y)) return "Set graduation year/month to personalize chart duration.";
    const month = m >= 1 && m <= 12 ? m : 6;
    const now = new Date();
    const grad = new Date(y, month - 1, 1);
    const diff = (grad.getFullYear() - now.getFullYear()) * 12 + (grad.getMonth() - now.getMonth());
    const remaining = diff <= 0 ? 3 : Math.min(60, diff);
    return `Estimated months remaining for preparation: ${remaining}`;
  })();

  return (
    <main style={{ maxWidth: 700 }}>
      <h1>Your profile</h1>
      <p>
        When you sign in from SomethingX, your name, graduation date, and education are synced automatically. You can
        adjust values below; they are stored for Job Blueprint charts and preparation.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        <label>User ID <input value={userId} onChange={(e) => setUserId(e.target.value)} /></label>
        <button onClick={() => load(userId)}>Load Profile</button>
        <label>Full Name <input value={profile.fullName || ""} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></label>
        <label>Email <input value={profile.email || ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
        <label>Education <input value={profile.education || ""} onChange={(e) => setProfile({ ...profile, education: e.target.value })} /></label>
        <label>
          Student / roll ID
          <input value={profile.studentRollNumber || ""} onChange={(e) => setProfile({ ...profile, studentRollNumber: e.target.value })} />
        </label>
        <label>
          Graduation Year
          <input
            type="number"
            min={new Date().getFullYear() - 1}
            max={new Date().getFullYear() + 10}
            value={profile.expectedGraduationYear || ""}
            onChange={(e) => setProfile({ ...profile, expectedGraduationYear: e.target.value })}
          />
        </label>
        <label>
          Graduation Month
          <select
            value={profile.expectedGraduationMonth || ""}
            onChange={(e) => setProfile({ ...profile, expectedGraduationMonth: e.target.value })}
          >
            <option value="">Select month</option>
            {monthOptions.map((mo) => (
              <option key={mo.v} value={mo.v}>
                {mo.label}
              </option>
            ))}
          </select>
        </label>
        <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{remainingMonthsPreview}</p>
        <button onClick={save}>Save Profile</button>
        {saved && <p>{saved}</p>}
      </div>
    </main>
  );
}

