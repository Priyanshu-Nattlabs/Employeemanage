/**
 * Replace mauve/pink hero illustration background with theme blue (#e4ecff).
 * Run: node scripts/recolor-growth-hero-bg.mjs
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const input = path.join(root, "apps/web/public/ui-images/employee-growth-path.png");

const NEW_R = 228;
const NEW_G = 236;
const NEW_B = 255;

const REFS = [
  [199, 139, 148],
  [190, 130, 140],
  [210, 150, 158],
  [180, 125, 135],
  [205, 145, 152],
];

function minDistSq(r, g, b) {
  let m = 1e9;
  for (const [R, G, B] of REFS) {
    const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
    if (d < m) m = d;
  }
  return m;
}

function isPinkMauveBg(r, g, b, a) {
  if (a < 8) return false;
  if (r > 248 && g > 248 && b > 248) return false;
  if (r < 70 && g < 70 && b < 90) return false;
  if (g > r + 35 && g > b + 25 && g > 100) return false;

  if (minDistSq(r, g, b) < 4200) return true;
  if (
    r >= 155 &&
    r <= 230 &&
    g >= 105 &&
    g <= 185 &&
    b >= 105 &&
    b <= 185 &&
    r >= b - 25 &&
    r >= g - 75 &&
    !(g > 130 && r < g + 15 && b < g)
  ) {
    return true;
  }
  return false;
}

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels } = info;
if (channels !== 4) {
  console.error("Expected RGBA");
  process.exit(1);
}

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (w * y + x) * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (isPinkMauveBg(r, g, b, a)) {
      data[i] = NEW_R;
      data[i + 1] = NEW_G;
      data[i + 2] = NEW_B;
    }
  }
}

const out = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();

function winLong(p) {
  const abs = path.resolve(p);
  if (abs.startsWith("\\\\?\\")) return abs;
  return "\\\\?\\" + abs;
}

const tmp = path.join(__dirname, "employee-growth-path.recolored.png");
fs.writeFileSync(winLong(tmp), out);
try {
  fs.copyFileSync(winLong(tmp), winLong(input));
  fs.unlinkSync(winLong(tmp));
  console.log("Updated", input);
} catch (e) {
  console.error("Could not copy to public folder (OneDrive lock?). Recolored PNG kept at:\n", tmp);
  console.error(e);
  process.exit(1);
}
