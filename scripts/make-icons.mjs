// One-off asset pipeline: turns the AI-generated master images into
// every size the app needs. Run: node scripts/make-icons.mjs <icon.png> <og.png>
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [, , iconSrc, ogSrc] = process.argv;
if (!iconSrc || !ogSrc) {
  console.error("usage: node scripts/make-icons.mjs <icon.png> <og.png>");
  process.exit(1);
}

const appDir = path.join(import.meta.dirname, "..", "src", "app");
const publicDir = path.join(import.meta.dirname, "..", "public");
mkdirSync(publicDir, { recursive: true });

const jobs = [
  // Next.js file conventions (served automatically with correct <link> tags)
  sharp(iconSrc).resize(512, 512).png().toFile(path.join(appDir, "icon.png")),
  sharp(iconSrc).resize(180, 180).png().toFile(path.join(appDir, "apple-icon.png")),
  sharp(ogSrc).resize(1200, 630, { fit: "cover" }).png({ quality: 90 }).toFile(path.join(appDir, "opengraph-image.png")),
  // Reusable assets for headers / emails
  sharp(iconSrc).resize(256, 256).png().toFile(path.join(publicDir, "logo.png")),
  sharp(iconSrc).resize(64, 64).png().toFile(path.join(publicDir, "logo-64.png")),
];

await Promise.all(jobs);
console.log("done: icon.png(512) apple-icon.png(180) opengraph-image.png(1200x630) public/logo.png(256) public/logo-64.png");
