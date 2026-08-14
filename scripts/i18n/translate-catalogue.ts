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
 * Needs ANTHROPIC_API_KEY. Without it, --dry-run still works and still reports
 * what would be translated, which is the useful half when checking scope.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

/** One entry per machine-translated key. Absent means nobody has touched it. */
type Provenance = Record<
  string,
  { by: string; model: string; sourceHash: string; reviewed: boolean }
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

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);

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
    for (const [key, english] of Object.entries(en)) {
      if (typeof english !== "string") continue;
      const id = `${ns}.${key}`;
      if (identicalByDesign.has(id)) continue;
      const existing = ar[key];
      const prov = provenance[id];
      const stale = prov && prov.sourceHash !== hash(english);

      if (!existing) work.push({ ns, key, id, english, why: "missing" });
      else if (stale && INCLUDE_STALE)
        work.push({ ns, key, id, english, why: "source changed" });
      else if (existing === english)
        // Byte-identical is what messages.test.ts fails on. Always redo it —
        // it is either an untranslated placeholder or a paste-to-pass.
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

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "\nANTHROPIC_API_KEY is not set. --dry-run works without it; a real run does not.",
    );
    process.exit(2);
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Imported lazily so --dry-run needs neither the SDK nor a key. Run through
  // tsx: the lib chain uses extensionless imports, which Node's own
  // type-stripping will not resolve.
  const { translateField, MT_MODEL_PROSE } =
    await import("../../lib/i18n/mt/translate");
  const { translatePluralMessage, catalogueIssues, refuse } =
    await import("../../lib/i18n/catalogue-mt");
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

    const parsed = parseMessage(item.english);
    let value: string | null = null;
    let issues: { code: string; detail: string }[] = [];

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
        text: item.english,
        // UI strings are short and load-bearing; "title" is the register the
        // existing prompt uses for headline-shaped copy.
        kind: item.english.length > 160 ? "body" : "title",
      });
      if (res.ok) {
        value = res.text;
        issues = catalogueIssues(item.english, value);
      } else issues = res.issues;
    }

    if (!value || issues.length > 0) {
      failures.push({ ...item, issues });
      console.log(`  ✗ ${item.id}: ${issues.map((i) => i.code).join(", ")}`);
      continue;
    }

    (byNamespace[item.ns] ??= {})[item.key] = value;
    provenance[item.id] = {
      by: "machine",
      model: MT_MODEL_PROSE,
      sourceHash: hash(item.english),
      reviewed: false,
    };
    console.log(`  ✓ ${item.id}`);
  }

  for (const [ns, added] of Object.entries(byNamespace)) {
    const file = path.join(arDir, `${ns}.json`);
    const current = existsSync(file) ? read(file) : {};
    const merged: Record<string, unknown> = { ...current, ...added };
    const ordered = Object.fromEntries(
      Object.keys(read(path.join(enDir, `${ns}.json`)))
        .filter((k) => k in merged)
        .map((k) => [k, merged[k]]),
    );
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
