#!/usr/bin/env node
/**
 * FAQ programme — merge a wave's batch folders into one payload, and build the
 * EN | AR review sheet (review.html; print to PDF with headless Chrome).
 *
 *   node scripts/faq-programme/merge.mjs <wave-dir> "<title>"
 *
 * Reads <wave-dir>/batch-* /payload.json, writes <wave-dir>/payload.json and
 * <wave-dir>/review.html. A wave without batches (payload.json already there)
 * only gets its review rebuilt.
 */
import fs from "node:fs";
import path from "node:path";

const [, , waveDir, title = "FAQ review"] = process.argv;
const batches = fs
  .readdirSync(waveDir)
  .filter((d) => d.startsWith("batch-") && fs.existsSync(path.join(waveDir, d, "payload.json")))
  .sort();

let payload;
if (batches.length) {
  const parts = batches.map((b) => JSON.parse(fs.readFileSync(path.join(waveDir, b, "payload.json"), "utf8")));
  payload = {
    wave: parts[0].wave,
    written: parts[0].written,
    batches,
    sourcedNumbers: [...new Set(parts.flatMap((p) => (p.sourcedNumbers ?? []).map(String)))], // strings: "27.10" must not become 27.1
    sourcedNotes: Object.assign({}, ...parts.map((p) => p.sourcedNotes ?? {})),
    pages: parts.flatMap((p) => p.pages),
  };
  const slugs = payload.pages.map((p) => p.slug);
  const dup = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dup.length) throw new Error(`page in two batches: ${dup.join(", ")}`);
  fs.writeFileSync(path.join(waveDir, "payload.json"), JSON.stringify(payload, null, 2) + "\n");
} else {
  payload = JSON.parse(fs.readFileSync(path.join(waveDir, "payload.json"), "utf8"));
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = payload.pages.reduce((t, p) => t + p.faq.length, 0);
const route = (p) =>
  p.route ?? (p.kind === "area" ? `/areas/${p.slug}` : p.kind === "development" ? `/developments/${p.slug}` : p.pageSlug);
const label = (p) =>
  ({ area: "area guide", development: "project", page: "landing" })[p.kind] ??
  (p.slug.startsWith("guide-") ? "guide" : p.slug.startsWith("service-") ? "service page" : p.slug.startsWith("tool-") ? "tool" : "page");

const css = `
@page { size: A4; margin: 12mm 14mm 11mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; color: #000; background: #fff; font: 8.25pt/1.38 "Inter", "Helvetica Neue", Arial, sans-serif; }
h1, h2 { font-family: "Source Serif 4", Georgia, serif; font-weight: 600; margin: 0; }
h1 { font-size: 21pt; line-height: 1.1; letter-spacing: -0.01em; }
h2 { font-size: 11.5pt; margin: 10pt 0 3pt; padding-top: 4pt; border-top: 0.6pt solid #000; break-after: avoid; }
.n { font-weight: 400; margin-right: 5pt; }
.meta { font-size: 7.6pt; letter-spacing: 0.06em; text-transform: uppercase; margin: 4pt 0 6pt; }
.toc { columns: 3; font-size: 7.8pt; margin: 4pt 0 0; padding-left: 12pt; }
.qa { display: grid; grid-template-columns: 1fr 1fr; column-gap: 14pt; padding: 4pt 0; border-bottom: 0.4pt solid #000; break-inside: avoid; }
.q { font-family: "Source Serif 4", Georgia, serif; font-weight: 600; font-size: 9.4pt; margin-bottom: 1.5pt; }
.ar { direction: rtl; text-align: right; font-family: "IBM Plex Sans Arabic", sans-serif; font-size: 8.6pt; line-height: 1.55; }
.ar .q { font-family: inherit; }
`;

const html = `<!doctype html><html><head><meta charset=utf-8><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Inter:wght@400;600&family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
<h1>${esc(title)}</h1>
<div class="meta">${esc(payload.written)} · ${payload.pages.length} pages · ${n} FAQs · EN + AR</div>
<ol class="toc">${payload.pages.map((p) => `<li>${esc(p.name ?? p.slug)} (${p.faq.length})</li>`).join("")}</ol>
${payload.pages
  .map(
    (p, i) => `<h2><span class="n">${i + 1}</span>${esc(p.name ?? p.slug)} — ${label(p)} <span class="n" style="font-size:8pt">· ${route(p)}</span></h2>
${p.faq
  .map(
    (f) =>
      `<div class="qa"><div><div class="q">${esc(f.q)}</div>${esc(f.a)}</div><div class="ar"><div class="q">${esc(f.q_ar)}</div>${esc(f.a_ar)}</div></div>`,
  )
  .join("\n")}`,
  )
  .join("\n")}
</body></html>`;
fs.writeFileSync(path.join(waveDir, "review.html"), html);
console.log(`${batches.length ? `merged ${batches.join(", ")} → ` : ""}${payload.pages.length} pages, ${n} FAQs; review.html written`);
