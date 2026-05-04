/**
 * Re-seed blueprints from your NEW JD Excel workbook (default: Blueprint/NEW JD 123.xlsx).
 *
 * Usage (from Employeemanage/Blueprint):
 *   npm run seed:new-jd
 *
 * Override path or MongoDB:
 *   BLUEPRINT_XLSX_FILE="C:\\path\\to\\file.xlsx" npm run seed:new-jd
 *   MONGODB_URI="mongodb://127.0.0.1:27017/job_blueprint_v2" npm run seed:new-jd
 *
 * Multiple workbooks (Phase13 full replace + NEW JD upserts, same as seed-from-xlsx):
 *   BLUEPRINT_SEED_SOURCES="C:\\a\\Phase13.xlsx,C:\\b\\NEW JD 123.xlsx" npm run seed:new-jd
 */
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blueprintRoot = path.resolve(__dirname, "..");
const apiRoot = path.join(blueprintRoot, "apps", "api");
const seedScript = path.join(apiRoot, "src", "scripts", "seed-from-xlsx.mjs");
const defaultWorkbook = path.join(blueprintRoot, "NEW JD 123.xlsx");

function resolveWorkbookPath(raw) {
  const r = String(raw || "").trim();
  if (!r) return null;
  if (path.isAbsolute(r)) return path.normalize(r);
  return path.resolve(blueprintRoot, r);
}

function main() {
  if (!existsSync(seedScript)) {
    console.error(`Missing seed engine: ${seedScript}`);
    process.exit(1);
  }

  let sources = (process.env.BLUEPRINT_SEED_SOURCES || "").trim();
  if (!sources) {
    const single = (process.env.BLUEPRINT_XLSX_FILE || "").trim();
    sources = single ? resolveWorkbookPath(single) : defaultWorkbook;
  }

  if (!sources.includes(",")) {
    const one = resolveWorkbookPath(sources);
    if (!existsSync(one)) {
      console.error(`Excel file not found:\n  ${one}`);
      console.error("\nPut your workbook at Blueprint/NEW JD 123.xlsx or set BLUEPRINT_XLSX_FILE / BLUEPRINT_SEED_SOURCES.");
      process.exit(1);
    }
    sources = one;
  }

  const env = { ...process.env, BLUEPRINT_SEED_SOURCES: sources };
  delete env.BLUEPRINT_XLSX_FILE;

  console.log(`Using BLUEPRINT_SEED_SOURCES=${sources}\n`);

  const r = spawnSync(process.execPath, [seedScript], {
    cwd: apiRoot,
    stdio: "inherit",
    env,
  });
  process.exit(r.status === null ? 1 : r.status);
}

main();
