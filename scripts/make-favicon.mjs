// Rebuilds src/app/favicon.ico from the brand logo (16/32/48px PNG-in-ICO).
// The repo shipped create-next-app's default favicon, which is why browser
// tabs showed the Vercel triangle. Usage: node scripts/make-favicon.mjs
import { writeFileSync } from "fs";
import sharp from "sharp";

// The source logo is a purple rounded square on an opaque white canvas.
// Mask everything outside the rounded rect (radius ≈ 17px at 96px) so the
// favicon corners are transparent instead of white.
const SIZE = 96;
const RADIUS = 18;
const mask = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" fill="#fff"/></svg>`,
);
const transparentLogo = await sharp("public/logo-96.png")
  .ensureAlpha()
  .composite([{ input: mask, blend: "dest-in" }])
  .png({ palette: false })
  .toBuffer();

const sizes = [16, 32, 48];
const pngs = [];
for (const s of sizes) {
  // ensureAlpha + palette:false force true RGBA PNGs — Turbopack's ICO
  // decoder rejects palette/RGB entries.
  pngs.push(
    await sharp(transparentLogo)
      .resize(s, s)
      .ensureAlpha()
      .png({ palette: false })
      .toBuffer(),
  );
}

// ICO container with PNG-encoded entries (supported by all modern browsers).
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);

const entries = [];
let offset = 6 + 16 * sizes.length;
for (let i = 0; i < sizes.length; i++) {
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 0); // width
  e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 1); // height
  e.writeUInt8(0, 2); // palette
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // planes
  e.writeUInt16LE(32, 6); // bit depth
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  entries.push(e);
}

writeFileSync("src/app/favicon.ico", Buffer.concat([header, ...entries, ...pngs]));
console.log("src/app/favicon.ico rebuilt from public/logo-96.png");
