/**
 * Push the approved Arabic names into `areas`, `developers` and `developments`.
 *
 * `lib/i18n/mt/proper-nouns.ts` is the source of truth and this is derived. The
 * list is reviewed as a diff in a pull request; the database is a projection of
 * whatever that review approved. So the fix for a wrong name is to edit the
 * list and re-run, never to `update` a row by hand — a hand-edited row is a
 * name nobody reviewed, and it is invisible the moment someone re-runs this.
 *
 * Additive and idempotent:
 *
 *  - it only ever writes `name_ar`, never `name`;
 *  - an entry with `ar: null` (an international brand that keeps its Latin
 *    name) is skipped rather than written as null, so a human who typed
 *    something is not overwritten by "we have no opinion";
 *  - a row that already holds exactly the approved Arabic is not written again.
 *
 * It reports, and does not silently fix, two disagreements: a database name
 * with no entry in the list, and a row whose stored Arabic differs from the
 * approved one. The second is the interesting one — it means either the list
 * moved or somebody edited the row, and the script cannot tell which.
 *
 *   npx tsx --env-file=.env.local scripts/i18n/sync-proper-nouns.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/i18n/sync-proper-nouns.ts
 */
import { createClient } from "@supabase/supabase-js";
import { PROPER_NOUNS, type NounEntry } from "../../lib/i18n/mt/proper-nouns";

const DRY = process.argv.includes("--dry-run");

const TABLES = [
  { table: "areas", kind: "area" },
  { table: "developers", kind: "developer" },
  { table: "developments", kind: "development" },
] as const;

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.\n" +
        "Run with: npx tsx --env-file=.env.local scripts/i18n/sync-proper-nouns.ts",
    );
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type Row = { id: string; name: string; slug: string; name_ar: string | null };

async function main() {
  const sb = client();
  const byName = new Map<string, NounEntry>(
    PROPER_NOUNS.map((n) => [n.en.toLowerCase(), n]),
  );

  let written = 0;
  let failed = 0;
  const unknown: string[] = [];
  const conflicts: string[] = [];

  for (const { table, kind } of TABLES) {
    const { data, error } = await sb
      .from(table)
      .select("id, name, slug, name_ar")
      .order("name");
    if (error) {
      console.error(`${table}: ${error.message}`);
      failed++;
      continue;
    }

    console.log(`\n── ${table} (${data?.length ?? 0} rows)`);

    for (const row of (data ?? []) as Row[]) {
      const entry = byName.get(row.name.trim().toLowerCase());

      if (!entry) {
        unknown.push(`${table}.${row.slug} — "${row.name}"`);
        continue;
      }
      if (entry.kind !== kind && entry.kind !== "brand") {
        console.log(`   ?  ${row.name} — listed as ${entry.kind}, found in ${table}`);
      }
      if (entry.ar === null) {
        console.log(`   ·  ${row.name} — keeps its Latin name`);
        continue;
      }
      if (row.name_ar === entry.ar) continue;
      if (row.name_ar && row.name_ar.trim() && row.name_ar !== entry.ar) {
        conflicts.push(
          `${table}.${row.slug} — stored "${row.name_ar}" vs approved "${entry.ar}"`,
        );
        continue;
      }

      console.log(`   +  ${row.name}  →  ${entry.ar}   [${entry.confidence}]`);
      if (DRY) continue;

      const { error: upErr } = await sb
        .from(table)
        .update({ name_ar: entry.ar })
        .eq("id", row.id);
      if (upErr) {
        console.error(`      FAILED: ${upErr.message}`);
        failed++;
        continue;
      }
      written++;
    }
  }

  if (unknown.length) {
    console.log(`\n── ${unknown.length} name(s) with no entry in the list`);
    for (const u of unknown) console.log(`   ?  ${u}`);
    console.log(
      "   Add them to lib/i18n/mt/proper-nouns.ts with a source, or leave them\n" +
        "   Latin deliberately — but decide, rather than letting the model invent one.",
    );
  }

  if (conflicts.length) {
    console.log(`\n── ${conflicts.length} row(s) disagree with the approved list`);
    for (const c of conflicts) console.log(`   !  ${c}`);
    console.log("   Not overwritten. Reconcile the list or the row deliberately.");
  }

  console.log(
    `\n${DRY ? "DRY RUN — nothing written." : `Wrote ${written} name(s).`}` +
      ` ${unknown.length} unlisted, ${conflicts.length} conflicting, ${failed} failed.`,
  );
  if (failed || conflicts.length) process.exit(1);
}

void main();
