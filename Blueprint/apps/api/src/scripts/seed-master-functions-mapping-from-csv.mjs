/**
 * Seed `company_org_structures` from the master industry/department → role CSV.
 *
 * Source file (default): `Master_functions_mapping(Legal Functions Mapping (2)).csv`
 * Columns: `Industry - Department`, `Role`
 *
 * Layout (same idea as Department role mapping): row 1 = headers; col1 = industry–department
 * bucket, col2 = role title. Rows are grouped by col1; each group becomes one `departments[]`
 * entry with `name` = that column and `roles` = role names for that department.
 *
 * By default, **only roles that exist in MongoDB** (`blueprints` collection, `type: "role"`) are
 * kept—same behaviour as `seed-org-structure-from-xlsx.mjs` with `ORG_STRUCTURE_VALIDATE_ROLES`.
 * Stored role strings use the **canonical name** from the blueprint document (exact DB spelling).
 *
 * Section template rows like `BFSI -  Function,Role` are skipped (role cell is literally "Role").
 *
 * Env:
 *   MONGODB_URI                         — default mongodb://localhost:27017/job_blueprint_v2
 *   ORG_STRUCTURE_COMPANY_DOMAIN        — required (e.g. nattlabs.com), same as org-structure seed
 *   ORG_STRUCTURE_COMPANY_NAME          — optional
 *   ORG_STRUCTURE_SETUP_BY_EMAIL        — optional
 *   ORG_STRUCTURE_SETUP_BY_NAME         — optional
 *   MASTER_FUNCTIONS_CSV_FILE           — optional path to CSV (default: ../../Master_functions_mapping(Legal Functions Mapping (2)).csv)
 *   MASTER_FUNCTIONS_MERGE              — optional, default "true". When true, merges roles into existing org structure by department name; when false, replaces `departments` entirely with CSV data.
 *   ORG_STRUCTURE_VALIDATE_ROLES        — optional, default "true". When not "false", intersects CSV roles with `blueprints` (same as Department role mapping seed).
 *   MASTER_FUNCTIONS_VALIDATE_ROLES     — optional; if set, overrides ORG_STRUCTURE_VALIDATE_ROLES for this script only.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { MongoClient } from "mongodb";

const MONGO = (process.env.MONGODB_URI || "mongodb://localhost:27017/job_blueprint_v2").trim();

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

function normalizeDomain(domain) {
  return String(domain || "").trim().toLowerCase().replace(/^@/, "");
}

function uniqSorted(list) {
  return Array.from(new Set(list.map((x) => String(x || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

/** Minimal CSV row parser (handles quoted fields with commas). */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => String(s || "").trim());
}

function isHeaderRow(cols) {
  const a = String(cols[0] || "").toLowerCase();
  const b = String(cols[1] || "").toLowerCase();
  return a.includes("industry") && a.includes("department") && b === "role";
}

function shouldSkipRow(deptKey, roleName) {
  if (!deptKey || !roleName) return true;
  if (roleName.trim().toLowerCase() === "role") return true;
  return false;
}

function parseMasterFunctionsCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  const byDept = new Map();
  for (const line of lines) {
    const cols = parseCsvLine(line);
    if (cols.length < 2) continue;
    if (isHeaderRow(cols)) continue;

    const deptKey = String(cols[0] || "").replace(/\s+/g, " ").trim();
    const roleName = String(cols[1] || "").replace(/\s+/g, " ").trim();
    if (shouldSkipRow(deptKey, roleName)) continue;

    if (!byDept.has(deptKey)) byDept.set(deptKey, []);
    byDept.get(deptKey).push(roleName);
  }

  const departments = [];
  for (const [name, roles] of byDept.entries()) {
    const u = uniqSorted(roles);
    if (!name || !u.length) continue;
    departments.push({ name, roles: u });
  }

  departments.sort((a, b) => a.name.localeCompare(b.name));
  return departments;
}

/** lowercased role name -> canonical `name` from blueprints (for stable org-structure strings). */
async function fetchBlueprintRoleCanonicalByLower(db) {
  const col = db.collection("blueprints");
  const docs = await col.find({ type: "role" }, { projection: { name: 1 } }).toArray();
  const map = new Map();
  for (const d of docs) {
    const n = String(d?.name || "").trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (!map.has(key)) map.set(key, n);
  }
  return map;
}

function mergeDepartments(existingList, incomingList) {
  const byName = new Map();
  for (const d of existingList || []) {
    const name = String(d?.name || "").replace(/\s+/g, " ").trim();
    if (!name) continue;
    const set = new Set((d.roles || []).map((r) => String(r || "").trim()).filter(Boolean));
    byName.set(name, set);
  }
  for (const d of incomingList || []) {
    const name = String(d?.name || "").replace(/\s+/g, " ").trim();
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, new Set());
    const set = byName.get(name);
    for (const r of d.roles || []) {
      const rr = String(r || "").trim();
      if (rr) set.add(rr);
    }
  }
  return Array.from(byName.entries())
    .map(([name, set]) => ({ name, roles: Array.from(set).sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const companyDomain = normalizeDomain(process.env.ORG_STRUCTURE_COMPANY_DOMAIN);
  if (!companyDomain) {
    throw new Error("Missing ORG_STRUCTURE_COMPANY_DOMAIN (example: nattlabs.com)");
  }

  const defaultCsv = "../../Master_functions_mapping(Legal Functions Mapping (2)).csv";
  const csvPath = resolveSeedPath(process.env.MASTER_FUNCTIONS_CSV_FILE || defaultCsv);
  if (!csvPath || !existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}\nSet MASTER_FUNCTIONS_CSV_FILE or place the file under Blueprint/.`);
  }

  const merge = String(process.env.MASTER_FUNCTIONS_MERGE ?? "true").trim().toLowerCase() !== "false";
  const validateRaw =
    process.env.MASTER_FUNCTIONS_VALIDATE_ROLES !== undefined && process.env.MASTER_FUNCTIONS_VALIDATE_ROLES !== ""
      ? process.env.MASTER_FUNCTIONS_VALIDATE_ROLES
      : process.env.ORG_STRUCTURE_VALIDATE_ROLES ?? "true";
  const validateRoles = String(validateRaw).trim().toLowerCase() !== "false";

  console.log("📄  Master functions mapping seed:");
  console.log(`      • ${csvPath}`);
  console.log(`      • companyDomain=${companyDomain}`);
  console.log(`      • merge=${merge}`);
  console.log(`      • validateRoles=${validateRoles} (intersect with blueprints type=role)`);

  console.log(`\n🔌  Connecting to ${MONGO}…`);
  const client = new MongoClient(MONGO);
  await client.connect();
  const db = client.db();
  const col = db.collection("company_org_structures");

  const raw = readFileSync(csvPath, "utf8");
  let departments = parseMasterFunctionsCsv(raw);

  if (validateRoles) {
    console.log("🔎  Validating mapped roles against blueprint catalog (same as Department role mapping)…");
    const roleByLower = await fetchBlueprintRoleCanonicalByLower(db);
    const missing = new Map(); // roleLower -> { role, depts:Set }

    departments = departments
      .map((d) => {
        const kept = [];
        for (const role of d.roles || []) {
          const key = String(role || "").trim().toLowerCase();
          if (!key) continue;
          const canonical = roleByLower.get(key);
          if (canonical) {
            kept.push(canonical);
          } else {
            const cur = missing.get(key) || { role: String(role).trim(), depts: new Set() };
            cur.depts.add(d.name);
            missing.set(key, cur);
          }
        }
        return { ...d, roles: uniqSorted(kept) };
      })
      .filter((d) => d.roles.length > 0);

    if (missing.size) {
      console.log(`⚠️   Roles present in CSV but NOT found in blueprints catalog: ${missing.size}`);
      const sample = Array.from(missing.values())
        .slice(0, 25)
        .map((m) => `      - ${m.role}  (Industry–Department: ${Array.from(m.depts).join(", ")})`);
      sample.forEach((l) => console.log(l));
      if (missing.size > 25) console.log(`      ... and ${missing.size - 25} more`);
    } else {
      console.log("✅  All CSV roles that survived grouping exist in blueprint catalog");
    }
  }

  console.log(`✅  Department groups after CSV parse${validateRoles ? " + blueprint filter" : ""}: ${departments.length}`);
  const roleCount = departments.reduce((s, d) => s + (d.roles?.length || 0), 0);
  console.log(`✅  Total mapped role entries: ${roleCount}`);

  if (!departments.length) {
    throw new Error(
      validateRoles
        ? "No departments left after blueprint validation. Seed blueprints first (e.g. Job_Blueprint_Final_Phase13.xlsx) or set ORG_STRUCTURE_VALIDATE_ROLES=false / MASTER_FUNCTIONS_VALIDATE_ROLES=false to load raw CSV names."
        : "No rows parsed. Check CSV headers and content.",
    );
  }

  const existing = await col.findOne({ companyDomain });
  const existingDepts = Array.isArray(existing?.departments) ? existing.departments : [];

  const finalDepartments = merge ? mergeDepartments(existingDepts, departments) : departments;

  const payload = {
    companyDomain,
    companyName: (process.env.ORG_STRUCTURE_COMPANY_NAME || "").trim() || existing?.companyName || undefined,
    setupByEmail: (process.env.ORG_STRUCTURE_SETUP_BY_EMAIL || "").trim() || existing?.setupByEmail || undefined,
    setupByName: (process.env.ORG_STRUCTURE_SETUP_BY_NAME || "").trim() || existing?.setupByName || undefined,
    departments: finalDepartments,
  };

  console.log(`\n♻️   Upserting company org structure (departments=${finalDepartments.length})…`);
  await col.updateOne({ companyDomain }, { $set: payload }, { upsert: true });
  await col.createIndex({ companyDomain: 1 }, { unique: true });

  console.log("🎉  Done!");
  await client.close();
}

main().catch((err) => {
  console.error("❌ ", err?.message || err);
  process.exit(1);
});
