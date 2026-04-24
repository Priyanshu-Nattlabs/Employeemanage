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

  const skillsByRole   = parseSkills(wb);
  const roles          = parseRoles(wb, skillsByRole);
  const industries     = parseIndustries(wb);
  const educations     = parseEducations(wb);
  const specializations = parseSpecializations(wb);

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

  // ── wipe existing data
  const before = await col.countDocuments();
  console.log(`🗑   Clearing ${before} existing documents…`);
  await col.deleteMany({});

  // ── insert all
  const all = [...industries, ...educations, ...specializations, ...roles];
  console.log(`📥  Inserting ${all.length} documents…`);
  const res = await col.insertMany(all, { ordered: false });
  console.log(`✅  Inserted ${res.insertedCount} documents`);

  // ── build indexes for fast lookup
  await col.createIndex({ type: 1 });
  await col.createIndex({ type: 1, name: 1 }, { unique: true });
  console.log("📑  Indexes created");

  // ── summary
  const counts = await col.aggregate([{ $group: { _id: "$type", n: { $sum: 1 } } }]).toArray();
  console.log("\n📊  Final counts in DB:");
  counts.forEach(c => console.log(`      ${c._id}: ${c.n}`));

  await client.close();
  console.log("\n🎉  Done!");
}

main().catch(err => { console.error("❌ ", err); process.exit(1); });
