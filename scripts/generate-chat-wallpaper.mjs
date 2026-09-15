import sharp from "sharp";
import { fileURLToPath } from "node:url";

const artwork = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" viewBox="0 0 280 280">
  <g fill="none" stroke="#82949d" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <g transform="translate(22 22) rotate(-12 16 16)">
      <path d="M1 13L33 2 23 33 15 21 1 13zM15 21L33 2M15 21l-2 9 6-4"/>
    </g>
    <g transform="translate(155 28) rotate(10 17 14)">
      <path d="M5 2h25a5 5 0 015 5v15a5 5 0 01-5 5H15l-9 7v-7H5a5 5 0 01-5-5V7a5 5 0 015-5z"/>
      <path d="M9 12h17M9 18h10"/>
    </g>
    <path d="M99 18l3 8 8 3-8 3-3 8-3-8-8-3 8-3zM244 77l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>
    <g transform="translate(78 106) rotate(15 14 14)">
      <rect x="1" y="1" width="28" height="28" rx="6"/>
      <circle cx="10" cy="10" r="3"/>
      <path d="M3 24l9-9 6 6 5-5 6 6"/>
    </g>
    <g transform="translate(192 153) rotate(-16 14 14)">
      <path d="M4 19V5l22-4v15M4 10l22-4"/>
      <ellipse cx="0" cy="21" rx="5" ry="3"/>
      <ellipse cx="22" cy="18" rx="5" ry="3"/>
    </g>
    <path d="M28 172l8-8 8 8-8 8zM131 195l8-8 8 8-8 8zM249 237l7-7 7 7-7 7z"/>
    <g transform="translate(50 222) rotate(12 15 12)">
      <path d="M2 3h30v22H2zM2 3l15 12L32 3M2 25l10-10M32 25L22 15"/>
    </g>
    <path d="M164 244l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>
    <circle cx="20" cy="102" r="3"/><circle cx="142" cy="90" r="2"/>
    <circle cx="257" cy="155" r="3"/><circle cx="110" cy="252" r="2"/>
  </g>
</svg>`);

for (const scale of [1, 2, 3]) {
  const suffix = scale === 1 ? "" : `@${scale}x`;
  const destination = fileURLToPath(new URL(`../assets/chat-wallpaper${suffix}.png`, import.meta.url));
  await sharp(artwork).resize(280 * scale, 280 * scale).png().toFile(destination);
  const { channels } = await sharp(destination).stats();
  if (channels[3].max === 0) throw new Error("Wallpaper is blank");
}
console.log("Generated nonblank chat wallpaper at 1x, 2x and 3x.");