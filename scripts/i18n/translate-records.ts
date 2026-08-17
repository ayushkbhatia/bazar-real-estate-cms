/**
 * Phase 7 — the flat database columns.
 *
 * Everything up to here has been jsonb documents whose Arabic ships as
 * committed source. This is the other shape: one row, one column, one Arabic
 * twin beside it. `properties.title_ar` has existed since migration 0101, the
 * editor writes it, `localiseRow` folds it — and outside the eighteen rows
 * someone pressed the per-field button on, nothing has ever filled it.
 *
 * ## Why this one writes to the database
 *
 * The content store is keyed by English and lives in the repo, which is right
 * for copy that belongs to a PAGE: it is reviewed as a diff and it renders with
 * no migration. A property's title belongs to a RECORD. It changes when an
 * advisor edits the listing, it is different for every row, and its Arabic twin
 * is a real column with an editor already pointed at it. Putting that in a JSON
 * file in the repo would be inventing a second source of truth for a field that
 * already has one.
 *
 * So the same generator and the same gates, and a different destination.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/i18n/translate-records.ts --dry-run
 *   MT_PROVIDER=huggingface npx tsx --env-file-if-exists=.env.local scripts/i18n/translate-records.ts --table properties
 *
 * The allowlist is `MT_TARGETS`, not this file: a column absent from it is not
 * translated, and `PROTECTED_FIELDS` makes adding the wrong one a test failure.
 */
import { createClient } from "@supabase/supabase-js";
import { MT_TARGETS, arColumn, isProtected, type MtTarget } from "../../lib/i18n/mt/targets";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const TABLE = args.includes("--table") ? args[args.indexOf("--table") + 1] : null;
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;

type Row = Record<string, unknown> & { id: string };

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(2);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const targets = MT_TARGETS.filter((t) => !TABLE || t.table === TABLE);
  if (!targets.length) {
    console.error(
      `No targets for "${TABLE}". Known: ${[...new Set(MT_TARGETS.map((t) => t.table))].join(", ")}`,
    );
    process.exit(2);
  }

  /*
   * The denylist is checked here as well as in the tests.
   *
   * `domains.test.ts` already fails the build if a `never` column reaches
   * `MT_TARGETS`, so this is belt and braces — but the cost of being wrong is a
   * machine translation of a permit number on a DLD-regulated surface, and a
   * second check costs one line.
   */
  for (const t of targets) {
    if (isProtected(t.table, t.column)) {
      console.error(`REFUSING ${t.table}.${t.column}: it is in PROTECTED_FIELDS.`);
      process.exit(1);
    }
  }

  type Job = { target: MtTarget; id: string; english: string };
  const work: Job[] = [];
  const byTable = new Map<string, MtTarget[]>();
  for (const t of targets) byTable.set(t.table, [...(byTable.get(t.table) ?? []), t]);

  for (const [table, cols] of byTable) {
    const select = ["id", ...cols.flatMap((c) => [c.column, arColumn(c)])].join(", ");
    const { data, error } = await sb.from(table).select(select);
    if (error) {
      console.error(`${table}: ${error.message}`);
      continue;
    }
    for (const row of (data ?? []) as unknown as Row[]) {
      for (const col of cols) {
        const english = row[col.column];
        // Already translated, or nothing to translate. A twin an editor wrote
        // outranks anything generated, so it is never revisited.
        if (row[arColumn(col)]) continue;
        if (typeof english !== "string" || !english.trim()) continue;
        work.push({ target: col, id: row.id, english });
      }
    }
    console.log(`${table}: ${(data ?? []).length} row(s)`);
  }

  const todo = work.slice(0, LIMIT);
  console.log(`\n${todo.length} column value(s) to translate:\n`);
  for (const w of todo.slice(0, 40)) {
    console.log(
      `  ${w.target.table}.${w.target.column}  ${w.id.slice(0, 8)}  ${JSON.stringify(w.english.slice(0, 70))}`,
    );
  }
  if (todo.length > 40) console.log(`  … and ${todo.length - 40} more`);
  if (DRY) {
    console.log("\nDRY RUN — nothing written.");
    return;
  }

  const { mtClientFromEnv } = await import("../../lib/i18n/mt/hf-client");
  const { client, proseModel, fastModel, provider } = await mtClientFromEnv();
  const { translateField } = await import("../../lib/i18n/mt/translate");
  const { backTranslate, equivalence, restoreNames, restoreGlossary } =
    await import("../../lib/i18n/mt/backtranslate");
  const { nounMap } = await import("../../lib/i18n/mt/proper-nouns");
  const nouns = nounMap();
  console.log(`\nProvider: ${provider} · ${proseModel}\n`);

  let ok = 0;
  const failures: string[] = [];
  const CHUNK = 10;

  for (let start = 0; start < todo.length; start += CHUNK) {
    const batch = todo.slice(start, start + CHUNK);
    const candidates: { job: Job; ar: string }[] = [];

    for (const [i, w] of batch.entries()) {
      const label = `${w.target.table}.${w.target.column} ${w.id.slice(0, 8)}`;
      process.stdout.write(`[${start + i + 1}/${todo.length}] ${label} … `);
      const result = await translateField({
        client,
        text: w.english,
        kind: w.target.kind,
        maxLength: w.target.maxLength,
        properNouns: nouns,
        model: w.target.kind === "alt" ? fastModel : proseModel,
        fallbackModel: provider === "anthropic" ? undefined : null,
      });
      if (!result.ok) {
        const why = result.issues.map((x) => x.code).join(", ");
        console.log(`FAILED (${why})`);
        failures.push(`${label} — ${why}`);
        continue;
      }
      candidates.push({ job: w, ar: result.text });
      console.log(result.text.slice(0, 50));
    }

    if (candidates.length) {
      const backs = await backTranslate({
        client,
        model: fastModel,
        items: candidates.map((c, i) => ({
          id: String(i),
          arabic: restoreGlossary(restoreNames(c.ar, nouns)),
        })),
      });
      const backOf = new Map(backs.map((b) => [b.id, b.english]));
      const verdicts = await equivalence({
        client,
        model: fastModel,
        pairs: candidates.map((c, i) => ({
          id: String(i),
          source: c.job.english,
          back: backOf.get(String(i)) ?? "",
        })),
      });
      const verdictOf = new Map(verdicts.map((v) => [v.id, v]));

      for (const [i, c] of candidates.entries()) {
        const v = verdictOf.get(String(i));
        const label = `${c.job.target.table}.${c.job.target.column} ${c.job.id.slice(0, 8)}`;
        if (!v?.same) {
          console.log(`  BLOCKED ${label} — ${v?.reason ?? "no verdict"}`);
          failures.push(`${label} — round trip: ${v?.reason ?? "no verdict"}`);
          continue;
        }
        const { error } = await sb
          .from(c.job.target.table)
          .update({ [arColumn(c.job.target)]: c.ar })
          .eq("id", c.job.id);
        if (error) {
          failures.push(`${label} — write failed: ${error.message}`);
          continue;
        }
        ok++;
      }
    }
    console.log(`── chunk ${Math.floor(start / CHUNK) + 1}: ${ok} written, ${failures.length} blocked\n`);
  }

  console.log(`\nWrote ${ok}. ${failures.length} blocked and left English.`);
  for (const f of failures) console.log(`  ${f}`);
  if (failures.length) process.exit(1);
}

void main();
