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
 *   BLUEPRINT_SEED_SOURCES   — comma-separated list of absolute or relative xlsx paths (required)
 *
 * Expected sheet layout per workbook (first matching sheet is used):
 *   Row 1: headers — must include "Role" and "Function" (case-insensitive).
 *   Each subsequent row represents one blueprint entry.
 *   All header columns are stored as-is on the document.
 *
 * Documents are upserted into the `blueprints` collection keyed on
 * { role, function } (lower-cased for matching, stored as provided).
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
  const sourcesEnv = (process.env.BLUEPRINT_SEED_SOURCES || "").trim();
  if (!sourcesEnv) {
    throw new Error(
      "BLUEPRINT_SEED_SOURCES is not set.\n" +
        "Provide a comma-separated list of xlsx paths, e.g.:\n" +
        "  BLUEPRINT_SEED_SOURCES=/data/Job_Blueprint_Final_Phase13.xlsx,/data/NEW JD.xlsx"
    );
  }

  const sourcePaths = sourcesEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => resolvePath(s));

  const missing = sourcePaths.filter((p) => !p || !existsSync(p));
  if (missing.length) {
    throw new Error(
      `The following seed files were not found:\n${missing.map((p) => `  • ${p}`).join("\n")}\n` +
        "Check BLUEPRINT_SEED_SOURCES and ensure the files are mounted / present."
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
