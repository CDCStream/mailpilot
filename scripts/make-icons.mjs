// Asset pipeline: AI master icons → app sizes (light + dark).
// Run: node scripts/make-icons.mjs <icon.png> <og.png> [icon-dark.png]
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [, , iconSrc, ogSrc, iconDarkSrc] = process.argv;
if (!iconSrc || !ogSrc) {
  console.error("usage: node scripts/make-icons.mjs <icon.png> <og.png> [icon-dark.png]");
  process.exit(1);
}

const appDir = path.join(import.meta.dirname, "..", "src", "app");
const publicDir = path.join(import.meta.dirname, "..", "public");
mkdirSync(publicDir, { recursive: true });

const jobs = [
  sharp(iconSrc).resize(512, 512).png().toFile(path.join(appDir, "icon.png")),
  sharp(iconSrc).resize(180, 180).png().toFile(path.join(appDir, "apple-icon.png")),
  sharp(ogSrc).resize(1200, 630, { fit: "cover" }).png({ quality: 90 }).toFile(path.join(appDir, "opengraph-image.png")),
  sharp(iconSrc).resize(256, 256).png().toFile(path.join(publicDir, "logo.png")),
  sharp(iconSrc).resize(96, 96).png().toFile(path.join(publicDir, "logo-96.png")),
  sharp(iconSrc).resize(64, 64).png().toFile(path.join(publicDir, "logo-64.png")),
];

if (iconDarkSrc) {
  jobs.push(
    sharp(iconDarkSrc).resize(256, 256).png().toFile(path.join(publicDir, "logo-dark.png")),
    sharp(iconDarkSrc).resize(96, 96).png().toFile(path.join(publicDir, "logo-96-dark.png")),
    sharp(iconDarkSrc).resize(64, 64).png().toFile(path.join(publicDir, "logo-64-dark.png")),
  );
}

await Promise.all(jobs);
console.log("done: light (+ dark if provided) logos written to public/ and src/app/");
