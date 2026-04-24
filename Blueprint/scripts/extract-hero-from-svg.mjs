import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgPath = path.join(root, "UI Reference", "Job Blue Print.svg");
const outDir = path.join(root, "apps", "web", "public", "ui-images");

const pairs = [
  ["image2_447_122", "hero-ref-student-left.png"],
  ["image3_447_122", "hero-ref-student-right.png"],
];

const text = fs.readFileSync(svgPath, "utf8");
fs.mkdirSync(outDir, { recursive: true });

for (const [id, fname] of pairs) {
  const re = new RegExp(
    `<image\\s+id="${id}"[^>]*(?:xlink:href|href)="(data:image\\/[^;]+;base64,[^"]+)"`,
    "i",
  );
  const m = text.match(re);
  if (!m) throw new Error(`Missing embedded image: ${id}`);
  const dataUrl = m[1];
  const b64 = dataUrl.split(",")[1];
  const buf = Buffer.from(b64, "base64");
  const dest = path.join(outDir, fname);
  fs.writeFileSync(dest, buf);
  console.log("Wrote", dest, buf.length, "bytes");
}
