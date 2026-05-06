/**
 * One-off: recolor red/orange accents in `employee-growth-path.png` to match TalentX blue/teal palette.
 *
 * - Targets: map pins + target rings + tie (red-ish pixels) -> teal.
 * - Leaves: white path, dark suit, background untouched.
 *
 * Run from repo root:
 *   node scripts/recolor-growth-hero-accents.mjs
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const input = path.join(root, "apps/web/public/ui-images/employee-growth-path.png");

// TalentX accent: teal leaning mint (pairs with #054a90 + #4f46e5)
const OUT = { r: 0, g: 191, b: 166 }; // #00bfa6

function isAccentRed(r, g, b, a) {
  if (a < 12) return false;
  // keep whites
  if (r > 245 && g > 245 && b > 245) return false;
  // keep dark suit/ink lines
  if (r < 65 && g < 65 && b < 80) return false;
  // detect strong reds / oranges
  const isRed = r > 120 && r - g > 55 && r - b > 45;
  const isOrange = r > 150 && g > 70 && r - b > 70 && r > g + 35;
  return isRed || isOrange;
}

function blendTowardTeal(r, g, b, strength01) {
  const t = Math.max(0, Math.min(1, strength01));
  return {
    r: Math.round(r + (OUT.r - r) * t),
    g: Math.round(g + (OUT.g - g) * t),
    b: Math.round(b + (OUT.b - b) * t),
  };
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
    if (!isAccentRed(r, g, b, a)) continue;

    // Keep shading: stronger push for very red pixels, gentler for orange highlights.
    const redness = Math.max(0, r - Math.max(g, b));
    const strength = Math.min(0.92, 0.45 + redness / 180); // 0.45..0.92
    const out = blendTowardTeal(r, g, b, strength);
    data[i] = out.r;
    data[i + 1] = out.g;
    data[i + 2] = out.b;
  }
}

// Write to temp next to script (avoid OneDrive write-lock), then instruct PS copy if needed.
const tmp = path.join(__dirname, "employee-growth-path.teal.png");
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

