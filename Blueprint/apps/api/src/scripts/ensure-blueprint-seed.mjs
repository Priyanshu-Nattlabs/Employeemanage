/**
 * Auto-check MongoDB and seed blueprint data from Excel when the DB has no blueprints yet.
 * Use this after cloning the repo on a new machine or with an empty database.
 *
 * Behavior:
 *   - Counts documents in the `blueprints` collection.
 *   - If count > 0 → exits 0 and prints "skip" (already seeded).
 *   - If count === 0 → runs the same logic as `seed-from-xlsx.mjs` (Phase13 + NEW JD when files exist).
 *
 * Env:
 *   MONGODB_URI                         — default mongodb://localhost:27017/job_blueprint_v2
 *   BLUEPRINT_SEED_SOURCES              — optional; same as seed-from-xlsx (comma-separated xlsx paths)
 *   BLUEPRINT_XLSX_FILE                  — optional single workbook
 *   BLUEPRINT_AUTO_SEED_FORCE=1         — always run seed (destructive if Phase13 runs: clears collection)
 *   BLUEPRINT_SKIP_AUTO_SEED=1          — exit 0 immediately (use with dev:api if you do not want this check)
 *   BLUEPRINT_AUTO_SEED_CONNECT_RETRIES — default 12 attempts
 *   BLUEPRINT_AUTO_SEED_CONNECT_DELAY_MS — default 1500 ms between attempts (helps Docker Compose startup)
 *
 * Run from apps/api:  node src/scripts/ensure-blueprint-seed.mjs
 * Or:                 npm run seed:ensure
 *
 * Docker: `docker compose up` runs the `seed-ensure` service before `backend` (see docker-compose.yml).
 */
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { MongoClient } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "../..");
const seedScript = path.join(__dirname, "seed-from-xlsx.mjs");

const MONGO = (process.env.MONGODB_URI || "mongodb://localhost:27017/job_blueprint_v2").trim();
const FORCE = String(process.env.BLUEPRINT_AUTO_SEED_FORCE || "").trim() === "1";
const RETRIES = Math.max(1, parseInt(process.env.BLUEPRINT_AUTO_SEED_CONNECT_RETRIES || "12", 10) || 12);
const DELAY_MS = Math.max(0, parseInt(process.env.BLUEPRINT_AUTO_SEED_CONNECT_DELAY_MS || "1500", 10) || 1500);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveSeedPath(raw) {
  const r = String(raw || "").trim();
  if (!r) return null;
  if (path.isAbsolute(r)) return path.normalize(r);
  const candidates = [
    path.resolve(process.cwd(), r),
    path.resolve(process.cwd(), "..", "..", r),
    path.resolve(process.cwd(), "..", "..", "..", r),
    path.resolve(apiRoot, r),
    path.resolve(apiRoot, "..", "..", r),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return path.resolve(process.cwd(), r);
}

/** When env does not set sources, use any workbooks that exist under TalentX repo root (../../ from apps/api). */
function defaultSeedSourcesFromDisk() {
  const phase13 = resolveSeedPath("../../Job_Blueprint_Final_Phase13.xlsx");
  const jd123 = resolveSeedPath("../../NEW JD 123.xlsx");
  const jdLegacy = resolveSeedPath("../../NEW JD.xlsx");
  const newJd = existsSync(jd123) ? jd123 : jdLegacy;
  const parts = [];
  if (existsSync(phase13)) parts.push(phase13);
  if (existsSync(newJd)) parts.push(newJd);
  return parts;
}

async function connectMongo() {
  let lastErr;
  for (let i = 0; i < RETRIES; i++) {
    try {
      const client = new MongoClient(MONGO);
      await client.connect();
      return client;
    } catch (e) {
      lastErr = e;
      if (i < RETRIES - 1) {
        console.warn(
          `⚠️  MongoDB connect failed (${e?.message || e}). Retry ${i + 2}/${RETRIES} in ${DELAY_MS}ms…`,
        );
        await sleep(DELAY_MS);
      }
    }
  }
  throw lastErr;
}

function runSeedSubprocess(extraEnv) {
  const env = { ...process.env, ...extraEnv };
  console.log("\n▶️  Running seed-from-xlsx.mjs …\n");
  const r = spawnSync(process.execPath, [seedScript], {
    cwd: apiRoot,
    stdio: "inherit",
    env,
  });
  if (r.status !== 0) {
    console.error("\n❌  Seed subprocess exited with code", r.status);
    process.exit(r.status ?? 1);
  }
}

async function main() {
  if (String(process.env.BLUEPRINT_SKIP_AUTO_SEED || "").trim() === "1") {
    console.log("⏭️  BLUEPRINT_SKIP_AUTO_SEED=1 — skipped ensure-blueprint-seed.");
    return;
  }

  if (!existsSync(seedScript)) {
    console.error("Missing:", seedScript);
    process.exit(1);
  }

  let client;
  try {
    client = await connectMongo();
  } catch (e) {
    console.error(`❌  Could not connect to MongoDB (${MONGO}):`, e?.message || e);
    console.error("   Start MongoDB or set MONGODB_URI. For Docker: wait for mongodb healthy, then retry.");
    process.exit(1);
  }

  const col = client.db().collection("blueprints");
  let count;
  try {
    count = await col.countDocuments();
  } finally {
    await client.close();
  }

  console.log(`📊  blueprints collection: ${count} document(s)`);

  if (!FORCE && count > 0) {
    console.log("✅  Database already has blueprint data — skipping seed.");
    console.log("   To seed anyway, run: npm run seed:xlsx   or set BLUEPRINT_AUTO_SEED_FORCE=1");
    return;
  }

  if (FORCE && count > 0) {
    console.log("⚠️  BLUEPRINT_AUTO_SEED_FORCE=1 — running seed even though collection is not empty.");
  } else {
    console.log("📭  Empty database — seeding from Excel workbooks…");
  }

  let sources = (process.env.BLUEPRINT_SEED_SOURCES || "").trim();
  const single = (process.env.BLUEPRINT_XLSX_FILE || "").trim();

  const extraEnv = {};
  if (sources) {
    extraEnv.BLUEPRINT_SEED_SOURCES = sources;
  } else if (single) {
    extraEnv.BLUEPRINT_XLSX_FILE = single;
  } else {
    const parts = defaultSeedSourcesFromDisk();
    if (!parts.length) {
      console.warn(
        "⚠️  Empty database but no Excel seed files on disk. Skipping auto-seed (exit 0) so services can start.\n" +
          "   Add Job_Blueprint_Final_Phase13.xlsx / NEW JD*.xlsx at TalentX repo root, set BLUEPRINT_SEED_SOURCES,\n" +
          "   or run: docker compose --profile seed run --rm seed",
      );
      return;
    }
    extraEnv.BLUEPRINT_SEED_SOURCES = parts.join(",");
    console.log("📄  Using workbooks:", parts.join("\n      "));
  }

  runSeedSubprocess(extraEnv);
  console.log("\n🎉  Auto-seed finished.");
}

main().catch((err) => {
  console.error("❌ ", err);
  process.exit(1);
});
