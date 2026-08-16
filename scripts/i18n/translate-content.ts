/**
 * Generate the Arabic first draft for a master page.
 *
 * Output goes to `lib/master-pages/arabic/master.json`, which the registry
 * folds into each section's `defaults` — see `lib/master-pages/arabic.ts`. So
 * this writes a reviewable data file in the repo, not a row in the client's
 * database, and production never calls a model to render what it produces.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/i18n/translate-content.ts --page home --dry-run
 *   npx tsx --env-file-if-exists=.env.local scripts/i18n/translate-content.ts --page home
 *   npx tsx --env-file-if-exists=.env.local scripts/i18n/translate-content.ts --all
 *
 * Contract, copied deliberately from `translate-catalogue.ts`:
 *
 *   - the work list is built BEFORE any API call, so `--dry-run` reports
 *     exactly what a real run would do;
 *   - successes are written even when some slots fail, and the process still
 *     exits non-zero, so a re-run retries only what failed;
 *   - the SDK is imported lazily, so `--dry-run` needs neither it nor a key.
 *
 * A slot is skipped when its Arabic is already present AND was made from the
 * same English. Editing an English headline makes its Arabic stale, and the
 * next run re-does exactly that one.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const STORE_PATH = join(ROOT, "lib/master-pages/arabic/master.json");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const ALL = args.includes("--all");
const PAGE = args[args.indexOf("--page") + 1];
const LIMIT = args.includes("--limit")
  ? Number(args[args.indexOf("--limit") + 1])
  : Infinity;

type Entry = {
  en: string;
  ar: string;
  by: "machine" | "reviewed" | "human";
  model?: string;
  at?: string;
};
type Store = Record<string, Record<string, Record<string, Entry>>>;

function readStore(): Store {
  try {
    return JSON.parse(readFileSync(STORE_PATH, "utf8")) as Store;
  } catch {
    return {};
  }
}

/** Sorted on the way out, so a re-run produces a diff of only what changed. */
function writeStore(store: Store) {
  const sorted: Store = {};
  for (const page of Object.keys(store).sort()) {
    sorted[page] = {};
    for (const section of Object.keys(store[page]!).sort()) {
      sorted[page]![section] = {};
      for (const key of Object.keys(store[page]![section]!).sort()) {
        sorted[page]![section]![key] = store[page]![section]![key]!;
      }
    }
  }
  writeFileSync(STORE_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

async function main() {
  if (!ALL && !PAGE) {
    console.error("Pass --page <key> or --all.");
    process.exit(2);
  }

  const { MASTER_PAGES } = await import("../../lib/master-pages/pages");
  const { walkSection } = await import("../../lib/i18n/mt/bag");
  const { nounMap, nounTerms } = await import("../../lib/i18n/mt/proper-nouns");

  const pages = MASTER_PAGES.filter((p) => ALL || p.key === PAGE);
  if (!pages.length) {
    console.error(
      `No such page: ${PAGE}\nKnown: ${MASTER_PAGES.map((p) => p.key).join(", ")}`,
    );
    process.exit(2);
  }

  const store = readStore();

  /*
   * The work list, built first.
   *
   * `walkSection` runs against the registry AFTER `withArabicDefaults`, so a
   * slot whose Arabic is already stored and still matches its English comes
   * back with `arabic` populated and is skipped here. Staleness needs no
   * separate pass: an edited English no longer matches, the fold drops it, and
   * the slot reappears as work.
   */
  type Job = {
    page: string;
    section: string;
    pathKey: string;
    english: string;
    kind: string;
    maxLength?: number;
    identity: boolean;
  };
  const work: Job[] = [];

  for (const page of pages) {
    for (const section of page.sections) {
      const slots = walkSection({
        fields: section.fields,
        values: section.defaults,
        docKey: `master:${page.key}`,
        sectionKey: section.key,
      });
      for (const slot of slots) {
        if (slot.arabic) continue;
        work.push({
          page: page.key,
          section: section.key,
          pathKey: slot.pathKey,
          english: slot.english,
          kind: slot.kind,
          maxLength: slot.maxLength,
          identity: slot.why === "identity",
        });
      }
    }
  }

  const todo = work.slice(0, LIMIT);
  const identity = todo.filter((w) => w.identity);
  const model = todo.filter((w) => !w.identity);

  console.log(
    `${todo.length} slot(s): ${model.length} to translate, ` +
      `${identity.length} copied verbatim (data, not language)\n`,
  );
  for (const w of todo) {
    const tag = w.identity ? "=" : w.kind.padEnd(7);
    console.log(
      `  ${tag} ${w.page}/${w.section}.${w.pathKey}` +
        `${w.maxLength ? ` (≤${w.maxLength})` : ""}\n      ${JSON.stringify(w.english).slice(0, 110)}`,
    );
  }
  if (DRY) {
    console.log("\nDRY RUN — nothing written.");
    return;
  }

  // Identity slots need no key, so they are written even in a keyless run.
  for (const w of identity) {
    ((store[w.page] ??= {})[w.section] ??= {})[w.pathKey] = {
      en: w.english,
      ar: w.english,
      by: "machine",
    };
  }

  if (model.length === 0) {
    writeStore(store);
    console.log(`\nWrote ${identity.length} verbatim slot(s). Nothing to translate.`);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    writeStore(store);
    console.error(
      "\nANTHROPIC_API_KEY is not set. The verbatim slots were written; " +
        "translating the rest needs a key.\n" +
        "Note this is an AUTHORING-time key only — nothing in production ever " +
        "calls a model to render the Arabic this produces.",
    );
    process.exit(2);
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { translateField } = await import("../../lib/i18n/mt/translate");

  const nouns = nounMap();
  const terms = nounTerms();
  console.log(`\nProtecting ${terms.length} proper nouns.\n`);

  let ok = 0;
  const failures: string[] = [];

  for (const [i, w] of model.entries()) {
    const label = `${w.page}/${w.section}.${w.pathKey}`;
    process.stdout.write(`[${i + 1}/${model.length}] ${label} … `);

    const result = await translateField({
      client,
      text: w.english,
      kind: w.kind as never,
      maxLength: w.maxLength,
      properNouns: nouns,
    });

    if (!result.ok) {
      const why = result.issues.map((issue) => issue.code).join(", ");
      console.log(`FAILED (${why})`);
      failures.push(`${label} — ${why}`);
      continue;
    }

    ((store[w.page] ??= {})[w.section] ??= {})[w.pathKey] = {
      en: w.english,
      ar: result.text,
      by: "machine",
      model: result.model,
      at: new Date().toISOString(),
    };
    ok++;
    console.log(result.text.slice(0, 60));
  }

  writeStore(store);

  console.log(
    `\nWrote ${ok + identity.length} slot(s) ` +
      `(${ok} translated, ${identity.length} verbatim). ${failures.length} failed.`,
  );
  if (failures.length) {
    console.log("\nFailed, and left as English — re-run to retry only these:");
    for (const f of failures) console.log(`  ${f}`);
    process.exit(1);
  }
}

void main();
