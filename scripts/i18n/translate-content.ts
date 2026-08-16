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
import type { MasterPageDef } from "../../lib/master-pages/types";

const ROOT = join(import.meta.dirname, "..", "..");
const STORE_PATH = join(ROOT, "lib/master-pages/arabic/master.json");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const ALL = args.includes("--all");
/** Per-record area and development pages, whose copy is entirely in the database. */
const SUBPAGES = args.includes("--subpages");
const PAGE = args[args.indexOf("--page") + 1];
const LIMIT = args.includes("--limit")
  ? Number(args[args.indexOf("--limit") + 1])
  : Infinity;

type Entry = {
  ar: string;
  by: "machine" | "reviewed" | "human";
  model?: string;
  at?: string;
};
/** English → Arabic. See lib/master-pages/arabic.ts for why. */
type Store = Record<string, Entry>;

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
  for (const en of Object.keys(store).sort()) sorted[en] = store[en]!;
  writeFileSync(STORE_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

async function main() {
  if (!ALL && !PAGE && !SUBPAGES) {
    console.error("Pass --page <key>, --all, or --subpages.");
    process.exit(2);
  }

  const { MASTER_PAGES } = await import("../../lib/master-pages/pages");
  const { walkSection } = await import("../../lib/i18n/mt/bag");
  const { mergeValues } = await import("../../lib/master-pages/index");
  const { nounMap, nounTerms } = await import("../../lib/i18n/mt/proper-nouns");

  /*
   * The LIVE content, not the registry defaults.
   *
   * `mergeValues` puts the editor's stored English over the default, and that
   * is what the page renders. Generating from defaults alone left 303 slots
   * whose live English had been rewritten in the CMS with no Arabic at all —
   * measured against production. Reading the rows here is what makes the store
   * describe the site rather than the repo.
   *
   * Falls back to defaults-only when Supabase is unreachable, so `--dry-run`
   * still works with no credentials; it just under-reports.
   */
  const storedFor = new Map<string, Record<string, Record<string, unknown>>>();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let sb: Awaited<ReturnType<typeof makeClient>> | null = null;
  async function makeClient(u: string, k: string) {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(u, k, { auth: { persistSession: false } });
  }
  if (url && key) {
    sb = await makeClient(url, key);
    const { data } = await sb.from("pages").select("slug, blocks");
    for (const row of (data ?? []) as { slug: string; blocks: unknown }[]) {
      const sections = Array.isArray(row.blocks)
        ? (row.blocks as { key: string; values: Record<string, unknown> }[])
        : [];
      // Master pages are keyed by their bare key; subpages by their full slug.
      storedFor.set(
        row.slug.startsWith("master/") ? row.slug.replace("master/", "") : row.slug,
        Object.fromEntries(sections.map((sec) => [sec.key, sec.values])),
      );
    }
    console.log(`Read live content for ${storedFor.size} page(s).`);
  } else if (SUBPAGES) {
    console.error("--subpages needs Supabase credentials: all of its copy is in the database.");
    process.exit(2);
  } else {
    console.log("No Supabase credentials — walking registry defaults only.");
  }

  /*
   * Subpages are a different shape and it matters.
   *
   * `AREA_SECTIONS` and `DEVELOPMENT_SECTIONS` carry NO default copy —
   * `walkDefaults` over either returns zero slots. Every word on an area guide
   * or a project page lives in its own `pages` row, so there is nothing to
   * generate from the registry and the rows ARE the corpus: 24 areas, 13
   * developments.
   *
   * The def is built per record because the record's name appears inside field
   * labels and help text, which is why `areaPageDef` takes one at all.
   */
  let pages: { key: string; sections: MasterPageDef["sections"] }[];
  if (SUBPAGES) {
    const { areaPageDef, developmentPageDef, subPageSlug } =
      await import("../../lib/master-pages/subpages");
    pages = [];
    for (const kind of ["area", "development"] as const) {
      const table = kind === "area" ? "areas" : "developments";
      const { data } = await sb!.from(table).select("name, slug").order("name");
      for (const record of (data ?? []) as { name: string; slug: string }[]) {
        const slug = subPageSlug(kind, record.slug);
        if (!storedFor.has(slug)) continue; // no row, no content to translate
        const def = kind === "area" ? areaPageDef(record) : developmentPageDef(record);
        pages.push({ key: slug, sections: def.sections });
      }
    }
    console.log(`${pages.length} subpage(s) with stored content.`);
  } else {
    pages = MASTER_PAGES.filter((p) => ALL || p.key === PAGE);
    if (!pages.length) {
      console.error(
        `No such page: ${PAGE}\nKnown: ${MASTER_PAGES.map((p) => p.key).join(", ")}`,
      );
      process.exit(2);
    }
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
      const stored = storedFor.get(page.key)?.[section.key] ?? null;
      const slots = walkSection({
        fields: section.fields,
        values: mergeValues(section, stored as never),
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

  /*
   * One call per distinct English string, not per slot.
   *
   * The store is keyed by the English, so translating "Explore the area" twice
   * writes the same entry twice — and across 37 subpages built from one
   * template, the repetition is the bulk of the corpus. Deduping here is what
   * makes the volume run affordable, and it cannot change the result: two slots
   * with identical English are guaranteed identical Arabic by construction.
   */
  const seen = new Set<string>();
  const unique = work.filter((w) => {
    const en = w.english.trim();
    if (seen.has(en)) return false;
    seen.add(en);
    return true;
  });
  if (unique.length !== work.length) {
    console.log(
      `${work.length} slot(s) collapse to ${unique.length} distinct string(s).\n`,
    );
  }

  const todo = unique.slice(0, LIMIT);
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
    store[w.english.trim()] = { ar: w.english, by: "machine" };
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
  const { backTranslate, equivalence, restoreNames, restoreGlossary } =
    await import("../../lib/i18n/mt/backtranslate");

  const nouns = nounMap();
  const terms = nounTerms();
  const { mask, unmask } = await import("../../lib/i18n/mt/mask");
  const { overridesFor } = await import("../../lib/i18n/mt/proper-nouns");
  console.log(`\nProtecting ${terms.length} proper nouns.\n`);

  let ok = 0;
  const failures: string[] = [];

  /*
   * Chunked, and the store is written after every chunk.
   *
   * The subpage run is ~1,400 strings and several hours. Translating everything
   * and writing once at the end means a timeout, a rate limit or a dropped
   * connection loses the whole run. Writing per chunk bounds the loss to one
   * chunk, and — because a slot whose English is already in the store is
   * skipped on the next pass — re-running simply resumes.
   */
  const CHUNK = 25;
  for (let start = 0; start < model.length; start += CHUNK) {
    const batch = model.slice(start, start + CHUNK);
    const candidates: { job: Job; ar: string; model: string }[] = [];

    for (const [i, w] of batch.entries()) {
      const label = `${w.page}/${w.section}.${w.pathKey}`;
      process.stdout.write(`[${start + i + 1}/${model.length}] ${label} … `);

      const masked = mask(w.english, terms);
      if (masked.masked.replace(/⟦\d+⟧/gu, "").trim() === "") {
        const resolved = unmask(masked.masked, masked.tokens, overridesFor(masked, nouns));
        store[w.english.trim()] = { ar: resolved, by: "machine" };
        ok++;
        console.log(`${resolved}   [protected content, no model call]`);
        continue;
      }

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
      candidates.push({ job: w, ar: result.text, model: result.model });
      console.log(result.text.slice(0, 60));
    }

    if (candidates.length) {
      const backs = await backTranslate({
        client,
        items: candidates.map((c, i) => ({
          id: String(i),
          arabic: restoreGlossary(restoreNames(c.ar, nouns)),
        })),
      });
      const backOf = new Map(backs.map((b) => [b.id, b.english]));
      const verdicts = await equivalence({
        client,
        pairs: candidates.map((c, i) => ({
          id: String(i),
          source: c.job.english,
          back: backOf.get(String(i)) ?? "",
        })),
      });
      const verdictOf = new Map(verdicts.map((v) => [v.id, v]));

      for (const [i, c] of candidates.entries()) {
        const v = verdictOf.get(String(i));
        const label = `${c.job.page}/${c.job.section}.${c.job.pathKey}`;
        if (!v?.same) {
          failures.push(`${label} — round trip: ${v?.reason ?? "no verdict"}`);
          continue;
        }
        store[c.job.english.trim()] = {
          ar: c.ar,
          by: "machine",
          model: c.model,
          at: new Date().toISOString(),
        };
        ok++;
      }
    }

    writeStore(store);
    console.log(
      `── chunk ${Math.floor(start / CHUNK) + 1}: ${ok} written, ${failures.length} blocked so far\n`,
    );
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
