/**
 * Seed blueprint job data from one or more Excel workbooks.
 *
 * Usage (local):
 *   MONGODB_URI=mongodb://localhost:27017/job_blueprint_v2 \
 *   BLUEPRINT_SEED_SOURCES=../../Job_Blueprint_Final_Phase13.xlsx,../../NEW\ JD.xlsx \
 *   node src/scripts/seed-from-xlsx.mjs
 *
 * Usage (Docker Compose seed profile):
 *   docker compose --profile seed run --rm seed
 *
 * Env:
 *   MONGODB_URI              — default mongodb://localhost:27017/job_blueprint_v2
 *   BLUEPRINT_SEED_SOURCES   — comma-separated list of absolute or relative xlsx paths (optional if defaults exist)
 *   BLUEPRINT_XLSX_FILE      — single workbook path (optional alternative to BLUEPRINT_SEED_SOURCES)
 *
 * Expected sheet layout per workbook (first matching sheet is used):
 *   Row 1: headers — must include "Role" and "Function" (case-insensitive).
 *   Each subsequent row represents one blueprint entry.
 *   All header columns are stored as-is on the document.
 *
 * Documents are upserted into the `blueprints` collection keyed on
 * { role, function } (lower-cased for matching, stored as provided).
 *
 * Defaults (run from apps/api): ../../Job_Blueprint_Final_Phase13.xlsx then ../../NEW JD 123.xlsx (if missing, ../../NEW JD.xlsx).
 * One-command NEW JD only: from Blueprint repo root run `npm run seed:new-jd` (see scripts/seed-new-jd-workbook.mjs).
 */

import { readFileSync, existsSync } from "fs";
import path from "path";
import { read, utils } from "xlsx";
import { MongoClient } from "mongodb";

const MONGO = (process.env.MONGODB_URI || "mongodb://localhost:27017/job_blueprint_v2").trim();

function resolvePath(raw) {
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
      .map(resolvePath);
  }
  const single = (process.env.BLUEPRINT_XLSX_FILE || "").trim();
  if (single) return [resolvePath(single)];
  const phase13 = resolvePath("../../Job_Blueprint_Final_Phase13.xlsx");
  const jd123 = resolvePath("../../NEW JD 123.xlsx");
  const jdLegacy = resolvePath("../../NEW JD.xlsx");
  const newJd = existsSync(jd123) ? jd123 : jdLegacy;
  return [phase13, newJd].filter(Boolean);
}

function parseBlueprints(wb) {
  // Pick the first sheet whose name looks like a data sheet (not "meta", "readme", etc.)
  const sheetName =
    wb.SheetNames.find(
      (n) => !["meta", "readme", "cover", "index"].includes(n.trim().toLowerCase())
    ) || wb.SheetNames[0];

  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    console.warn(`  ⚠️  Sheet "${sheetName}" is empty — skipped`);
    return [];
  }

  const rows = utils.sheet_to_json(sheet, { defval: "" });
  if (!rows.length) {
    console.warn(`  ⚠️  No rows found in sheet "${sheetName}" — skipped`);
    return [];
  }

  // Normalise header names for lookup (keep original keys on the row objects)
  const headers = Object.keys(rows[0]);
  const roleKey = headers.find((h) => h.trim().toLowerCase() === "role");
  const functionKey = headers.find((h) => h.trim().toLowerCase() === "function");

  if (!roleKey || !functionKey) {
    console.warn(
      `  ⚠️  Sheet "${sheetName}" is missing a "Role" or "Function" column — skipped.\n` +
        `      Found columns: ${headers.join(", ")}`
    );
    return [];
  }

  return rows
    .map((row) => {
      const role = String(row[roleKey] || "").trim();
      const fn = String(row[functionKey] || "").trim();
      if (!role || !fn) return null;
      // Carry all other columns as metadata fields
      const extras = {};
      for (const key of headers) {
        if (key !== roleKey && key !== functionKey) {
          const val = String(row[key] || "").trim();
          if (val) extras[key] = val;
        }
      }
      return { role, function: fn, ...extras };
    })
    .filter(Boolean);
}

async function main() {
  const explicit =
    !!(process.env.BLUEPRINT_SEED_SOURCES || "").trim() ||
    !!(process.env.BLUEPRINT_XLSX_FILE || "").trim();

  let sourcePaths = getSeedFileList();
  if (!explicit) {
    sourcePaths = sourcePaths.filter((p) => p && existsSync(p));
  }

  const missing = sourcePaths.filter((p) => !p || !existsSync(p));
  if (explicit && missing.length) {
    throw new Error(
      `The following seed files were not found:\n${missing.map((p) => `  • ${p}`).join("\n")}\n` +
        "Check BLUEPRINT_SEED_SOURCES / BLUEPRINT_XLSX_FILE and ensure the files are mounted / present."
    );
  }
  if (!explicit && !sourcePaths.length) {
    throw new Error(
      "No seed workbooks found.\n" +
        "Set BLUEPRINT_SEED_SOURCES to a comma-separated list of xlsx paths, or place the default workbooks next to the repo (see script header)."
    );
  }

  console.log("Seed sources:");
  sourcePaths.forEach((p) => console.log(`  • ${p}`));

  console.log(`\nConnecting to ${MONGO}…`);
  const client = new MongoClient(MONGO);
  await client.connect();

  const db = client.db();
  const col = db.collection("blueprints");

  let totalUpserted = 0;
  let totalModified = 0;

  for (const xlsxPath of sourcePaths) {
    const filename = path.basename(xlsxPath);
    console.log(`\nReading ${filename}…`);

    const wb = read(readFileSync(xlsxPath));
    const blueprints = parseBlueprints(wb);

    if (!blueprints.length) {
      console.log(`  ⚠️  No valid blueprint rows found in ${filename} — skipped`);
      continue;
    }

    console.log(`  Parsed ${blueprints.length} blueprint rows`);

    let fileUpserted = 0;
    let fileModified = 0;

    for (const doc of blueprints) {
      const filter = {
        roleLower: doc.role.toLowerCase(),
        functionLower: doc.function.toLowerCase(),
      };
      const update = {
        $set: {
          ...doc,
          type: "role",
          name: doc.role,
          roleLower: doc.role.toLowerCase(),
          functionLower: doc.function.toLowerCase(),
        },
      };
      const result = await col.updateOne(filter, update, { upsert: true });
      if (result.upsertedCount) fileUpserted++;
      if (result.modifiedCount) fileModified++;
    }

    console.log(`  Upserted: ${fileUpserted}  Modified: ${fileModified}`);
    totalUpserted += fileUpserted;
    totalModified += fileModified;
  }

  // Ensure indexes for fast lookup
  await col.createIndex({ roleLower: 1, functionLower: 1 }, { unique: true });
  await col.createIndex({ type: 1 });

  console.log(`\nDone! Total upserted: ${totalUpserted}  Total modified: ${totalModified}`);
  await client.close();
}

main().catch((err) => {
  console.error("ERROR:", err?.message || err);
  process.exit(1);
});
