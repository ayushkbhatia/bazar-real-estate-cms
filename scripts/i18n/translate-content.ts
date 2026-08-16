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
  if (!ALL && !PAGE) {
    console.error("Pass --page <key> or --all.");
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
  if (url && key) {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await sb.from("pages").select("slug, blocks").like("slug", "master/%");
    for (const row of (data ?? []) as { slug: string; blocks: unknown }[]) {
      const sections = Array.isArray(row.blocks)
        ? (row.blocks as { key: string; values: Record<string, unknown> }[])
        : [];
      storedFor.set(
        row.slug.replace("master/", ""),
        Object.fromEntries(sections.map((sec) => [sec.key, sec.values])),
      );
    }
    console.log(`Read live content for ${storedFor.size} page(s).`);
  } else {
    console.log("No Supabase credentials — walking registry defaults only.");
  }

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
  /** Translated and structurally clean; still has to survive the round trip. */
  const candidates: { job: Job; ar: string; model: string }[] = [];

  for (const [i, w] of model.entries()) {
    const label = `${w.page}/${w.section}.${w.pathKey}`;
    process.stdout.write(`[${i + 1}/${model.length}] ${label} … `);

    /*
     * A value that is ENTIRELY protected content needs no model at all.
     *
     * "Al Bateen" masks to a single sentinel, so the model is handed "⟦0⟧" and
     * asked to translate nothing; whatever it returns, the answer was already
     * decided by `overridesFor`. Sending it anyway wasted a call and then
     * failed the round trip, because البطين back-translates as "the belly" —
     * the anatomical sense of the root — and the comparator rightly rejected a
     * proper noun that had become a body part.
     *
     * The same applies to "ADREC & DLD", a bare phone number, or a price.
     */
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

  /*
   * The semantic gate.
   *
   * The nineteen structural checks have already run inside `translateField`.
   * They cannot see a sentence that is fluent, correctly formed, the right
   * length and about something else — which on the first /home run was six of
   * thirty-eight strings, every one of them reported clean.
   *
   * So each survivor is translated BACK to English by a model told nothing
   * about the domain, and a second model compares the two English strings. It
   * never sees the Arabic, so fluent Arabic cannot persuade it.
   *
   * Calibrated against 177 human-approved catalogue entries, 60 deliberately
   * mismatched pairs and 8 failures this project has actually shipped:
   * 8/8 known-bad caught, 60/60 mismatches rejected, and a 25% false-positive
   * rate that is uniform across length bands — round-tripping a terse term
   * through Arabic is simply lossy ("Deposit" comes back as "advance
   * payment").
   *
   * A blocked slot is NOT written, so it renders English — the designed
   * fallback — and appears in the report as something for a human to write.
   * That is the trade the false-positive rate buys: roughly three quarters of
   * the corpus translated and round-trip-verified, and a short list of the
   * rest, instead of everything translated and six in thirty-eight wrong.
   */
  if (candidates.length) {
    console.log(`\nRound-tripping ${candidates.length} translation(s)…`);
    const backs = await backTranslate({
      client,
      // Proper nouns go back to English first — see `restoreNames`. Without
      // this, البطين round-trips as "ventricle" and a correct translation is
      // rejected for a word the model was never asked to choose.
      items: candidates.map((c, i) => ({
        id: String(i),
        // House terms go back too — see `restoreGlossary`. على الخارطة is the
        // correct Arabic for "off-plan", and round-tripping it returns "on the
        // map", failing a translation for using the term the glossary requires.
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
        console.log(
          `  BLOCKED ${label}\n      en:   ${JSON.stringify(c.job.english.slice(0, 60))}` +
            `\n      back: ${JSON.stringify((backOf.get(String(i)) ?? "").slice(0, 60))}` +
            `\n      why:  ${v?.reason ?? "no verdict"}`,
        );
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
