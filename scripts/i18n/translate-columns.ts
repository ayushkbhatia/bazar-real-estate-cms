/**
 * Arabic for the flat `_ar` columns, written into the shared store.
 *
 * ## Why the store rather than the columns
 *
 * `localiseRow` resolves a blank `_ar` twin through `ARABIC_STORE`, the same
 * way `fillArabic` has always done for master-page sections. So the Arabic for
 * "Infinity Pool" belongs in one place keyed by the English, not copied into
 * `amenities_taxonomy.label_ar` and again into whatever else says the same
 * thing. Committed source is reviewable as a diff, revertable with
 * `git revert`, gateable in CI with no credentials, and — the part that
 * matters to the client — a value they type into the CMS still wins, because
 * a non-blank twin beats the store.
 *
 * ## Why this exists separately from translate-records.ts
 *
 * That script writes `_ar` COLUMNS in the database, one row at a time, and is
 * right for per-record prose like a listing description. This one writes
 * DISTINCT STRINGS to the store: 177 floor plans carry 29 distinct labels, and
 * 93 unit types carry 17. Translating the strings rather than the rows is 6x
 * less work and cannot produce two Arabics for one English.
 *
 * ## What is deliberately not here
 *
 * Names. `staff.display_name` is a person's name and the Arabic form of it is
 * theirs to choose, not a machine's. `developers.name`, `areas.name` and
 * `developments.name` are established public names owned by the curated list
 * in `lib/i18n/mt/proper-nouns.ts`. `properties.address_line` is a name string
 * too — "Marsa Al Saadiyat, Building 4" is not prose. Where a name has no
 * approved Arabic it stays Latin, which is normal on UAE sites and never
 * wrong.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/i18n/translate-columns.ts --dry-run
 *   MT_PROVIDER=huggingface npx tsx … scripts/i18n/translate-columns.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { arabicFor } from "../../lib/i18n/arabic-store";
import type { MtKind } from "../../lib/i18n/mt/prompt";

const ROOT = join(import.meta.dirname, "../..");
const STORE_PATH = join(ROOT, "lib/master-pages/arabic/master.json");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const ONLY = args.includes("--table") ? args[args.indexOf("--table") + 1] : null;
const LIMIT = args.includes("--limit")
  ? Number(args[args.indexOf("--limit") + 1])
  : Infinity;

type Entry = { ar: string; by: "machine" | "reviewed" | "human"; model?: string; at?: string };
type Store = Record<string, Entry>;

/**
 * The columns to sweep, and the register each takes.
 *
 * `ui` for a control-shaped label — an amenity chip, a unit type, a CTA. Its
 * prompt exists to stop the model reaching for property vocabulary on a bare
 * noun, which is exactly the risk on "Storage" or "Studio". `page` for
 * editorial prose, which is the register the epic settled on for anything a
 * person reads as a sentence rather than a control.
 */
const COLUMNS: { table: string; column: string; kind: MtKind }[] = [
  { table: "amenities_taxonomy", column: "label", kind: "ui" },
  { table: "article_categories", column: "label", kind: "ui" },
  { table: "article_categories", column: "description", kind: "page" },
  { table: "floor_plans", column: "label", kind: "ui" },
  { table: "floor_plans", column: "description", kind: "page" },
  { table: "development_unit_types", column: "label", kind: "ui" },
  { table: "development_unit_types", column: "blurb", kind: "page" },
  { table: "developments", column: "tagline", kind: "page" },
  { table: "developments", column: "bedrooms_text", kind: "ui" },
  { table: "developers", column: "description", kind: "page" },
  { table: "areas", column: "description", kind: "page" },
  { table: "staff", column: "title", kind: "ui" },
  { table: "staff", column: "bio", kind: "page" },
  { table: "properties", column: "short_description", kind: "page" },
  { table: "properties", column: "view", kind: "ui" },
  { table: "floating_ctas", column: "label", kind: "ui" },
  { table: "site_settings", column: "brand_tagline", kind: "page" },
  { table: "megamenu_items", column: "label", kind: "ui" },
];

function readStore(): Store {
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8")) as Store;
  } catch {
    return {};
  }
}

/** Sorted on the way out, so a re-run diffs only what changed. */
function writeStore(store: Store) {
  const sorted: Store = {};
  for (const en of Object.keys(store).sort()) sorted[en] = store[en]!;
  writeFileSync(STORE_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(2);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const store = readStore();

  /*
   * Deduplicated across the whole sweep, not per column. "Studio" is an
   * amenity label and a unit type; one English gets one Arabic and one call.
   */
  const work = new Map<string, MtKind>();
  const seenIn = new Map<string, string[]>();

  for (const target of COLUMNS) {
    if (ONLY && target.table !== ONLY) continue;
    const { data, error } = await sb.from(target.table).select(target.column);
    if (error) {
      console.error(`${target.table}.${target.column}: ${error.message}`);
      continue;
    }
    for (const row of data ?? []) {
      const raw = (row as unknown as Record<string, unknown>)[target.column];
      if (typeof raw !== "string") continue;
      const english = raw.trim();
      if (!english) continue;
      // Already answered — by this run, an earlier one, or the catalogue.
      if (arabicFor(english, store)) continue;
      if (!work.has(english)) work.set(english, target.kind);
      seenIn.set(english, [...(seenIn.get(english) ?? []), `${target.table}.${target.column}`]);
    }
  }

  const todo = [...work.entries()].slice(0, LIMIT);
  console.log(`${todo.length} distinct string(s) with no Arabic in the store\n`);
  for (const [english, kind] of todo.slice(0, 40)) {
    console.log(`  ${kind.padEnd(5)} ${JSON.stringify(english.slice(0, 68))}  [${seenIn.get(english)![0]}]`);
  }
  if (todo.length > 40) console.log(`  … and ${todo.length - 40} more`);
  if (DRY) {
    console.log("\nDRY RUN — nothing written.");
    return;
  }
  if (!todo.length) return;

  const { mtClientFromEnv } = await import("../../lib/i18n/mt/hf-client");
  const { client, proseModel, provider } = await mtClientFromEnv();
  const { translateField } = await import("../../lib/i18n/mt/translate");
  const { mask } = await import("../../lib/i18n/mt/mask");
  const { nounMap } = await import("../../lib/i18n/mt/proper-nouns");
  const { numeralOverrides } = await import("../../lib/i18n/mt/numerals");
  const nouns = nounMap();
  const terms = [...nouns.keys()];
  console.log(`\nProvider: ${provider} · ${proseModel}\n`);

  let ok = 0;
  const failures: string[] = [];
  for (const [i, [english, kind]] of todo.entries()) {
    process.stdout.write(`[${i + 1}/${todo.length}] ${JSON.stringify(english.slice(0, 44))} … `);
    const result = await translateField({
      client,
      text: english,
      kind,
      properNouns: nouns,
      overrides: numeralOverrides(mask(english, terms)),
      model: proseModel,
      fallbackModel: provider === "anthropic" ? undefined : null,
    });
    if (!result.ok) {
      const why = result.issues.map((x) => x.code).join(", ");
      console.log(`FAILED (${why})`);
      failures.push(`${english} — ${why}`);
      continue;
    }
    store[english] = { ar: result.text, by: "machine", model: proseModel };
    ok++;
    console.log(result.text.slice(0, 40));
    // Written every 20 so a killed run keeps its progress.
    if (ok % 20 === 0) writeStore(store);
  }

  writeStore(store);
  console.log(`\nWrote ${ok}. ${failures.length} failed and were left untranslated.`);
  for (const f of failures.slice(0, 20)) console.log(`  ${f}`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
