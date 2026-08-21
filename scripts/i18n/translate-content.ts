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
/** The 22 public lead forms: copy, field labels, and option labels. */
const FORMS = args.includes("--forms");
/** Search appearance: the `<title>` and description a result page shows. */
const SEO = args.includes("--seo");
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
  if (!ALL && !PAGE && !SUBPAGES && !FORMS && !SEO) {
    console.error("Pass --page <key>, --all, --subpages, --forms, or --seo.");
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
  /*
   * Forms are a different shape and get their own walk.
   *
   * A form is not a section document — there is no `FieldDef[]` and no
   * `SectionValues`, so `walkSection` does not apply. What it has is a resolved
   * copy bag of seven keys, a field list carrying four text keys each, and
   * option labels. `resolveForm` merges storage over the registry, so walking
   * its output means walking exactly what a visitor reads.
   */
  const work: Job[] = [];

  if (SEO) {
    /*
     * Two layers, and both matter.
     *
     * The CMS `seo` bag is what 16 pages actually publish today. The code
     * defaults are what the other routes publish, and what every page falls
     * back to when its CMS field is blank — which is most of them. Missing
     * either leaves an Arabic page carrying an English title into a search
     * result, which is worse than an untranslated page because it looks
     * finished.
     */
    const { MASTER_PAGE_SEO_DEFAULTS } = await import("../../lib/master-pages/seo-defaults");
    const { readSearchAppearance } = await import("../../lib/schemas/seo");

    const addSeo = (where: string, what: string, english: unknown, max: number) => {
      if (typeof english !== "string" || !english.trim()) return;
      work.push({
        page: `seo:${where}`,
        section: "meta",
        pathKey: what,
        english,
        kind: "page",
        maxLength: Math.ceil(max * 1.5),
        identity: false,
      });
    };

    for (const [key, d] of Object.entries(MASTER_PAGE_SEO_DEFAULTS)) {
      addSeo(key, "default.title", d.title, 70);
      addSeo(key, "default.description", d.description, 200);
    }

    if (sb) {
      const { data } = await sb.from("pages").select("slug, seo");
      for (const row of (data ?? []) as { slug: string; seo: unknown }[]) {
        const seo = readSearchAppearance(row.seo as never);
        addSeo(row.slug, "meta_title", seo.meta_title, 70);
        addSeo(row.slug, "meta_description", seo.meta_description, 200);
      }
    }
    console.log(`${work.length} search-appearance string(s).`);
  }

  if (FORMS) {
    const { FORM_DEFS } = await import("../../lib/forms/registry");
    const { resolveForm } = await import("../../lib/forms/resolve");
    const { FORM_COPY_KEYS, copyArKey } = await import("../../lib/forms/copy-keys");
    const { nonProseReason } = await import("../../lib/i18n/prose");

    /*
     * The LIVE fields, not just the registry ones.
     *
     * This walk used to read `form_fields` and then discard it — the rows are
     * keyed by `form_id` rather than by form key, and joining them was left as
     * "enough for a first pass". It was not: the registry says "Email address"
     * and the client's CMS says "Email Address", and the store is keyed by the
     * exact English, so every label an editor has retyped falls outside the
     * corpus. That is not a rare case — all seven fields on the area guide's
     * consultation form were retyped, and three of them are still English on
     * every `/ar/areas/*` page today.
     *
     * The join is one extra select on `forms.id`, and after it `resolveForm`
     * gets the same two arguments the site gives it, so this walk sees exactly
     * the strings a visitor reads.
     */
    const storedForms = new Map<string, unknown>();
    const storedFields = new Map<string, unknown[]>();
    if (sb) {
      const { data: forms } = await sb.from("forms").select("id, key, enabled, copy, notify_emails");
      const keyById = new Map<string, string>();
      for (const row of (forms ?? []) as { id: string; key: string }[]) {
        storedForms.set(row.key, row);
        keyById.set(row.id, row.key);
      }
      const { data: fields } = await sb
        .from("form_fields")
        .select("id, form_id, key, label, label_ar, type, mapping, placeholder, placeholder_ar, help, help_ar, required, enabled, width, options, option_source, rows, min_value, max_value, step, unit, unit_ar, show_when, locked, position");
      for (const row of (fields ?? []) as { form_id: string }[]) {
        const key = keyById.get(row.form_id);
        if (!key) continue;
        const list = storedFields.get(key) ?? [];
        list.push(row);
        storedFields.set(key, list);
      }
      console.log(
        `Read ${storedForms.size} stored form(s) and ` +
          `${(fields ?? []).length} stored field row(s).`,
      );
    }

    const add = (formKey: string, path: string, english: unknown, max: number) => {
      if (typeof english !== "string" || !english.trim()) return;
      work.push({
        page: `form:${formKey}`,
        section: "copy",
        pathKey: path,
        english,
        // Form chrome is interface text, not marketing: a label reading "Fixed"
        // or "Optional" is exactly what `ui` was written for. The two long
        // fields are prose and get `page`.
        kind: max >= 300 ? "page" : "ui",
        maxLength: Math.ceil(max * 1.5),
        identity: nonProseReason(english) !== null,
      });
    };

    for (const def of FORM_DEFS) {
      const form = resolveForm(
        def.key,
        (storedForms.get(def.key) ?? null) as never,
        (storedFields.get(def.key) ?? null) as never,
      );
      if (!form) continue;
      const copy = form.copy as Record<string, unknown>;
      for (const k of FORM_COPY_KEYS) {
        // `resolveForm` has already filled every twin the store can supply, so
        // a blank one is genuinely missing. Without this guard the copy keys
        // were added unconditionally and every run re-translated all 22 forms'
        // chrome — burning the budget and overwriting reviewed entries with a
        // fresh machine draft. The field loop below has always guarded.
        if (copy[copyArKey(k.key)]) continue;
        add(def.key, `copy.${k.key}`, copy[k.key], k.max);
      }
      for (const field of form.fields) {
        const f = field as unknown as Record<string, unknown>;
        if (!f.label_ar) add(def.key, `${String(f.key)}.label`, f.label, 80);
        if (!f.placeholder_ar) add(def.key, `${String(f.key)}.placeholder`, f.placeholder, 120);
        if (!f.help_ar) add(def.key, `${String(f.key)}.help`, f.help, 200);
        if (!f.unit_ar) add(def.key, `${String(f.key)}.unit`, f.unit, 20);
        for (const [i, opt] of ((f.options ?? []) as { label: string; label_ar?: string | null }[]).entries()) {
          if (!opt.label_ar) add(def.key, `${String(f.key)}.options[${i}].label`, opt.label, 80);
        }
      }
    }
    console.log(`${FORM_DEFS.length} form(s) walked.`);
  }

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
  } else if (FORMS || SEO) {
    pages = [];
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
    /*
     * The section walk drops a translated slot for us — `walkSection` runs
     * after `withArabicDefaults`, so an entry already in the store comes back
     * with `arabic` populated. The `--forms` and `--seo` walks have no such
     * step and pushed every string they found, so a second run re-translated
     * the whole corpus and OVERWROTE it, downgrading any entry a person had
     * since corrected to `by: "reviewed"` back to a fresh machine draft.
     *
     * Checking the store here makes all three walks agree: a string that has
     * Arabic is done. Re-running `--forms` after an editor retypes one label
     * now costs one call rather than ninety.
     */
    return !store[en];
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

  if (!process.env.ANTHROPIC_API_KEY && !process.env.HF_TOKEN) {
    writeStore(store);
    console.error(
      "\nNo model credentials. The verbatim slots were written; translating " +
        "the rest needs ANTHROPIC_API_KEY, or HF_TOKEN for the Hugging Face " +
        "router.\n" +
        "Either way this is an AUTHORING-time key only — nothing in production " +
        "ever calls a model to render the Arabic this produces.",
    );
    process.exit(2);
  }

  const { mtClientFromEnv } = await import("../../lib/i18n/mt/hf-client");
  const { client, proseModel, fastModel, provider } = await mtClientFromEnv();
  const { translateField } = await import("../../lib/i18n/mt/translate");
  console.log(`Provider: ${provider} · ${proseModel}`);
  if (provider !== "anthropic") {
    console.log(
      "Note: every calibration figure in this repo — the 8/8 known-bad recall,\n" +
        "the 25% false-positive rate, the register decisions — was measured\n" +
        "against Anthropic. Expect a different pass rate. What ships is still\n" +
        "gated the same way, so a weaker model costs coverage, not correctness.",
    );
  }
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
        model: w.kind === "alt" ? fastModel : proseModel,
        // One model, so there is nowhere to fall back TO. On Anthropic this is
        // the Haiku re-roll; on a single-model provider it would just repeat.
        fallbackModel: provider === "anthropic" ? undefined : null,
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
