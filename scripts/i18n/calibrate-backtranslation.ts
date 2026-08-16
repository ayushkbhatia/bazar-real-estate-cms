/**
 * Derive the back-translation thresholds, rather than picking them.
 *
 * Three classes, none of which needs hand labelling:
 *
 *   POSITIVE  the 200 catalogue entries marked `by: "human"` — Arabic somebody
 *             read and approved. Round-tripped, these are what "agrees" looks
 *             like on this corpus.
 *   NULL      the same Arabic, scored against a DIFFERENT English of the same
 *             length band. This is the distribution of agreement-by-chance,
 *             and it is the one that matters: cosine and token overlap between
 *             two unrelated short strings are much higher than intuition says.
 *   KNOWN-BAD the failures this project has actually shipped and caught. These
 *             are the specification. A threshold that does not flag all of
 *             them is not a gate.
 *
 * The threshold per band is the 99th percentile of NULL — i.e. tight enough
 * that chance agreement almost never passes — and it is only usable if
 * KNOWN-BAD recall at that threshold is 100%.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/i18n/calibrate-backtranslation.ts
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const DRAWS = 20;

type Flat = Record<string, string>;

function flatten(obj: unknown, prefix = "", out: Flat = {}): Flat {
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") flatten(v, key, out);
  }
  return out;
}

function load(locale: string): Flat {
  const dir = join(ROOT, "messages", locale);
  const out: Flat = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    const ns = file.replace(/\.json$/, "");
    Object.assign(out, flatten(JSON.parse(readFileSync(join(dir, file), "utf8")), ns));
  }
  return out;
}

/** Failures this project shipped and caught. The gate's specification. */
const KNOWN_BAD: { en: string; ar: string; note: string }[] = [
  { en: "Who it's for", ar: "استكشف عالم الذكاء الاصطناعي والتعلم الآلي مع خبرائنا", note: "returned AI/ML copy" },
  { en: "Reviews and comments", ar: "شقة استوديو مفروشة بالكامل — إطلالة على القناة", note: "/home, first calibration run" },
  { en: "Where to live", ar: "شقق للسكن", note: "/home — became 'apartments for living'" },
  { en: "Your next location starts here", ar: "شقتك القادمة تبدأ من هنا", note: "/home — location became apartment" },
  { en: "Browse Properties", ar: "شقق وفلل للبيع والإيجار", note: "/home — invented a listing line" },
  { en: "Search", ar: "شقق للبيع", note: "became 'apartments for sale'" },
  { en: "Abu Dhabi", ar: "تأجير محل تجاري في أبوظبي", note: "became a commercial-rental phrase" },
  { en: "Closed", ar: "ملف", note: "became 'file'" },
];

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i]!;
}

async function main() {
  const { backTranslate, bandFor } = await import("../../lib/i18n/mt/backtranslate");

  const en = load("en");
  const ar = load("ar");
  const prov = JSON.parse(
    readFileSync(join(ROOT, "messages/ar/_provenance.json"), "utf8"),
  ) as Record<string, { by?: string }>;

  const human = Object.keys(prov)
    .filter((k) => prov[k]?.by === "human")
    .filter((k) => en[k] && ar[k])
    // ICU plurals round-trip badly for reasons that have nothing to do with
    // meaning, and they are a separate problem from this gate.
    .filter((k) => !en[k]!.includes("{") && !en[k]!.includes("#"));

  console.log(`${human.length} human-reviewed entries usable for calibration.`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY required.");
    process.exit(2);
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log("Back-translating…");
  const backs = await backTranslate({
    client,
    items: [
      ...human.map((k) => ({ id: k, arabic: ar[k]! })),
      ...KNOWN_BAD.map((b, i) => ({ id: `bad:${i}`, arabic: b.ar })),
    ],
  });
  const backOf = new Map(backs.map((b) => [b.id, b.english]));

  // ── positive: does the gate pass Arabic a human approved? ──────────────
  const { equivalence } = await import("../../lib/i18n/mt/backtranslate");

  console.log("Scoring positives…");
  const posVerdicts = await equivalence({
    client,
    pairs: human.map((k) => ({ id: k, source: en[k]!, back: backOf.get(k) ?? "" })),
  });
  const falsePositives = posVerdicts.filter((v) => !v.same);
  const shortcut = posVerdicts.filter((v) => v.shortcut).length;

  console.log(
    `\n── positives: ${posVerdicts.length - falsePositives.length}/${posVerdicts.length} pass ` +
      `(${((falsePositives.length / posVerdicts.length) * 100).toFixed(0)}% false-positive rate, ` +
      `${shortcut} decided by the lexical shortcut with no model call)`,
  );
  const perBand: Record<string, { n: number; fp: number }> = {
    word: { n: 0, fp: 0 },
    phrase: { n: 0, fp: 0 },
    sentence: { n: 0, fp: 0 },
  };
  for (const v of posVerdicts) {
    const band = bandFor(en[v.id]!);
    perBand[band]!.n++;
    if (!v.same) perBand[band]!.fp++;
  }
  console.log("\n   false positives by length band:");
  for (const band of ["word", "phrase", "sentence"] as const) {
    const b = perBand[band]!;
    console.log(
      `     ${band.padEnd(9)} ${b.fp}/${b.n} ` +
        `(${b.n ? ((b.fp / b.n) * 100).toFixed(0) : "-"}%)`,
    );
  }

  for (const v of falsePositives.slice(0, 12)) {
    console.log(`   ! ${JSON.stringify(en[v.id]!.slice(0, 46))}`);
    console.log(`       back: ${JSON.stringify((backOf.get(v.id) ?? "").slice(0, 60))}  — ${v.reason}`);
  }

  // ── null: mismatched pairs MUST fail, or the gate says SAME to anything ──
  const nullPairs: { id: string; source: string; back: string }[] = [];
  const bandsOf: Record<string, string[]> = { word: [], phrase: [], sentence: [] };
  for (const k of human) bandsOf[bandFor(en[k]!)]!.push(k);
  for (const k of human.slice(0, 60)) {
    const pool = bandsOf[bandFor(en[k]!)]!.filter((o) => o !== k);
    if (!pool.length) continue;
    const other = pool[Math.floor(Math.random() * pool.length)]!;
    nullPairs.push({ id: `null:${k}`, source: en[other]!, back: backOf.get(k) ?? "" });
  }
  console.log("\nScoring nulls…");
  const nullVerdicts = await equivalence({ client, pairs: nullPairs });
  const nullPassed = nullVerdicts.filter((v) => v.same).length;
  console.log(
    `── nulls: ${nullVerdicts.length - nullPassed}/${nullVerdicts.length} correctly rejected ` +
      `(${nullPassed} unrelated pairs wrongly called SAME)`,
  );

  // ── known-bad recall ─────────────────────────────────────────────────────
  console.log("\n── known-bad recall (every one MUST be rejected)");
  const badVerdicts = await equivalence({
    client,
    pairs: KNOWN_BAD.map((b, i) => ({
      id: `bad:${i}`,
      source: b.en,
      back: backOf.get(`bad:${i}`) ?? "",
    })),
  });
  let caught = 0;
  for (const [i, bad] of KNOWN_BAD.entries()) {
    const v = badVerdicts.find((x) => x.id === `bad:${i}`)!;
    if (!v.same) caught++;
    console.log(
      `  ${v.same ? "✗ PASSED" : "✓ caught "} ${JSON.stringify(bad.en)}\n` +
        `      back: ${JSON.stringify((backOf.get(`bad:${i}`) ?? "").slice(0, 70))}  — ${v.reason}`,
    );
  }
  console.log(`\n  ${caught}/${KNOWN_BAD.length} caught.`);

  writeFileSync(
    join(ROOT, "lib/i18n/mt/backtranslate-calibration.json"),
    `${JSON.stringify(
      {
        note: "Generated by scripts/i18n/calibrate-backtranslation.ts. Evidence, not configuration.",
        method:
          "Arabic is back-translated by a model told nothing about the domain, then a second model compares the two ENGLISH strings only.",
        positives: {
          n: posVerdicts.length,
          passed: posVerdicts.length - falsePositives.length,
          falsePositiveRate: Number((falsePositives.length / posVerdicts.length).toFixed(3)),
          decidedByShortcut: shortcut,
        },
        positivesByBand: perBand,
        nulls: { n: nullVerdicts.length, rejected: nullVerdicts.length - nullPassed },
        knownBad: { n: KNOWN_BAD.length, caught },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log("\nWrote lib/i18n/mt/backtranslate-calibration.json");
  if (caught < KNOWN_BAD.length) {
    console.log(
      "\nRecall is below 100%. The gate is NOT ready — the known-bad set is " +
        "its specification, not a sample.",
    );
    process.exit(1);
  }
}

void main();
