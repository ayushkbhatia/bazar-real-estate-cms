/**
 * Fill `messages/ar/*.json` from `messages/en/*.json`.
 *
 * This is what makes an extraction wave a single PR. `messages.test.ts:107`
 * rejects an Arabic value byte-identical to its English, so there is no
 * "extract now, translate later" state that CI will accept — every key must
 * land with real Arabic in the same commit. Running this inside the extraction
 * PR is how that happens without a human in the loop for the mechanical 95%.
 *
 * The human pass is after, not instead: `_provenance.json` records which values
 * a model produced so a reviewer can see exactly what has not been read yet.
 *
 *   npm run i18n:translate                  # missing keys only
 *   npm run i18n:translate -- --namespace nav
 *   npm run i18n:translate -- --stale       # + keys whose English changed since
 *   npm run i18n:translate -- --dry-run     # list the work, translate nothing
 *
 * Needs ANTHROPIC_API_KEY, or HF_TOKEN for the Hugging Face router (see
 * `lib/i18n/mt/hf-client.ts`). Without either, --dry-run still works and reports
 * what would be translated, which is the useful half when checking scope.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Eager, unlike the rest of the lib chain: the work list is built before the
// SDK is imported, and whether a message has any words in it decides whether
// it belongs on that list at all.
import { isStructural } from "../../lib/i18n/catalogue-mt";
import { mask } from "../../lib/i18n/mt/mask";
import { numeralOverrides } from "../../lib/i18n/mt/numerals";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const valueOf = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : null;
};

const DRY = has("--dry-run");
const INCLUDE_STALE = has("--stale");
const ONLY_NS = valueOf("--namespace");

const read = (p: string): Record<string, unknown> =>
  JSON.parse(readFileSync(p, "utf8"));
const enDir = path.join(ROOT, "messages", "en");
const arDir = path.join(ROOT, "messages", "ar");
const provPath = path.join(arDir, "_provenance.json");

/**
 * One entry per key the pipeline has touched. Absent means nobody has.
 *
 * `model` is null for a `structural` entry — a message made only of
 * placeholders and punctuation is copied across without a model seeing it, and
 * naming one there would claim a translation that never happened.
 */
type Provenance = Record<
  string,
  {
    /**
     * `human` is set by hand when a reviewer replaces a machine string — the
     * script never writes it, and never overwrites one either, because a
     * hand-fixed value is not "missing" and is not identical to its English.
     */
    by: "machine" | "structural" | "human";
    model: string | null;
    sourceHash: string;
    reviewed: boolean;
  }
>;

/** Namespaces the app actually loads — not whatever is on disk. */
const namespaces = (() => {
  const src = readFileSync(
    path.join(ROOT, "lib", "i18n", "namespaces.ts"),
    "utf8",
  );
  const block = src.slice(src.indexOf("export const NAMESPACES"));
  return [...block.slice(0, block.indexOf("]")).matchAll(/"([\w-]+)"/g)].map(
    (m) => m[1],
  );
})();

/** Read a dotted path out of a possibly-nested bag. */
const at = (bag: Record<string, unknown>, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (o, k) =>
        o && typeof o === "object"
          ? (o as Record<string, unknown>)[k]
          : undefined,
      bag,
    );

/** Write a dotted path into a possibly-nested bag, creating parents. */
function put(bag: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split(".");
  let node = bag;
  for (const k of parts.slice(0, -1)) {
    if (typeof node[k] !== "object" || node[k] === null) node[k] = {};
    node = node[k] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]!] = value;
}

const hash = (s: string) =>
  createHash("sha256").update(s).digest("hex").slice(0, 12);

/**
 * Keys whose Arabic is legitimately the English. Parsed from the shared
 * constant rather than duplicated — a second copy is how the translator starts
 * fighting the test that permits them.
 */
const identicalByDesign = (() => {
  const src = readFileSync(
    path.join(ROOT, "lib", "i18n", "namespaces.ts"),
    "utf8",
  );
  const block = src.slice(src.indexOf("export const IDENTICAL_BY_DESIGN"));
  return new Set(
    [...block.slice(0, block.indexOf("]")).matchAll(/"([\w.]+)"/g)].map(
      (m) => m[1],
    ),
  );
})();

async function main() {
  const targets = ONLY_NS ? [ONLY_NS] : namespaces;
  const provenance: Provenance = existsSync(provPath)
    ? (read(provPath) as Provenance)
    : {};

  // Pass 1: decide the work before doing any of it, so --dry-run reports the
  // same set the real run would translate.
  const work: {
    ns: string;
    key: string;
    id: string;
    english: string;
    why: string;
  }[] = [];
  for (const ns of targets) {
    const en = read(path.join(enDir, `${ns}.json`));
    const ar = existsSync(path.join(arDir, `${ns}.json`))
      ? read(path.join(arDir, `${ns}.json`))
      : {};
    /*
     * Walks nested objects. The catalogue was flat at 39 keys; the waves
     * introduce grouping (`search.mode.buy.eyebrow`) because eighteen
     * enum-keyed strings flattened into `modeBuyEyebrow` is unreadable.
     * `messages.test.ts` already handles arbitrary nesting via keyPaths — this
     * script did not, and would have skipped every grouped key in silence.
     */
    const flatten = (
      bag: Record<string, unknown>,
      prefix = "",
    ): [string, string][] =>
      Object.entries(bag).flatMap(([k, v]) =>
        typeof v === "string"
          ? [[prefix + k, v] as [string, string]]
          : v && typeof v === "object"
            ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
            : [],
      );

    for (const [key, english] of flatten(en)) {
      const id = `${ns}.${key}`;
      if (identicalByDesign.has(id)) continue;
      const existing = at(ar, key);
      const prov = provenance[id];
      const stale = prov && prov.sourceHash !== hash(english);

      if (!existing) work.push({ ns, key, id, english, why: "missing" });
      else if (stale && INCLUDE_STALE)
        work.push({ ns, key, id, english, why: "source changed" });
      else if (existing === english && !isStructural(english))
        // Byte-identical is what messages.test.ts fails on. Always redo it —
        // it is either an untranslated placeholder or a paste-to-pass.
        //
        // Unless the message has no words in it: "{pct} · {amount}" is
        // *supposed* to come out identical, and without this clause it goes
        // back on the work list on every run forever.
        work.push({ ns, key, id, english, why: "identical to English" });
    }
  }

  if (work.length === 0) {
    console.log("Nothing to translate.");
    return;
  }

  console.log(`${work.length} message(s) to translate:`);
  for (const w of work) console.log(`  ${w.id.padEnd(34)} ${w.why}`);
  if (DRY) return;

  if (!process.env.ANTHROPIC_API_KEY && !process.env.HF_TOKEN) {
    console.error(
      "\nNo model credentials. --dry-run works without them; a real run needs " +
        "ANTHROPIC_API_KEY, or HF_TOKEN for the Hugging Face router.",
    );
    process.exit(2);
  }

  /*
   * Through the provider shim, like the content and record translators.
   *
   * This script was the last one still constructing the Anthropic SDK itself,
   * which is why the W6b message keys had to be hand-written the day the key
   * was revoked: the content pipeline had a second provider and the CATALOGUE
   * did not. One `mtClientFromEnv` and it does.
   */
  const { mtClientFromEnv } = await import("../../lib/i18n/mt/hf-client");
  const { client, proseModel, provider } = await mtClientFromEnv();
  console.log(`Provider: ${provider} · ${proseModel}\n`);

  // Imported lazily so --dry-run needs neither the SDK nor a key. Run through
  // tsx: the lib chain uses extensionless imports, which Node's own
  // type-stripping will not resolve.
  const { translateField } = await import("../../lib/i18n/mt/translate");
  const MT_MODEL_PROSE = proseModel;
  const {
    translatePluralMessage,
    catalogueIssues,
    refuse,
    stripMarkdownHeading,
  } = await import("../../lib/i18n/catalogue-mt");
  const { parseMessage } = await import("../../lib/i18n/icu");

  const failures: { id: string; issues: { code: string; detail: string }[] }[] =
    [];
  const byNamespace: Record<string, Record<string, string>> = {};

  for (const item of work) {
    const refusal = refuse(item.english);
    if (refusal) {
      failures.push({ ...item, issues: [refusal] });
      continue;
    }

    // "{pct} · {amount}" has no words in it. Sending it costs a call and the
    // honest answer comes back identical, which the parity test then fails.
    if (isStructural(item.english)) {
      put((byNamespace[item.ns] ??= {}), item.key, item.english);
      provenance[item.id] = {
        by: "structural",
        model: null,
        sourceHash: hash(item.english),
        reviewed: true,
      };
      console.log(`  = ${item.id} (no words to translate)`);
      continue;
    }

    const parsed = parseMessage(item.english);
    let value: string | null = null;
    let issues: { code: string; detail: string }[] = [];
    let usedModel: string = MT_MODEL_PROSE;

    if (parsed.kind === "plural") {
      // Never handed to the prose model whole: English offers two categories
      // and Arabic needs six, so `two` and `few` have to be generated from the
      // meaning rather than translated from a form that does not exist.
      const res = await translatePluralMessage({
        client,
        message: item.english,
        model: MT_MODEL_PROSE,
      });
      if (res.ok) value = res.value;
      else issues = res.issues;
    } else {
      const res = await translateField({
        client,
        model: proseModel,
        // One model, so there is nowhere to fall back TO. On Anthropic this is
        // the Haiku re-roll; elsewhere it would just repeat the same call.
        fallbackModel: provider === "anthropic" ? undefined : null,
        text: item.english,
        /*
         * `ui`, not `title`.
         *
         * The catalogue was being translated under the listing prompt, which
         * opens "You translate Emirati property listings" — so every
         * ambiguous label resolved toward property vocabulary. "Optional"
         * came back as فاخر (luxury), "Comfortable" as شقة مريحة (a
         * comfortable apartment), and "fixed" as a whole listing blurb about
         * a fixed tenancy. All three are defensible translations of the word
         * in a listing and none of them is a button, and nothing in the
         * validator can see the difference: right length, right digits, no
         * Latin, no sentinel drift.
         */
        kind: "ui",
        /*
         * The half the catalogue was missing.
         *
         * `translate-columns.ts` and `repair-blocks.ts` have always passed
         * this; the catalogue never did. So a money token in a CMS block came
         * back as "4.2 مليون درهم" while the same token in a catalogue string
         * was restored byte-for-byte as "AED 4.2M" — masking working exactly
         * as designed, and nothing reporting the difference because a
         * protected token is *supposed* to survive intact.
         *
         * That is where the 28 `AED 2M`s in messages/ar/{guides,tools}.json
         * came from. They are rewritten in this commit; this line is what
         * stops the next translated key adding a 29th.
         */
        overrides: numeralOverrides(mask(item.english)),
      });
      if (res.ok) {
        usedModel = res.model;
        // Applied before validation, not after: a stray heading marker would
        // otherwise trip `hash-invented` and send a perfectly good translation
        // to the human queue.
        value = stripMarkdownHeading(item.english, res.text);
        issues = catalogueIssues(item.english, value);
      } else issues = res.issues;
    }

    if (!value || issues.length > 0) {
      failures.push({ ...item, issues });
      console.log(`  ✗ ${item.id}: ${issues.map((i) => i.code).join(", ")}`);
      continue;
    }

    put((byNamespace[item.ns] ??= {}), item.key, value);
    provenance[item.id] = {
      by: "machine",
      // The model that actually answered, which is not always the one asked:
      // `translateField` falls back to the bulk model when the prose model
      // refuses outright. Recording the primary regardless made the one field
      // provenance exists to carry a lie.
      model: usedModel,
      sourceHash: hash(item.english),
      reviewed: false,
    };
    console.log(`  ✓ ${item.id}`);
  }

  /* Deep-merge and re-order to match the English, at every level. A shallow
   * spread would drop sibling keys inside a nested group. */
  const mergeInto = (
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> => {
    for (const [k, v] of Object.entries(source)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const next =
          target[k] && typeof target[k] === "object"
            ? (target[k] as Record<string, unknown>)
            : {};
        target[k] = mergeInto(next, v as Record<string, unknown>);
      } else target[k] = v;
    }
    return target;
  };

  const orderLike = (
    shape: Record<string, unknown>,
    bag: Record<string, unknown>,
  ): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(shape)) {
      if (!(k in bag)) continue;
      const s = shape[k];
      out[k] =
        s && typeof s === "object" && !Array.isArray(s)
          ? orderLike(
              s as Record<string, unknown>,
              bag[k] as Record<string, unknown>,
            )
          : bag[k];
    }
    return out;
  };

  for (const [ns, added] of Object.entries(byNamespace)) {
    const file = path.join(arDir, `${ns}.json`);
    const current = existsSync(file) ? read(file) : {};
    const merged = mergeInto({ ...current }, added);
    const ordered = orderLike(read(path.join(enDir, `${ns}.json`)), merged);
    writeFileSync(file, `${JSON.stringify(ordered, null, 2)}\n`);
  }
  writeFileSync(provPath, `${JSON.stringify(provenance, null, 2)}\n`);

  if (failures.length > 0) {
    console.error(`\n${failures.length} message(s) need a human:`);
    for (const f of failures)
      console.error(
        `  ${f.id}: ${f.issues.map((i) => `${i.code} — ${i.detail}`).join("; ")}`,
      );
    // Non-zero so a wave PR cannot be opened with silent holes. The written
    // namespaces still hold everything that succeeded, so a re-run only
    // retries what failed.
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
