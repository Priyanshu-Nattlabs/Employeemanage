/**
 * Build `signup-org-catalog.json` for public signup Industry → Department dropdowns.
 * Sources:
 *   - Master_functions_mapping(Legal Functions Mapping (2)).csv  (Industry - Department, Role)
 *   - Department role mapping.xlsx (sheet "Department role mapping", IT columns)
 *
 * Run from `apps/api`:  node scripts/build-signup-org-catalog.mjs
 * Env:
 *   SIGNUP_CATALOG_CSV   — optional override path
 *   SIGNUP_CATALOG_XLSX  — optional override path
 *   SIGNUP_XLSX_DEPT_PREFIX — optional, default "IT -" (stripped from xlsx column headers)
 *   SIGNUP_XLSX_INDUSTRY — industry label for xlsx columns, default "IT"
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { read, utils } from "xlsx";

function resolvePath(raw, defaults) {
  const r = String(raw || "").trim();
  const list = r ? [r] : defaults;
  for (const rel of list) {
    if (path.isAbsolute(rel) && existsSync(rel)) return rel;
    const candidates = [
      path.resolve(process.cwd(), rel),
      path.resolve(process.cwd(), "..", "..", rel),
      path.resolve(process.cwd(), "..", "..", "..", rel),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
  }
  return null;
}

function uniqSorted(list) {
  return Array.from(new Set(list.map((x) => String(x || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

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

function splitIndustryDepartment(cell) {
  const raw = String(cell || "").trim().replace(/\s+/g, " ");
  if (!raw) return null;
  const idx = raw.indexOf("-");
  if (idx < 0) return null;
  const left = raw.slice(0, idx).trim();
  const right = raw.slice(idx + 1).trim();
  if (!left || !right) return null;
  return { industry: left, department: right };
}

function normalizeDeptName(raw, prefixToStrip) {
  let s = String(raw || "").trim();
  const pref = String(prefixToStrip || "").trim();
  if (pref) {
    const re = new RegExp("^" + pref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "i");
    s = s.replace(re, "").trim();
  }
  return s.replace(/\s+/g, " ");
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
    departments.push({ name: deptName });
  }
  return departments;
}

function addToMap(byMap, industry, department) {
  const ind = String(industry || "").trim().replace(/\s+/g, " ");
  const dep = String(department || "").trim().replace(/\s+/g, " ");
  if (!ind || !dep) return;
  if (!byMap.has(ind)) byMap.set(ind, new Set());
  byMap.get(ind).add(dep);
}

function main() {
  const defaultCsv = "../../Master_functions_mapping(Legal Functions Mapping (2)).csv";
  const defaultXlsx = "../../Department role mapping.xlsx";
  const csvPath = resolvePath(process.env.SIGNUP_CATALOG_CSV, [defaultCsv]);
  const xlsxPath = resolvePath(process.env.SIGNUP_CATALOG_XLSX, [defaultXlsx]);
  const xlsxIndustry = String(process.env.SIGNUP_XLSX_INDUSTRY || "IT").trim() || "IT";
  const deptPrefix = process.env.SIGNUP_XLSX_DEPT_PREFIX ?? "IT -";

  const byMap = new Map();

  if (csvPath) {
    const text = readFileSync(csvPath, "utf8");
    const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.length);
    for (const line of lines) {
      const cols = parseCsvLine(line);
      if (cols.length < 2) continue;
      if (isHeaderRow(cols)) continue;
      const col0 = String(cols[0] || "").replace(/\s+/g, " ").trim();
      const roleName = String(cols[1] || "").replace(/\s+/g, " ").trim();
      if (shouldSkipRow(col0, roleName)) continue;
      const sp = splitIndustryDepartment(col0);
      if (sp) addToMap(byMap, sp.industry, sp.department);
    }
    console.log(`CSV: ${csvPath} (${byMap.size} industries so far)`);
  } else {
    console.warn("⚠️  Master_functions CSV not found; set SIGNUP_CATALOG_CSV or place file under TalentX/");
  }

  if (xlsxPath) {
    const wb = read(readFileSync(xlsxPath));
    const depts = parseDepartmentRoleMapping(wb, { deptPrefixToStrip: deptPrefix });
    for (const d of depts) {
      addToMap(byMap, xlsxIndustry, d.name);
    }
    console.log(`XLSX: ${xlsxPath} (added IT departments: ${depts.length})`);
  } else {
    console.warn("⚠️  Department role mapping xlsx not found; set SIGNUP_CATALOG_XLSX");
  }

  const byIndustry = {};
  for (const [ind, set] of byMap.entries()) {
    byIndustry[ind] = uniqSorted(Array.from(set));
  }

  const outPath = path.resolve(process.cwd(), "signup-org-catalog.json");
  writeFileSync(outPath, JSON.stringify({ byIndustry, generatedAt: new Date().toISOString() }, null, 2), "utf8");
  console.log(`✅ Wrote ${outPath} (${Object.keys(byIndustry).length} industries)`);
}

main();
