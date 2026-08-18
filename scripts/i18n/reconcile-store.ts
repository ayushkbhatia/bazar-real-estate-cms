/**
 * Make `ARABIC_STORE` agree with the message catalogue, catalogue-first.
 *
 * Both are sources of Arabic for the same site and they overlap: 104 English
 * strings live in both, and 36 of them disagreed when this was written —
 * "Location" as الموقع and موقع, "Back" as رجوع and عودة, "Category" as القسم
 * and الفئة, plus a whole valuation-gate form.
 *
 * That became a visible defect when `localiseRow` started resolving blank
 * `_ar` twins through the store, because the store now feeds flat columns as
 * well as sections. One page renders the catalogue's Arabic in its chrome and
 * the store's in a data field.
 *
 * The catalogue wins. It went through the extraction waves and human review;
 * the store is machine output by construction — every original entry is
 * `by: "machine"`. Reconciled entries are marked `by: "reviewed"` and keep the
 * catalogue's exact string, so a later regeneration does not quietly undo it.
 *
 * `lib/i18n/store-catalogue-agree.test.ts` (G-18) fails the build if they drift
 * apart again. Run this to fix it.
 *
 *   npx tsx scripts/i18n/reconcile-store.ts --dry-run
 *   npx tsx scripts/i18n/reconcile-store.ts
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
const STORE_PATH = join(ROOT, "lib/master-pages/arabic/master.json");
const MESSAGES = join(ROOT, "messages");
const DRY = process.argv.includes("--dry-run");

type Entry = { ar: string; by: "machine" | "reviewed" | "human"; model?: string; at?: string };

function flatten(
  value: unknown,
  out: Record<string, string> = {},
  prefix = "",
): Record<string, string> {
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === "string") out[path] = entry;
    else if (entry && typeof entry === "object") flatten(entry, out, path);
  }
  return out;
}

function catalogue(locale: "en" | "ar"): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of readdirSync(join(MESSAGES, locale))) {
    Object.assign(out, flatten(JSON.parse(readFileSync(join(MESSAGES, locale, file), "utf8"))));
  }
  return out;
}

const store = JSON.parse(readFileSync(STORE_PATH, "utf8")) as Record<string, Entry>;
const en = catalogue("en");
const ar = catalogue("ar");

let changed = 0;
for (const [key, english] of Object.entries(en)) {
  const trimmed = english.trim();
  const entry = store[trimmed];
  const translated = ar[key]?.trim();
  if (!entry || !translated) continue;
  if (entry.ar.trim() === translated) continue;
  console.log(`${key}\n  English:   ${english}\n  was:       ${entry.ar}\n  catalogue: ${translated}\n`);
  if (!DRY) store[trimmed] = { ...entry, ar: translated, by: "reviewed" };
  changed++;
}

if (DRY) {
  console.log(`${changed} entry/entries would change. DRY RUN — nothing written.`);
} else {
  const sorted: Record<string, Entry> = {};
  for (const key of Object.keys(store).sort()) sorted[key] = store[key]!;
  writeFileSync(STORE_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  console.log(`Reconciled ${changed} entry/entries to the catalogue.`);
}
