/**
 * Seed MongoDB from Excel blueprint sources.
 *
 * Phase13 workbook: sheets Roles, Skills, Industries, Educations, Specializations (full catalog — replaces blueprints collection).
 * NEW JD workbook: one sheet with Role, Level, Job description, Technical/Soft skills (upserts roles by name+level).
 *
 * Env:
 *   MONGODB_URI              — default mongodb://localhost:27017/job_blueprint_v2
 *   BLUEPRINT_SEED_SOURCES   — comma-separated paths (first wins Phase13 full seed; NEW JD files upsert). Docker: /app/...
 *   BLUEPRINT_XLSX_FILE      — single file (backward compatible)
 *
 * Defaults (run from apps/api): ../../Job_Blueprint_Final_Phase13.xlsx then ../../NEW JD 123.xlsx (if missing, ../../NEW JD.xlsx).
 * One-command NEW JD only: from Blueprint repo root run `npm run seed:new-jd` (see scripts/seed-new-jd-workbook.mjs).
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { read, utils } from "xlsx";
import { MongoClient } from "mongodb";

const MONGO = (process.env.MONGODB_URI || "mongodb://localhost:27017/job_blueprint_v2").trim();

// ── path resolution (repo root, Docker /app, or cwd) ─────────────────────────
function resolveSeedPath(raw) {
  const r = String(raw || "").trim();
  if (!r) return null;
  if (path.isAbsolute(r)) return path.normalize(r);
  const candidates = [
    path.resolve(process.cwd(), r),
    path.resolve(process.cwd(), "..", "..", r),
    path.resolve(process.cwd(), "..", "..", "..", r),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return path.resolve(process.cwd(), r);
}

function getSeedFileList() {
  const env = (process.env.BLUEPRINT_SEED_SOURCES || "").trim();
  if (env) {
    return env
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(resolveSeedPath);
  }
  const single = (process.env.BLUEPRINT_XLSX_FILE || "").trim();
  if (single) return [resolveSeedPath(single)];
  const phase13 = resolveSeedPath("../../Job_Blueprint_Final_Phase13.xlsx");
  const jd123 = resolveSeedPath("../../NEW JD 123.xlsx");
  const jdLegacy = resolveSeedPath("../../NEW JD.xlsx");
  const newJd = existsSync(jd123) ? jd123 : jdLegacy;
  return [phase13, newJd];
}

function detectWorkbookFormat(wb) {
  const lower = wb.SheetNames.map((n) => String(n).trim().toLowerCase());
  if (lower.includes("roles") && lower.includes("skills")) return "phase13";

  const sh0 = wb.Sheets[wb.SheetNames[0]];
  const firstRows = utils.sheet_to_json(sh0, { header: 1, defval: "" });
  const firstHeader = (firstRows[0] || []).map((x) => String(x || "").trim().toLowerCase());
  const looksLikeNewJd =
    firstHeader.includes("role") &&
    firstHeader.includes("level") &&
    (firstHeader.includes("technical skills") || firstHeader.includes("job description"));
  if (looksLikeNewJd) return "newjd";

  if (wb.SheetNames.length === 1 && /sheet1/i.test(wb.SheetNames[0])) {
    if (firstHeader.includes("role") && firstHeader.includes("job description")) return "newjd";
  }

  return "phase13";
}

// ── helpers ────────────────────────────────────────────────────────────────
const split = (val) =>
  String(val || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const importanceMap = { High: "Essential", Medium: "Important", Low: "Good to have" };
const toImportance = (v) => importanceMap[v] || v || "Important";
const toType = (v) => (String(v || "").toLowerCase() === "soft" ? "non-technical" : "technical");
const toMonths = (v) => Math.max(1, Number(v) || 1);

const headerIndexMap = (row = []) => {
  const m = new Map();
  row.forEach((h, i) => m.set(String(h || "").trim().toLowerCase(), i));
  return m;
};

// ── parse Skills sheet ─────────────────────────────────────────────────────
function parseSkills(wb) {
  const rows = utils.sheet_to_json(wb.Sheets["Skills"], { header: 1, defval: "" });
  const byRole = {};
  for (const r of rows.slice(1)) {
    const roleName = String(r[0] || "").trim();
    if (!roleName) continue;
    if (!byRole[roleName]) byRole[roleName] = [];
    byRole[roleName].push({
      skillName: String(r[1] || "").trim(),
      skillType: toType(r[2]),
      timeRequiredMonths: toMonths(r[3]),
      difficulty: String(r[4] || "intermediate").toLowerCase(),
      importance: toImportance(r[5]),
      description: String(r[6] || "").trim(),
      prerequisites: split(r[7]),
      isOptional: String(r[8]).toLowerCase() === "true",
    });
  }
  return byRole;
}

// ── parse Roles sheet ──────────────────────────────────────────────────────
function parseRoles(wb, skillsByRole) {
  const rows = utils.sheet_to_json(wb.Sheets["Roles"], { header: 1, defval: "" });
  const docs = [];
  for (const r of rows.slice(2)) {
    const name = String(r[0] || "").trim();
    if (!name || name === "Role") continue;

    const responsibilities = split(r[6]);
    const industries = split(r[7]);
    const educations = split(r[8]);
    const specializations = split(r[9]);

    const jobDescription = {
      summary: String(r[2] || "").trim(),
      industry: industries[0] || "",
      responsibilities: responsibilities.join("; "),
      requirements: `Relevant education in ${educations.join(", ") || "applicable field"}`,
      expectedSalary: String(r[5] || "").trim(),
    };

    const skillRequirements = (skillsByRole[name] || []).filter((s) => s.skillName);

    docs.push({
      type: "role",
      name,
      /** Align with NEW JD upserts: unique index { type, name, level } */
      level: "",
      description: String(r[2] || "").trim(),
      category: String(r[3] || "Role").trim(),
      isActive: String(r[4]).toLowerCase() !== "false",
      jobDescription,
      industries,
      educations,
      specializations,
      skillRequirements,
      skills: {
        technical: skillRequirements.filter((s) => s.skillType === "technical").map((s) => s.skillName),
        soft: skillRequirements.filter((s) => s.skillType === "non-technical").map((s) => s.skillName),
      },
    });
  }
  return docs;
}

// ── parse NEW JD one-sheet format ───────────────────────────────────────────
function parseRolesFromNewJdSheet(wb) {
  const sheetName = wb.SheetNames[0];
  const rows = utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
  if (!rows.length) return [];
  const idx = headerIndexMap(rows[0]);
  const iRole = idx.get("role");
  const iLevel = idx.get("level");
  const iDesc = idx.get("job description");
  const iSalary = idx.get("expected sallary") ?? idx.get("expected salary");
  const iTech = idx.get("technical skills");
  const iSoft = idx.get("soft skills");
  if (iRole === undefined || iDesc === undefined) return [];

  const docs = [];
  for (const r of rows.slice(1)) {
    const name = String(r[iRole] || "").trim();
    if (!name) continue;
    const levelRaw = iLevel !== undefined ? String(r[iLevel] ?? "").trim() : "";
    // Normalize empty/blank level to empty string so unique index key stays stable.
    const level = levelRaw ? String(levelRaw) : "";
    const desc = String(r[iDesc] || "").trim();
    const tech = split(iTech !== undefined ? r[iTech] : "");
    const soft = split(iSoft !== undefined ? r[iSoft] : "");
    const allSkills = [
      ...tech.map((s) => ({
        skillName: s,
        skillType: "technical",
        timeRequiredMonths: 2,
        difficulty: "intermediate",
        importance: "Important",
        description: "Role-relevant technical competency.",
        prerequisites: [],
        isOptional: false,
      })),
      ...soft.map((s) => ({
        skillName: s,
        skillType: "non-technical",
        timeRequiredMonths: 1,
        difficulty: "beginner",
        importance: "Important",
        description: "Role-relevant behavioral competency.",
        prerequisites: [],
        isOptional: false,
      })),
    ];
    docs.push({
      type: "role",
      name,
      level,
      description: desc,
      category: "Role",
      isActive: true,
      jobDescription: {
        summary: desc,
        industry: "",
        responsibilities: desc,
        requirements: "Relevant role-specific practical skillset",
        expectedSalary: iSalary !== undefined ? String(r[iSalary] || "").trim() : "",
      },
      industries: [],
      educations: [],
      specializations: [],
      skillRequirements: allSkills,
      skills: {
        technical: tech,
        soft,
      },
    });
  }
  return docs;
}

// ── parse Industries / Educations / Specializations ─────────────────────────
function parseIndustries(wb) {
  const rows = utils.sheet_to_json(wb.Sheets["Industries"], { header: 1, defval: "" });
  return rows
    .slice(1)
    .map((r) => ({
      type: "industry",
      name: String(r[0] || "").trim(),
      description: String(r[2] || "").trim(),
      roles: split(r[3]),
      educations: split(r[4]),
    }))
    .filter((d) => d.name);
}

function parseEducations(wb) {
  const rows = utils.sheet_to_json(wb.Sheets["Educations"], { header: 1, defval: "" });
  return rows
    .slice(1)
    .map((r) => ({
      type: "education",
      name: String(r[0] || "").trim(),
      description: String(r[2] || "").trim(),
      specializations: split(r[3]),
      roles: split(r[4]),
      industries: split(r[5]),
    }))
    .filter((d) => d.name);
}

function parseSpecializations(wb) {
  const rows = utils.sheet_to_json(wb.Sheets["Specializations"], { header: 1, defval: "" });
  return rows
    .slice(1)
    .map((r) => ({
      type: "specialization",
      name: String(r[0] || "").trim(),
      description: String(r[2] || "").trim(),
      category: String(r[3] || "").trim(),
      roles: split(r[4]),
      industries: split(r[5]),
    }))
    .filter((d) => d.name);
}

// ── seed operations ─────────────────────────────────────────────────────────
async function seedPhase13Full(wb, col) {
  const skillsByRole = parseSkills(wb);
  const roles = parseRoles(wb, skillsByRole);
  const industries = parseIndustries(wb);
  const educations = parseEducations(wb);
  const specializations = parseSpecializations(wb);

  console.log(`✅  Parsed Phase13:`);
  console.log(`      Roles:           ${roles.length}`);
  console.log(`      Industries:      ${industries.length}`);
  console.log(`      Educations:      ${educations.length}`);
  console.log(`      Specializations: ${specializations.length}`);
  const totalSkills = roles.reduce((s, r) => s + (r.skillRequirements?.length || 0), 0);
  console.log(`      Skill entries:   ${totalSkills}`);

  const unnamed = roles.filter((r) => !r.name);
  if (unnamed.length) console.warn(`⚠️   ${unnamed.length} roles without a name — skipped`);

  const before = await col.countDocuments();
  console.log(`🗑   Clearing ${before} existing blueprint documents…`);
  await col.deleteMany({});

  const all = [...industries, ...educations, ...specializations, ...roles];
  console.log(`📥  Inserting ${all.length} documents…`);
  const res = await col.insertMany(all, { ordered: false });
  console.log(`✅  Inserted ${res.insertedCount} documents`);
}

async function seedNewJdUpsert(wb, col) {
  console.log("♻️   NEW JD: upserting role documents…");
  try {
    await col.dropIndex("type_1_name_1");
  } catch {
    /* legacy */
  }

  const roles = parseRolesFromNewJdSheet(wb);
  console.log(`      Roles parsed: ${roles.length}`);
  let upserts = 0;
  for (const roleDoc of roles) {
    const roleLevelKey = String(roleDoc.level ?? "").trim();
    const r = await col.updateOne(
      { type: "role", name: roleDoc.name, level: roleLevelKey },
      { $set: roleDoc },
      { upsert: true },
    );
    if (r.upsertedCount || r.modifiedCount) upserts++;
  }
  console.log(`✅  Upserted/updated ${upserts} NEW JD role documents`);
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  const files = getSeedFileList();
  if (!files.length) throw new Error("No seed files configured.");

  console.log("📄  Resolved seed files:");
  files.forEach((f) => console.log(`      • ${f}`));

  for (const f of files) {
    if (!existsSync(f)) {
      throw new Error(`Seed file not found: ${f}\nFix BLUEPRINT_SEED_SOURCES paths or place xlsx next to the Blueprint repo root.`);
    }
  }

  console.log(`\n🔌  Connecting to ${MONGO}…`);
  const client = new MongoClient(MONGO);
  await client.connect();
  const col = client.db().collection("blueprints");

  let phase13Done = false;
  for (const filePath of files) {
    console.log(`\n📖  Reading ${path.basename(filePath)}…`);
    const wb = read(readFileSync(filePath));
    const fmt = detectWorkbookFormat(wb);
    console.log(`      Detected format: ${fmt}`);

    if (fmt === "phase13") {
      if (phase13Done) {
        console.warn("⚠️   Skipping duplicate Phase13 workbook (catalog already seeded).");
        continue;
      }
      await seedPhase13Full(wb, col);
      phase13Done = true;
    } else {
      await seedNewJdUpsert(wb, col);
    }
  }

  await col.createIndex({ type: 1 });
  try {
    await col.createIndex({ type: 1, name: 1, level: 1 }, { unique: true });
  } catch (e) {
    console.warn("📑  Index:", e.message || e);
  }
  console.log("📑  Indexes ensured");

  const counts = await col.aggregate([{ $group: { _id: "$type", n: { $sum: 1 } } }]).toArray();
  console.log("\n📊  Final counts in DB:");
  counts.forEach((c) => console.log(`      ${c._id}: ${c.n}`));

  await client.close();
  console.log("\n🎉  Done!");
}

main().catch((err) => {
  console.error("❌ ", err);
  process.exit(1);
});
