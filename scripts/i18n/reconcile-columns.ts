/**
 * Make DB `_ar` columns and `ARABIC_STORE` agree, in whichever direction is
 * right for that string.
 *
 * The same English can carry two Arabics: one typed into a `_ar` column, one
 * in the shared store. `localiseRow` prefers a non-blank column, so the store
 * value is shadowed — and the same development name then reads one way in the
 * megamenu and another on its own page. `store-catalogue-agree.test.ts` (G-18)
 * guards catalogue-vs-store; nothing guarded this.
 *
 * ## Why this is not simply "the store wins"
 *
 * That was the assumption going in and the data refused it. Of 37
 * disagreements on the megamenu tables, only 8 had a store value from the
 * CURATED proper-noun list. On the other 29 the column was frequently the
 * better string: "Abu Dhabi Locations" is مواقع أبوظبي in the column and
 * أبوظبي المواقع in the store, which has the word order wrong.
 *
 * So the rule follows provenance rather than location:
 *
 *   - the store value comes from `PROPER_NOUNS` (human-approved) -> the COLUMN
 *     is corrected to match it;
 *   - otherwise the column is the more recently reviewed string -> the STORE
 *     is updated from it, which also fixes every other surface reading that
 *     English.
 *
 * The second direction is a source edit, reviewable as a diff. The first is a
 * database write and is printed row by row before it happens.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/i18n/reconcile-columns.ts --dry-run
 *   npx tsx --env-file-if-exists=.env.local scripts/i18n/reconcile-columns.ts
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { arabicFor } from "../../lib/i18n/arabic-store";
import { PROPER_NOUNS } from "../../lib/i18n/mt/proper-nouns";

const ROOT = join(import.meta.dirname, "../..");
const STORE_PATH = join(ROOT, "lib/master-pages/arabic/master.json");
const DRY = process.argv.includes("--dry-run");

type Entry = { ar: string; by: "machine" | "reviewed" | "human"; model?: string; at?: string };

/** Tables whose `_ar` columns render beside store-resolved copy. */
const TABLES: { table: string; columns: string[] }[] = [
  { table: "megamenu_tabs", columns: ["label", "panel_title", "right_column_title"] },
  { table: "megamenu_columns", columns: ["heading"] },
  { table: "megamenu_items", columns: ["label", "badge_label"] },
  { table: "megamenu_featured_tiles", columns: ["headline", "badge_label", "cta_label"] },
];

/**
 * Every English string the message catalogue owns.
 *
 * The catalogue outranks a column as well as the store. G-18 already settled
 * that the catalogue beats the store; letting a column push a competing value
 * INTO the store would beat it transitively, which is how this script first
 * broke `store-catalogue-agree.test.ts` on "Rent", "List Your Property" and
 * "Move-In Guide". A column disagreeing with catalogue-owned copy is a
 * question for whoever owns the catalogue, not something to resolve by
 * overwriting.
 */
function catalogueEnglish(): Set<string> {
  const out = new Set<string>();
  const dir = join(ROOT, "messages/en");
  const walk = (v: unknown) => {
    for (const entry of Object.values(v as Record<string, unknown>)) {
      if (typeof entry === "string") out.add(entry.trim());
      else if (entry && typeof entry === "object") walk(entry);
    }
  };
  for (const f of readdirSync(dir)) walk(JSON.parse(readFileSync(join(dir, f), "utf8")));
  return out;
}

const CURATED = new Map(
  PROPER_NOUNS.filter((n) => n.ar).map((n) => [n.en.trim().toLowerCase(), n.ar!.trim()]),
);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(2);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const store = JSON.parse(readFileSync(STORE_PATH, "utf8")) as Record<string, Entry>;
  const owned = catalogueEnglish();

  const toColumn: { table: string; column: string; id: string; en: string; ar: string }[] = [];
  let toStore = 0;

  for (const { table, columns } of TABLES) {
    const select = ["id", ...columns.flatMap((c) => [c, `${c}_ar`])].join(", ");
    const { data, error } = await sb.from(table).select(select);
    if (error) {
      console.error(`${table}: ${error.message}`);
      continue;
    }
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      for (const column of columns) {
        const en = row[column];
        const ar = row[`${column}_ar`];
        if (typeof en !== "string" || typeof ar !== "string") continue;
        if (!en.trim() || !ar.trim()) continue;
        const stored = arabicFor(en.trim(), store);
        if (!stored || stored.trim() === ar.trim()) continue;

        const curated = CURATED.get(en.trim().toLowerCase());
        if (curated && curated === stored.trim()) {
          // Human-approved name. The column is the one that is wrong.
          toColumn.push({ table, column, id: String(row.id), en: en.trim(), ar: stored.trim() });
        } else if (owned.has(en.trim())) {
          // Catalogue-owned. Leave both alone and say so — see above.
          console.log(`skip   ${JSON.stringify(en.trim())} — the catalogue owns this string`);
        } else {
          // The column is the more recently reviewed string; propagate it so
          // every other surface reading this English agrees.
          console.log(`store <- ${JSON.stringify(en.trim())}\n    was: ${stored.trim()}\n    now: ${ar.trim()}`);
          if (!DRY) store[en.trim()] = { ...store[en.trim()], ar: ar.trim(), by: "reviewed" };
          toStore++;
        }
      }
    }
  }

  for (const w of toColumn) {
    console.log(`column <- ${JSON.stringify(w.en)} (${w.table}.${w.column})\n    now: ${w.ar}  [curated proper noun]`);
    if (!DRY) {
      const { error } = await sb.from(w.table).update({ [`${w.column}_ar`]: w.ar }).eq("id", w.id);
      if (error) console.error(`  WRITE FAILED ${error.message}`);
    }
  }

  if (!DRY) {
    const sorted: Record<string, Entry> = {};
    for (const k of Object.keys(store).sort()) sorted[k] = store[k]!;
    writeFileSync(STORE_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  }
  console.log(
    `\n${toStore} store entr(ies) updated from a column, ${toColumn.length} column(s) corrected to a curated name.` +
      (DRY ? " DRY RUN — nothing written." : ""),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
