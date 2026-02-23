"use strict";

const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const SIZE = 1024;
const LOGO_SCALE = 0.6; // logo fits fully in icon circle (smaller = full logo visible, not zoomed/cropped)

const root = path.resolve(__dirname, "..");
const logoPath = path.join(root, "assets", "bazaario-logo.png");
const outPath = path.join(root, "assets", "bazaario-icon-android.png");

async function main() {
  if (!fs.existsSync(logoPath)) {
    console.error("Logo not found:", logoPath);
    process.exit(1);
  }

  const meta = await sharp(logoPath).metadata();
  const logoSize = Math.min(meta.width, meta.height);
  const scale = (SIZE * LOGO_SCALE) / logoSize;
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  const left = Math.round((SIZE - w) / 2);
  const top = Math.round((SIZE - h) / 2);

  const logoBuffer = await sharp(logoPath).resize(w, h).png().toBuffer();

  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logoBuffer, left, top }])
    .png()
    .toFile(outPath);

  console.log("Generated full-bleed Android icon:", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
