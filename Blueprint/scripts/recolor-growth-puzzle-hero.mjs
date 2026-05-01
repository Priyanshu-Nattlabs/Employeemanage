/**
 * One-off: recolor the "growth puzzle" hero image to match Blueprint blue/teal palette.
 *
 * - Converts bright red highlight + rays -> teal (#00bfa6).
 * - Slight cool-tint on the light gray background for better harmony with the hero gradient.
 *
 * Run from repo root:
 *   node scripts/recolor-growth-puzzle-hero.mjs
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const input = path.join(root, "apps/web/public/ui-images/employee-growth-puzzle.png");

const TEAL = { r: 0, g: 191, b: 166 }; // #00bfa6

function isRedAccent(r, g, b, a) {
  if (a < 12) return false;
  // Strong red / coral
  return r >= 150 && r - g >= 55 && r - b >= 55;
}

function isLightBg(r, g, b, a) {
  if (a < 12) return false;
  // Background is very light gray; avoid pure whites (puzzle pieces highlights)
  if (r > 248 && g > 248 && b > 248) return false;
  const avg = (r + g + b) / 3;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return avg >= 210 && avg <= 245 && spread <= 18;
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels } = info;
if (channels !== 4) throw new Error(`Expected RGBA, got channels=${channels}`);

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (w * y + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (isRedAccent(r, g, b, a)) {
      // push reds fully to teal but keep some shading
      const redness = Math.max(0, r - Math.max(g, b));
      const t = Math.min(0.95, 0.72 + redness / 300); // 0.72..0.95
      data[i] = lerp(r, TEAL.r, t);
      data[i + 1] = lerp(g, TEAL.g, t);
      data[i + 2] = lerp(b, TEAL.b, t);
      continue;
    }

    if (isLightBg(r, g, b, a)) {
      // subtle cool tint (very light): nudge toward #eaf2ff-ish
      data[i] = lerp(r, 234, 0.22);
      data[i + 1] = lerp(g, 242, 0.18);
      data[i + 2] = lerp(b, 255, 0.26);
    }
  }
}

// Write via temp to avoid OneDrive locking issues.
const tmp = path.join(__dirname, "employee-growth-puzzle.teal.png");
await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(tmp);
try {
  fs.copyFileSync(tmp, input);
  fs.unlinkSync(tmp);
  console.log("Updated", input);
} catch (e) {
  console.warn("Could not overwrite public PNG (OneDrive lock?). Temp file kept at:", tmp);
  console.warn("Copy it manually with PowerShell:");
  console.warn(`Copy-Item -LiteralPath \"${tmp}\" -Destination \"${input}\" -Force`);
  throw e;
}

