/**
 * Seed MongoDB from Job_Blueprint_Final_Phase13.xlsx
 * Parses all 5 sheets: Roles, Industries, Educations, Specializations, Skills
 */
import { readFileSync } from "fs";
import path from "path";
import { read, utils } from "xlsx";
import { MongoClient } from "mongodb";

const FILE_RAW = (process.env.BLUEPRINT_XLSX_FILE || "C:/Employee/JBV2/Job_Blueprint_Final_Phase13.xlsx").trim();
const FILE = path.isAbsolute(FILE_RAW) ? FILE_RAW : path.resolve(process.cwd(), FILE_RAW);
const MONGO = (process.env.MONGODB_URI || "mongodb://localhost:27017/job_blueprint_v2").trim();

// ── helpers ────────────────────────────────────────────────────────────────
const split = (val) =>
  String(val || "").split(",").map(s => s.trim()).filter(Boolean);

const importanceMap = { High: "Essential", Medium: "Important", Low: "Good to have" };
const toImportance  = (v) => importanceMap[v] || v || "Important";
const toType        = (v) => String(v || "").toLowerCase() === "soft" ? "non-technical" : "technical";
const toMonths      = (v) => Math.max(1, Number(v) || 1);

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
      skillName:          String(r[1] || "").trim(),
      skillType:          toType(r[2]),
      timeRequiredMonths: toMonths(r[3]),
      difficulty:         String(r[4] || "intermediate").toLowerCase(),
      importance:         toImportance(r[5]),
      description:        String(r[6] || "").trim(),
      prerequisites:      split(r[7]),
      isOptional:         String(r[8]).toLowerCase() === "true",
    });
  }
  return byRole;
}

// ── parse Roles sheet ──────────────────────────────────────────────────────
function parseRoles(wb, skillsByRole) {
  const rows = utils.sheet_to_json(wb.Sheets["Roles"], { header: 1, defval: "" });
  const docs = [];
  // row[0] = header, row[1] = junk "Role" row  → skip both
  for (const r of rows.slice(2)) {
    const name = String(r[0] || "").trim();
    if (!name || name === "Role") continue;

    const responsibilities = split(r[6]);
    const industries       = split(r[7]);
    const educations       = split(r[8]);
    const specializations  = split(r[9]);

    // Build jobDescription from Excel data
    const jobDescription = {
      summary:         String(r[2] || "").trim(),
      industry:        industries[0] || "",
      responsibilities: responsibilities.join("; "),
      requirements:    `Relevant education in ${educations.join(", ") || "applicable field"}`,
      expectedSalary:  String(r[5] || "").trim(),
    };

    const skillRequirements = (skillsByRole[name] || []).filter(s => s.skillName);

    docs.push({
      type:             "role",
      name,
      description:      String(r[2] || "").trim(),
      category:         String(r[3] || "Role").trim(),
      isActive:         String(r[4]).toLowerCase() !== "false",
      jobDescription,
      industries,
      educations,
      specializations,
      skillRequirements,
      skills: {
        technical: skillRequirements.filter(s => s.skillType === "technical").map(s => s.skillName),
        soft:      skillRequirements.filter(s => s.skillType === "non-technical").map(s => s.skillName),
      },
    });
  }
  return docs;
}

// ── parse NEW JD one-sheet format (Role, Level, Job description, ... ) ─────
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
    const level = levelRaw ? String(levelRaw) : undefined;
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

// ── parse Industries sheet ─────────────────────────────────────────────────
function parseIndustries(wb) {
  const rows = utils.sheet_to_json(wb.Sheets["Industries"], { header: 1, defval: "" });
  return rows.slice(1).map(r => ({
    type:        "industry",
    name:        String(r[0] || "").trim(),
    description: String(r[2] || "").trim(),
    roles:       split(r[3]),
    educations:  split(r[4]),
  })).filter(d => d.name);
}

// ── parse Educations sheet ─────────────────────────────────────────────────
function parseEducations(wb) {
  const rows = utils.sheet_to_json(wb.Sheets["Educations"], { header: 1, defval: "" });
  return rows.slice(1).map(r => ({
    type:            "education",
    name:            String(r[0] || "").trim(),
    description:     String(r[2] || "").trim(),
    specializations: split(r[3]),
    roles:           split(r[4]),
    industries:      split(r[5]),
  })).filter(d => d.name);
}

// ── parse Specializations sheet ────────────────────────────────────────────
function parseSpecializations(wb) {
  const rows = utils.sheet_to_json(wb.Sheets["Specializations"], { header: 1, defval: "" });
  return rows.slice(1).map(r => ({
    type:        "specialization",
    name:        String(r[0] || "").trim(),
    description: String(r[2] || "").trim(),
    category:    String(r[3] || "").trim(),
    roles:       split(r[4]),
    industries:  split(r[5]),
  })).filter(d => d.name);
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("📖  Reading Excel file…");
  const wb = read(readFileSync(FILE));

  const isNewJdSingleSheet = wb.SheetNames.length === 1 && /sheet1/i.test(wb.SheetNames[0]);
  const firstRows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  const firstHeader = (firstRows[0] || []).map((x) => String(x || "").trim().toLowerCase());
  const looksLikeNewJd = firstHeader.includes("role") && firstHeader.includes("level") && firstHeader.includes("technical skills");

  const skillsByRole   = !isNewJdSingleSheet ? parseSkills(wb) : {};
  const roles          = isNewJdSingleSheet || looksLikeNewJd ? parseRolesFromNewJdSheet(wb) : parseRoles(wb, skillsByRole);
  const industries     = !isNewJdSingleSheet ? parseIndustries(wb) : [];
  const educations     = !isNewJdSingleSheet ? parseEducations(wb) : [];
  const specializations = !isNewJdSingleSheet ? parseSpecializations(wb) : [];

  console.log(`✅  Parsed:`);
  console.log(`      Roles:           ${roles.length}`);
  console.log(`      Industries:      ${industries.length}`);
  console.log(`      Educations:      ${educations.length}`);
  console.log(`      Specializations: ${specializations.length}`);
  const totalSkills = roles.reduce((s, r) => s + (r.skillRequirements?.length || 0), 0);
  console.log(`      Skill entries:   ${totalSkills}`);

  // ── verify no empty role names
  const unnamed = roles.filter(r => !r.name);
  if (unnamed.length) console.warn(`⚠️   ${unnamed.length} roles without a name — skipped`);

  // ── connect to MongoDB
  console.log(`\n🔌  Connecting to ${MONGO}…`);
  const client = new MongoClient(MONGO);
  await client.connect();
  const db  = client.db();
  const col = db.collection("blueprints");

  if (isNewJdSingleSheet || looksLikeNewJd) {
    console.log("♻️   NEW JD mode detected: upserting role documents only (no full wipe).");
    // Migrate legacy unique index so role+level variants can co-exist.
    try {
      await col.dropIndex("type_1_name_1");
    } catch {}
    await col.createIndex({ type: 1, name: 1, level: 1 }, { unique: true });

    let upserts = 0;
    for (const roleDoc of roles) {
      const roleLevelKey = String(roleDoc.level || "").trim();
      const r = await col.updateOne(
        { type: "role", name: roleDoc.name, level: roleLevelKey },
        { $set: roleDoc },
        { upsert: true }
      );
      if (r.upsertedCount || r.modifiedCount) upserts++;
    }
    console.log(`✅  Upserted/updated ${upserts} role documents`);
  } else {
    // ── wipe existing data
    const before = await col.countDocuments();
    console.log(`🗑   Clearing ${before} existing documents…`);
    await col.deleteMany({});

    // ── insert all
    const all = [...industries, ...educations, ...specializations, ...roles];
    console.log(`📥  Inserting ${all.length} documents…`);
    const res = await col.insertMany(all, { ordered: false });
    console.log(`✅  Inserted ${res.insertedCount} documents`);
  }

  // ── build indexes for fast lookup
  await col.createIndex({ type: 1 });
  await col.createIndex({ type: 1, name: 1, level: 1 }, { unique: true });
  console.log("📑  Indexes created");

  // ── summary
  const counts = await col.aggregate([{ $group: { _id: "$type", n: { $sum: 1 } } }]).toArray();
  console.log("\n📊  Final counts in DB:");
  counts.forEach(c => console.log(`      ${c._id}: ${c.n}`));

  await client.close();
  console.log("\n🎉  Done!");
}

main().catch(err => { console.error("❌ ", err); process.exit(1); });
