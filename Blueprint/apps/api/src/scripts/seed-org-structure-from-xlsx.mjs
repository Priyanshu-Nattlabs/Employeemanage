/**
 * Seed `company_org_structures` (departments -> roles) from an Excel sheet.
 *
 * Input workbook: `Department role mapping.xlsx`
 * Sheet: "Department role mapping"
 *
 * Expected layout:
 * - Row 1 headers: ["Department", "<Dept A>", "<Dept B>", ...]
 * - Column under each dept contains role names (one per row). Blank cells ignored.
 * - The first data row may contain a label like "Roles" — it is ignored.
 *
 * Env:
 *   MONGODB_URI                   — default mongodb://localhost:27017/job_blueprint_v2
 *   ORG_STRUCTURE_XLSX_FILE        — path to xlsx (default ../../Department role mapping.xlsx)
 *   ORG_STRUCTURE_COMPANY_DOMAIN   — required, e.g. nattlabs.com
 *   ORG_STRUCTURE_COMPANY_NAME     — optional, e.g. NATT Labs
 *   ORG_STRUCTURE_SETUP_BY_EMAIL   — optional
 *   ORG_STRUCTURE_SETUP_BY_NAME    — optional
 *   ORG_STRUCTURE_DEPT_PREFIX      — optional, default "IT -". Stripped from department names.
 *   ORG_STRUCTURE_VALIDATE_ROLES   — optional, default "true". When true, intersects mapped roles with blueprints.role catalog.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { read, utils } from "xlsx";
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

function normalizeDeptName(raw, prefixToStrip) {
  let s = String(raw || "").trim();
  if (!s) return "";
  const pref = String(prefixToStrip || "").trim();
  if (pref) {
    const re = new RegExp("^" + pref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "i");
    s = s.replace(re, "").trim();
  }
  return s;
}

function uniqSorted(list) {
  return Array.from(new Set(list.map((x) => String(x || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function parseDepartmentRoleMapping(wb, opts = {}) {
  const sheetName =
    wb.SheetNames.find((n) => String(n || "").trim().toLowerCase() === "department role mapping") || wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  const rows = utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!rows.length) return [];

  const header = (rows[0] || []).map((h) => String(h || "").trim());
  if (header.length < 2) return [];

  const departments = [];
  for (let col = 1; col < header.length; col++) {
    const deptNameRaw = header[col];
    const deptName = normalizeDeptName(deptNameRaw, opts.deptPrefixToStrip);
    if (!deptName) continue;

    const roles = [];
    for (let row = 1; row < rows.length; row++) {
      const cell = String((rows[row] || [])[col] || "").trim();
      if (!cell) continue;
      if (cell.toLowerCase() === "roles") continue;
      // Some sheets may include comma-separated lists in one cell
      const parts = cell
        .split(",")
        .map((x) => String(x || "").trim())
        .filter(Boolean);
      roles.push(...parts);
    }

    departments.push({ name: deptName, roles: uniqSorted(roles) });
  }

  return departments.filter((d) => d.name && Array.isArray(d.roles) && d.roles.length > 0);
}

async function fetchBlueprintRoleNameSet(db) {
  const col = db.collection("blueprints");
  const docs = await col
    .find({ type: "role" }, { projection: { name: 1 } })
    .toArray();
  const set = new Set();
  for (const d of docs) {
    const n = String(d?.name || "").trim();
    if (n) set.add(n.toLowerCase());
  }
  return set;
}

async function main() {
  const companyDomain = normalizeDomain(process.env.ORG_STRUCTURE_COMPANY_DOMAIN);
  if (!companyDomain) {
    throw new Error("Missing ORG_STRUCTURE_COMPANY_DOMAIN (example: nattlabs.com)");
  }

  const xlsxPath = resolveSeedPath(process.env.ORG_STRUCTURE_XLSX_FILE || "../../Department role mapping.xlsx");
  if (!xlsxPath || !existsSync(xlsxPath)) {
    throw new Error(`Seed file not found: ${xlsxPath}\nSet ORG_STRUCTURE_XLSX_FILE or place the xlsx near the repo root.`);
  }

  console.log("📄  Org-structure seed source:");
  console.log(`      • ${xlsxPath}`);
  console.log(`      • companyDomain=${companyDomain}`);

  console.log(`\n🔌  Connecting to ${MONGO}…`);
  const client = new MongoClient(MONGO);
  await client.connect();

  const db = client.db();
  const col = db.collection("company_org_structures");

  console.log(`\n📖  Reading ${path.basename(xlsxPath)}…`);
  const wb = read(readFileSync(xlsxPath));
  const deptPrefixToStrip = process.env.ORG_STRUCTURE_DEPT_PREFIX ?? "IT -";
  const validateRoles = String(process.env.ORG_STRUCTURE_VALIDATE_ROLES ?? "true").trim().toLowerCase() !== "false";

  let departments = parseDepartmentRoleMapping(wb, { deptPrefixToStrip });

  if (validateRoles) {
    console.log("🔎  Validating mapped roles against blueprint catalog…");
    const roleSet = await fetchBlueprintRoleNameSet(db);
    const missing = new Map(); // roleLower -> { role, depts:Set }

    departments = departments
      .map((d) => {
        const kept = [];
        for (const role of d.roles || []) {
          const key = String(role || "").trim().toLowerCase();
          if (!key) continue;
          if (roleSet.has(key)) {
            kept.push(String(role).trim());
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
      console.log(`⚠️   Roles present in mapping but NOT found in blueprints catalog: ${missing.size}`);
      const sample = Array.from(missing.values())
        .slice(0, 25)
        .map((m) => `      - ${m.role}  (dept: ${Array.from(m.depts).join(", ")})`);
      sample.forEach((l) => console.log(l));
      if (missing.size > 25) console.log(`      ... and ${missing.size - 25} more`);
    } else {
      console.log("✅  All mapped roles exist in blueprint catalog");
    }
  }

  console.log(`✅  Parsed departments: ${departments.length}`);
  const roleCount = departments.reduce((s, d) => s + (d.roles?.length || 0), 0);
  console.log(`✅  Total mapped role entries: ${roleCount}`);

  if (!departments.length) {
    throw new Error("No departments parsed. Check the sheet name and headers in the workbook.");
  }

  const payload = {
    companyDomain,
    companyName: (process.env.ORG_STRUCTURE_COMPANY_NAME || "").trim() || undefined,
    setupByEmail: (process.env.ORG_STRUCTURE_SETUP_BY_EMAIL || "").trim() || undefined,
    setupByName: (process.env.ORG_STRUCTURE_SETUP_BY_NAME || "").trim() || undefined,
    departments,
  };

  console.log("\n♻️   Upserting company org structure…");
  await col.updateOne({ companyDomain }, { $set: payload }, { upsert: true });

  await col.createIndex({ companyDomain: 1 }, { unique: true });

  console.log("🎉  Done!");
  await client.close();
}

main().catch((err) => {
  console.error("❌ ", err?.message || err);
  process.exit(1);
});

