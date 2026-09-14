#!/usr/bin/env node
// Generates the app icon, Android adaptive-icon layers, monochrome icon,
// notification icon, and favicon from the FlowChat brand mark (the two
// slanted parallelogram bars used across the login screen and headers).
//
// Usage: node scripts/generate-icons.mjs

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "assets");
mkdirSync(assetsDir, { recursive: true });

const INDIGO = "#6366f1";
const INDIGO_DARK_THEME = "#818cf8";
const WHITE = "#ffffff";

// Brand mark path data, natively centered around (13, 12) in a 24x24 box.
const BAR1 = "M5.5 17L9.5 7H13.5L9.5 17H5.5Z";
const BAR2 = "M12.5 17L16.5 7H20.5L16.5 17H12.5Z";

function logoGroup(color, scale, cx, cy) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale}) translate(-13 -12)">
    <path d="${BAR1}" fill="${color}" />
    <path d="${BAR2}" fill="${color}" />
  </g>`;
}

function svg(size, { background, logoColor, logoWidth }) {
  const cx = size / 2;
  const cy = size / 2;
  const bg = background
    ? `<rect width="${size}" height="${size}" fill="${background}" />`
    : "";
  const logo = logoWidth ? logoGroup(logoColor, logoWidth / 15, cx, cy) : "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${bg}
    ${logo}
  </svg>`;
}

async function render(name, size, opts) {
  const buffer = Buffer.from(svg(size, opts));
  const outPath = path.join(assetsDir, name);
  await sharp(buffer).png().toFile(outPath);
  console.log(`Wrote ${name} (${size}x${size})`);
}

async function main() {
  // Main app icon (iOS + universal fallback) — opaque, no transparency.
  await render("icon.png", 1024, {
    background: INDIGO,
    logoColor: WHITE,
    logoWidth: 620,
  });

  // Android adaptive icon layers.
  await render("android-icon-background.png", 1024, {
    background: INDIGO,
    logoColor: INDIGO,
    logoWidth: 0,
  });
  await render("android-icon-foreground.png", 1024, {
    background: null,
    logoColor: WHITE,
    logoWidth: 460,
  });
  await render("android-icon-monochrome.png", 1024, {
    background: null,
    logoColor: WHITE,
    logoWidth: 460,
  });

  // Notification icon — small, flat white silhouette on transparent, generous padding.
  await render("notification-icon.png", 256, {
    background: null,
    logoColor: WHITE,
    logoWidth: 140,
  });

  // Web favicon.
  await render("favicon.png", 196, {
    background: INDIGO,
    logoColor: WHITE,
    logoWidth: 118,
  });

  // Header logo marks — transparent background, themed color so the mark
  // never gets buried against the header background in either theme.
  await render("logo-mark-light-theme.png", 256, {
    background: null,
    logoColor: INDIGO,
    logoWidth: 175,
  });
  await render("logo-mark-dark-theme.png", 256, {
    background: null,
    logoColor: INDIGO_DARK_THEME,
    logoWidth: 175,
  });

  console.log(
    "\nDone. Rebuild the native app (eas build) to see the new app icon;\nOTA updates cannot change native icons.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
