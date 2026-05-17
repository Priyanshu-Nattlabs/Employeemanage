/** Quick overlap check for Software Developer L2 vs Journalist L1 (run after backend is up). */
const API = process.env.API || "http://localhost:9081";

const CROSS_ROLE_GENERIC_SKILL_NAMES = new Set([
  "communication", "critical thinking", "adaptability", "time management", "teamwork",
  "problem solving", "problem-solving", "attention to detail", "integrity", "curiosity",
  "leadership", "collaboration", "interpersonal skills", "work ethic", "emotional intelligence", "creativity", "flexibility",
]);

function isGenericCrossRoleSkill(name) {
  const n = normSkill(name);
  if (!n) return false;
  if (CROSS_ROLE_GENERIC_SKILL_NAMES.has(n)) return true;
  return CROSS_ROLE_GENERIC_SKILL_NAMES.has(n.replace(/-/g, " "));
}

const SKILL_OVERLAP_STOPWORDS = new Set([
  "skills", "skill", "basic", "and", "the", "for", "with", "use", "using",
  "thinking", "tools", "tool", "development", "technical", "soft", "non",
  "communication", "management",
]);

const normSkill = (v) =>
  String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const skillTokens = (v) => new Set(normSkill(v).split(" ").filter(Boolean));

function significantTokenOverlapCount(a, b) {
  const sigTokens = (s) =>
    Array.from(skillTokens(normSkill(s))).filter((t) => t.length >= 4 && !SKILL_OVERLAP_STOPWORDS.has(t));
  const ta = sigTokens(a);
  const tb = new Set(sigTokens(b));
  let n = 0;
  for (const t of ta) if (tb.has(t)) n++;
  return n;
}

function skillsOverlapForRoles(targetSkill, baselineSkills, sameRoleCatalog) {
  const key = String(targetSkill || "").trim().toLowerCase();
  if (!key || !baselineSkills.length) return false;
  if (!sameRoleCatalog && isGenericCrossRoleSkill(targetSkill)) return false;
  for (const prev of baselineSkills) {
    const pk = String(prev || "").trim().toLowerCase();
    if (!pk) continue;
    if (pk === key) {
      if (!sameRoleCatalog && (isGenericCrossRoleSkill(targetSkill) || isGenericCrossRoleSkill(prev))) continue;
      return true;
    }
    if (sameRoleCatalog) continue;
    if (isGenericCrossRoleSkill(prev)) continue;
    if (significantTokenOverlapCount(targetSkill, prev) >= 2) return true;
    if (key.length >= 10 && pk.length >= 10 && (key.includes(pk) || pk.includes(key))) return true;
  }
  return false;
}

function skillNames(doc) {
  const req = (doc?.skillRequirements || []).map((s) => String(s?.skillName || "").trim()).filter(Boolean);
  const tech = (doc?.skills?.technical || []).map(String).filter(Boolean);
  const soft = (doc?.skills?.soft || []).map(String).filter(Boolean);
  return [...new Set([...req, ...tech, ...soft])];
}

async function main() {
  const baselineRole = "Software Developer";
  const baselineLevel = "2";
  const targetRole = "Journalist";
  const targetLevel = "1";

  const [baseRes, targetRes] = await Promise.all([
    fetch(`${API}/api/blueprint/role/${encodeURIComponent(baselineRole)}?level=${baselineLevel}`),
    fetch(`${API}/api/blueprint/role/${encodeURIComponent(targetRole)}?level=${targetLevel}`),
  ]);
  if (!baseRes.ok || !targetRes.ok) {
    console.error("API not reachable at", API, "status", baseRes.status, targetRes.status);
    process.exit(1);
  }
  const baseDoc = await baseRes.json();
  const targetDoc = await targetRes.json();
  const baselineSkills = skillNames(baseDoc);
  const targetSkills = skillNames(targetDoc);

  const overlaps = [];
  for (const skill of targetSkills) {
    if (skillsOverlapForRoles(skill, baselineSkills, false)) overlaps.push(skill);
  }

  console.log("Baseline skills:", baselineSkills.length);
  console.log("Target skills:", targetSkills.length);
  console.log("Cross-role overlaps:", overlaps.length ? overlaps : "(none)");
  console.log("noCommonSkillsWithProfile would be:", overlaps.length === 0 && baselineSkills.length > 0 && targetSkills.length > 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
