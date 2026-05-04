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

function rowLooksLikeNewJdHeader(cells) {
  const hdr = (cells || []).map(normalizeHeaderCell);
  const hasRole = hdr.includes("role") || hdr.includes("function");
  const hasLevel = hdr.includes("level");
  const hasBody =
    hdr.includes("job description") ||
    hdr.includes("description") ||
    hdr.includes("technical skills") ||
    hdr.includes("technical skill");
  return hasRole && hasLevel && hasBody;
}

function detectWorkbookFormat(wb) {
  const lower = wb.SheetNames.map((n) => String(n).trim().toLowerCase());
  if (lower.includes("roles") && lower.includes("skills")) return "phase13";

  for (const name of wb.SheetNames) {
    const rows = utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      if (rowLooksLikeNewJdHeader(rows[i])) return "newjd";
    }
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

/** Excel often puts BOM on A1; NBSP appears in pasted headers — normalize for reliable column lookup. */
const normalizeHeaderCell = (s) =>
  String(s ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\u00A0/g, " ")
    .trim()
    .toLowerCase();

const headerIndexMap = (row = []) => {
  const m = new Map();
  row.forEach((h, i) => {
    const key = normalizeHeaderCell(h);
    if (!key) return;
    m.set(key, i);
    const simple = key.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (simple && simple !== key) m.set(simple, i);
  });
  return m;
};

const col =
  (idx) =>
  (...names) => {
    for (const n of names) {
      const j = idx.get(n);
      if (j !== undefined) return j;
    }
    return undefined;
  };

// ── parse Skills sheet ─────────────────────────────────────────────────────
function parseSkills(wb) {
  const rows = utils.sheet_to_json(wb.Sheets["Skills"], { header: 1, defval: "" });
  const byRole = {};
  for (const r of rows.slice(1)) {
    const roleName = String(r[0] || "")
      .replace(/^\uFEFF/, "")
      .trim();
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
const stripDataCell = (v) => String(v ?? "").replace(/^\uFEFF/, "").trim();

function parseRoles(wb, skillsByRole) {
  const rows = utils.sheet_to_json(wb.Sheets["Roles"], { header: 1, defval: "" });
  if (!rows.length) return [];

  let headerRow = -1;
  let idx = null;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const m = headerIndexMap(rows[i]);
    const get = col(m);
    const iName = get("name", "role", "function");
    if (iName === undefined) continue;
    let score = 1;
    if (get("description", "summary") !== undefined) score++;
    if (get("category", "type") !== undefined) score++;
    if (get("key responsibilities", "responsibilities", "industries", "isactive") !== undefined) score++;
    if (score >= 2) {
      headerRow = i;
      idx = m;
      break;
    }
  }

  if (headerRow >= 0 && idx) {
    const get = col(idx);
    const iName = get("name", "role", "function");
    const iDesc = get("description", "summary");
    const iCategory = get("category");
    const iActive = get("isactive", "active");
    const iSalary = get("expected salary", "expected sallary", "expected_salary");
    const iResp = get("key responsibilities", "responsibilities");
    const iInd = get("industries", "industry");
    const iEdu = get("educations", "education");
    const iSpec = get("specializations", "specialization");

    const docs = [];
    for (const r of rows.slice(headerRow + 1)) {
      const name = stripDataCell(r[iName]);
      if (!name || /^role$/i.test(name) || /^function$/i.test(name)) continue;

      const responsibilities = split(iResp !== undefined ? r[iResp] : "");
      const industries = split(iInd !== undefined ? r[iInd] : "");
      const educations = split(iEdu !== undefined ? r[iEdu] : "");
      const specializations = split(iSpec !== undefined ? r[iSpec] : "");

      const descText = iDesc !== undefined ? stripDataCell(r[iDesc]) : "";
      const categoryStr = iCategory !== undefined ? stripDataCell(r[iCategory]) : "Role";
      const isActiveVal =
        iActive !== undefined ? String(r[iActive]).toLowerCase() !== "false" : true;

      const jobDescription = {
        summary: descText,
        industry: industries[0] || "",
        responsibilities: responsibilities.length ? responsibilities.join("; ") : descText,
        requirements: `Relevant education in ${educations.join(", ") || "applicable field"}`,
        expectedSalary: iSalary !== undefined ? stripDataCell(r[iSalary]) : "",
      };

      const skillRequirements = (skillsByRole[name] || []).filter((s) => s.skillName);

      docs.push({
        type: "role",
        name,
        level: "",
        description: descText,
        category: categoryStr || "Role",
        isActive: isActiveVal,
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

  // Legacy Phase13 layout: two leading rows, then fixed columns (name, …, responsibilities…).
  const docs = [];
  for (const r of rows.slice(2)) {
    const name = stripDataCell(r[0]);
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
function findNewJdHeaderContext(wb) {
  for (const sheetName of wb.SheetNames) {
    const rows = utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      if (rowLooksLikeNewJdHeader(rows[i])) return { sheetName, rows, headerRow: i };
    }
  }
  return null;
}

function parseRolesFromNewJdSheet(wb) {
  const ctx = findNewJdHeaderContext(wb);
  if (!ctx) return [];
  const { rows, headerRow, sheetName } = ctx;
  console.log(`      NEW JD: sheet "${sheetName}", header row ${headerRow + 1}`);
  const idx = headerIndexMap(rows[headerRow]);
  const get = col(idx);
  const iRole = get("role", "function");
  const iLevel = get("level");
  const iDesc = get("job description", "description", "jd", "job summary");
  const iSalary = get("expected sallary", "expected salary", "expected_salary");
  const iTech = get("technical skills", "technical skill", "hard skills");
  const iSoft = get("soft skills", "soft skill", "behavioral skills");
  if (iRole === undefined) return [];

  const docs = [];
  for (const r of rows.slice(headerRow + 1)) {
    const name = stripDataCell(r[iRole]);
    if (!name) continue;
    const levelRaw = iLevel !== undefined ? stripDataCell(r[iLevel]) : "";
    // Normalize empty/blank level to empty string so unique index key stays stable.
    const level = levelRaw ? String(levelRaw) : "";
    const desc = iDesc !== undefined ? stripDataCell(r[iDesc]) : "";
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
