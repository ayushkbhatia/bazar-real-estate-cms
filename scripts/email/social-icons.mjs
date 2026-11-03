// Draws the newsletter's social icons as PNGs (public/email/social/).
//
// Email clients don't show SVG — Gmail and Outlook drop it — so the glyphs the
// contact card draws as SVG (app/[locale]/(public)/contact-qr/_components/
// social-icons.tsx) are rasterised here, at 3× their 24px display size, in a
// dark and a light ink. Run with `node scripts/email/social-icons.mjs` after
// changing a glyph; the PNGs are committed.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "public/email/social";
const GLYPHS = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="INK" stroke="none"/>',
  facebook: '<path d="M16 3h-2.5A4.5 4.5 0 0 0 9 7.5V10H6v4h3v7h4v-7h3l1-4h-4V7.5a1 1 0 0 1 1-1H16Z"/>',
  tiktok: '<path d="M14 3v11.5a4.5 4.5 0 1 1-4.5-4.5"/><path d="M14 3c.4 3 2.6 5 5.5 5.2"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10.5 9.5 5 2.5-5 2.5z"/>',
  linkedin: '<path d="M15.5 8.5A5.5 5.5 0 0 1 21 14v6.5h-3.5V14a2 2 0 0 0-4 0v6.5H10V9h3.5v1.4a5.5 5.5 0 0 1 2-1.9Z"/><rect x="2.5" y="9" width="4" height="11.5" rx="0.5"/><circle cx="4.5" cy="4.5" r="2"/>',
  x: '<path d="m3.5 3.5 8.2 10.4L20.5 20.5"/><path d="m3.5 20.5 7-7.6"/><path d="M13.6 10.2 20.5 3.5"/>',
  whatsapp: '<path d="M3.5 20.5l1.3-4.1A8.5 8.5 0 1 1 8 19.4Z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 .8c-1.2-.5-2.3-1.6-2.8-2.8l.8-1-1-2Z"/>',
  website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  phone: '<path d="M5 3.5h3.5l1.5 4.5-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4.5 1.5V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2Z"/>',
};
const INKS = { dark: "#1B1A17", light: "#FFFFFF" };

mkdirSync(OUT, { recursive: true });
for (const [name, glyph] of Object.entries(GLYPHS)) {
  for (const [tone, ink] of Object.entries(INKS)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${glyph.replaceAll("INK", ink)}</svg>`;
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(`${OUT}/${name}-${tone}.png`);
  }
}
console.log(`wrote ${Object.keys(GLYPHS).length * 2} icons to ${OUT}`);

// The Bazar logo for email: as it is, and in white for a dark photograph or
// band (every opaque pixel white, its alpha kept).
const logo = sharp("public/brand/bazar-logo.png");
await logo.clone().resize({ width: 400 }).png({ compressionLevel: 9 }).toFile("public/email/bazar-logo.png");
const { data, info } = await logo.clone().resize({ width: 400 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = 255;
await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile("public/email/bazar-logo-white.png");
console.log("wrote public/email/bazar-logo.png and bazar-logo-white.png");
