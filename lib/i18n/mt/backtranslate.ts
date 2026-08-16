/**
 * Gate 2 — translate the Arabic back to English and see if it still says the
 * same thing.
 *
 * ## What this is for, precisely
 *
 * The nineteen checks in `validate.ts` are structural. They see a lost
 * sentinel, a drifted numeral, mojibake, a Latin leak. Not one of them can see
 * a sentence that is fluent, correctly formed, the right length, and about
 * something else entirely.
 *
 * That is not a hypothetical. On the first calibration run over `/home`, the
 * heading "Reviews and comments" came back as "شقة استوديو مفروشة بالكامل —
 * إطلالة على القناة" — a fully furnished studio with a canal view. Nineteen
 * checks, zero complaints. Round-tripping it would have produced "Fully
 * furnished studio apartment — canal view", which no comparison against
 * "Reviews and comments" survives.
 *
 * ## Why the back-translator is deliberately impoverished
 *
 * It must not be told the domain, must not receive the glossary, and must
 * never see the English source. Any one of those three leaks the answer and
 * the round trip stops being a test.
 *
 * This is why neither `SYSTEM_PROMPT` nor `UI_SYSTEM_PROMPT` nor
 * `PAGE_SYSTEM_PROMPT` is used here: all three tell the model it is working on
 * property copy for a firm in Abu Dhabi, which is exactly the context that
 * would let it repair a bad translation on the way back and hide the fault.
 *
 * For the same reason the model is the *weakest* adequate one rather than the
 * strongest. A better back-translator is a worse instrument.
 */
import type { MtClient } from "./translate";

/** Haiku: the project's existing bulk model, and deliberately not the prose one. */
export const BACKTRANSLATE_MODEL = "claude-haiku-4-5-20251001";

const BACKTRANSLATE_PROMPT = `You convert Arabic to English.

Translate literally, following the Arabic word by word wherever English allows it. Do not improve, smooth, or infer what the writer meant. If the Arabic says something odd, your English must say the same odd thing. If a word is ambiguous, choose its most common everyday sense.

Placeholders like ⟦0⟧ are protected content. Reproduce each one exactly, once.

Output ONLY the English. No preamble, no quotation marks, no alternatives.`;

export type BackTranslation = { id: string; english: string };

export async function backTranslate(input: {
  client: MtClient;
  items: { id: string; arabic: string }[];
  model?: string;
}): Promise<BackTranslation[]> {
  const model = input.model ?? BACKTRANSLATE_MODEL;
  const out: BackTranslation[] = [];

  for (const item of input.items) {
    const response = await input.client.messages.create({
      model,
      max_tokens: Math.max(512, Math.ceil(item.arabic.length * 2) + 256),
      system: BACKTRANSLATE_PROMPT,
      messages: [{ role: "user", content: item.arabic }],
    });
    const english = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
    out.push({ id: item.id, english });
  }
  return out;
}

/*
 * ── Comparison ───────────────────────────────────────────────────────────
 *
 * Lexical overlap is computed unconditionally, and it is the gate wherever
 * Voyage is unconfigured — which is the normal state of this repo and the
 * guaranteed state after handover. Cosine similarity is a strictly better
 * signal when it is available, and `embed()` already returns null rather than
 * throwing when it is not, so the caller supplies it or does not.
 */

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "at",
  "by", "from", "is", "are", "be", "was", "were", "it", "its", "this", "that",
  "your", "you", "our", "we", "us", "as", "into", "across", "over",
]);

/**
 * Content words, lightly stemmed.
 *
 * The stemming is deliberately crude — plural `s`, `ing`, `ed` — because the
 * back-translation is literal by instruction, so the two sides differ in
 * inflection far more often than in vocabulary. Anything cleverer would start
 * matching words that are genuinely different.
 */
export function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/⟦\d+⟧/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) =>
        w.endsWith("ing") && w.length > 5
          ? w.slice(0, -3)
          : w.endsWith("ed") && w.length > 4
            ? w.slice(0, -2)
            : w.endsWith("s") && !w.endsWith("ss")
              ? w.slice(0, -1)
              : w,
      ),
  );
}

/** Token-set F1 between the source and its round trip. 0 when either is empty. */
export function lexicalAgreement(source: string, back: string): number {
  const a = contentTokens(source);
  const b = contentTokens(back);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  const precision = shared / b.size;
  const recall = shared / a.size;
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/**
 * Length bands.
 *
 * Thresholds have to be banded because short strings are the hard case in both
 * directions: two unrelated one-word labels routinely share a token by chance,
 * and two correct translations of a one-word label routinely share none.
 */
export type LengthBand = "word" | "phrase" | "sentence";

export function bandFor(english: string): LengthBand {
  const words = english.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 1) return "word";
  return words <= 4 ? "phrase" : "sentence";
}

/*
 * ── Equivalence ──────────────────────────────────────────────────────────
 *
 * Lexical overlap was calibrated against this corpus and is not good enough to
 * be the gate on its own. Measured over the 177 usable human-reviewed entries:
 * positive median 0.50 against a null p99 of 0.40–0.67, so the distributions
 * overlap almost completely, and the threshold that caught the known-bad set
 * flagged 54% of human-approved Arabic on one-word strings.
 *
 * The reason is visible in the two it missed. "Abu Dhabi" round-tripping as
 * "Renting a commercial shop in Abu Dhabi" scores 0.57 — the source is a
 * SUBSET of the round trip, so recall is perfect and only precision suffers.
 * "Your next location starts here" against "Your next apartment begins from
 * here" scores 0.50 — three of four content words survive and the one that
 * changed is the one that carried the meaning. Bag-of-words cannot see either.
 *
 * Cosine similarity would do better and `embed()` is already wired, but Voyage
 * is unconfigured here and will be after handover too, so a gate that depends
 * on it is a gate that does not run.
 *
 * So the comparison is made by a model — and the design constraint that
 * matters is preserved exactly: **the comparator never sees the Arabic and is
 * never told the domain.** It is shown two English strings and asked whether
 * they say the same thing. It cannot be persuaded by fluent Arabic because it
 * never sees any, and it cannot resolve an ambiguity toward property
 * vocabulary because it does not know it is looking at property copy.
 *
 * Lexical overlap survives as a cheap pre-filter: a pair that already agrees
 * strongly needs no call.
 */

const EQUIVALENCE_PROMPT = `You compare two English strings.

B was produced by translating A into another language and back again. Your job is to say whether B still states the same thing as A.

Answer DIFFERENT if B:
  - makes a claim A does not make,
  - drops something A does state,
  - or names a different thing, place, or category than A.

Answer SAME if B says what A says, even if the wording, grammar or register is clumsy. A literal or awkward round trip is still SAME. You are judging meaning, not style.

Reply with exactly one word — SAME or DIFFERENT — then a dash and at most eight words of reason.`;

export type Equivalence = {
  id: string;
  same: boolean;
  reason: string;
  /** Set when the lexical pre-filter decided it, with no model call. */
  shortcut?: boolean;
};

/** Above this the pair agrees outright; the p99 of the null distribution. */
export const LEXICAL_SHORTCUT = 0.7;

export async function equivalence(input: {
  client: MtClient;
  pairs: { id: string; source: string; back: string }[];
  model?: string;
}): Promise<Equivalence[]> {
  const model = input.model ?? BACKTRANSLATE_MODEL;
  const out: Equivalence[] = [];

  for (const pair of input.pairs) {
    if (lexicalAgreement(pair.source, pair.back) >= LEXICAL_SHORTCUT) {
      out.push({ id: pair.id, same: true, reason: "lexically identical", shortcut: true });
      continue;
    }
    const response = await input.client.messages.create({
      model,
      max_tokens: 256,
      system: EQUIVALENCE_PROMPT,
      messages: [
        { role: "user", content: `A: ${pair.source}\nB: ${pair.back}` },
      ],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
    // Default to DIFFERENT on anything unparseable: an unreadable verdict is
    // not a pass, and this gate exists to be conservative.
    const same = /^\s*SAME\b/i.test(text);
    out.push({ id: pair.id, same, reason: text.replace(/^\s*(SAME|DIFFERENT)\s*[-–—]?\s*/i, "").slice(0, 80) });
  }
  return out;
}

/**
 * Put the English proper nouns back before the round trip.
 *
 * A substituted name defeats back-translation by construction. "Al Bateen"
 * becomes البطين, which is correct — and the back-translator, told only that it
 * is converting Arabic and nothing about the domain, renders it "ventricle",
 * the anatomical sense of the root. The comparator then sees "Al Bateen" against
 * "ventricle" and rejects a perfectly good translation. The same happens to
 * جزيرة السعديات ("island of the happy ones") and to the brand itself.
 *
 * Teaching the back-translator about places would defeat the gate — its
 * ignorance is the whole point. So instead the names are swapped back to their
 * English before the trip. Both sides of the comparison then carry the same
 * Latin token, the round trip tests the words that were actually translated,
 * and the proper nouns are already guaranteed correct by `overridesFor`.
 *
 * Longest Arabic form first, so جزيرة السعديات is not eaten by a shorter entry.
 */
export function restoreNames(
  arabic: string,
  nouns: Map<string, string | null>,
): string {
  const pairs: [string, string][] = [];
  for (const [en, ar] of nouns) if (ar) pairs.push([ar, en]);
  pairs.sort((a, b) => b[0].length - a[0].length);

  let out = arabic;
  for (const [ar, en] of pairs) {
    out = out.split(ar).join(en);
  }
  return out;
}
