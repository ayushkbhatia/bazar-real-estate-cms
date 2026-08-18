/**
 * Replace everything that must not change with sentinels before translating.
 *
 * This is the first and most important of the three quality layers, and the
 * only one that is structural rather than probabilistic: a price the model
 * never receives cannot be hallucinated into a different price. Every other
 * safeguard here detects damage after the fact; this one prevents it.
 *
 * That matters most for the numbers. A property listing that advertises the
 * wrong price in Arabic is not a typo, it is a misrepresentation to a buyer,
 * and the same goes for a permit number that no longer matches the register.
 *
 * The sentinel is `⟦n⟧`. It has to be something a language model will carry
 * through untouched and never translate, which rules out anything word-like
 * (`TOKEN_0`) and anything that appears in real prose (`[0]`, `{0}`). U+27E6/
 * U+27E7 appear in no listing copy in this corpus and in no Arabic
 * orthography, so a surviving bracket pair is unambiguous.
 */

/** Ordered longest-first; the first pattern to match a position wins. */
const PATTERNS: { name: string; re: RegExp }[] = [
  // ICU placeholders. `{count}` reaching the model unprotected is the same
  // class of problem as a price reaching it: the model may translate it,
  // reorder it, or drop the braces, and the message then formats to the
  // literal text `{count}` on the page. Masked first because a placeholder can
  // sit inside anything else here.
  { name: "icu-arg", re: /\{\s*[A-Za-z_]\w*(?:\s*,\s*[^{}]*)?\s*\}/gu },

  // URLs and emails first — both contain dots and digits that later patterns
  // would otherwise bite chunks out of.
  { name: "url", re: /https?:\/\/[^\s<>"')]+/gu },
  { name: "email", re: /[\w.+-]+@[\w-]+\.[\w.-]+/gu },

  // UAE numbering. `+` is a bidi-neutral and jumps to the wrong end of an
  // Arabic line on its own, so the whole number travels as one opaque unit.
  { name: "phone", re: /\+971[\s-]?\d[\d\s-]{6,}\d/gu },

  // Regulatory identifiers. Written with a Latin prefix by law, so they are
  // never translated and never transliterated.
  {
    name: "permit",
    re: /\b(?:ORN|BRN|RERA|DLD|ADREC|DMT)\s*[:#-]?\s*\d[\d-]*/giu,
  },
  /*
   * The regulators, standing alone.
   *
   * The `permit` pattern above only matches an acronym followed by a number,
   * so a bare "ADREC & DLD" reached the model — and came back expanded into
   * "دائرة البلديات والنقل ودائرة الأراضي", which is both a translation of a
   * name that is never translated AND the wrong department. These are the
   * bodies that licence the firm; naming the wrong one on a regulated
   * advertising surface is a compliance problem, not a style one.
   *
   * Latin by law and by convention, exactly as `contact-qr.ts` writes them in
   * the client's own Arabic: "خاضعة لإشراف ADREC وDLD".
   */
  { name: "regulator", re: /\b(?:ADREC|ADGM|RERA|DLD|DMT|ORN|BRN|KIZAD)\b/gu },

  // Listing references: BR-1042, BZ-7, and the bare slug tail.
  { name: "reference", re: /\b[A-Z]{2,4}-\d{1,6}\b/gu },

  // Money. Both orders occur in the copy, and the compact suffix forms
  // (2.5M, 900K) are common in headlines.
  //
  // Every numeric run below ends on `\d` rather than `[\d,.]+`. The greedy
  // form also swallows the full stop that ends a sentence, so "AED 12,500,000."
  // masks with the punctuation inside the token and the Arabic sentence comes
  // back without a terminator. Same reason the optional suffix carries its own
  // leading space instead of a bare `\s?` sitting outside it, which matched a
  // trailing space even when no suffix followed.
  //
  // One pattern per direction, not an alternation of "with suffix" and
  // "without" — regex alternation is first-match-wins, so the bare-number
  // branch matched "AED 2.5" and left the "M" behind for the model to
  // reinterpret. The suffix has to be optional *inside* one branch.
  {
    name: "price",
    re: /\bAED\s?\d(?:[\d,.]*\d)?(?:\s?(?:[MK]|million|billion)\b)?|\b\d(?:[\d,.]*\d)?\s?(?:[MK]\b)?\s?AED\b/giu,
  },

  /*
   * A bare magnitude, with no currency beside it.
   *
   * Ranges drop the second currency: "AED 750K – 1M" carries the prefix once,
   * so the rule above masks the first figure and hands `1M` to the model
   * untouched. It came back as "1 مليون" — half the range translated, half
   * not, which reads as two different units and is exactly what masking
   * exists to prevent. `numeral-drift` did not see it either, because the
   * digit `1` survived.
   *
   * Ordered after `price` so the currency-qualified form still wins the
   * earliest-start-longest-span tie-break and `AED 2M` masks as one token.
   */
  /*
   * The spelled-out words joined `[MK]` because only the suffix form was
   * covered, and `million` is otherwise protected ONLY when `AED` precedes it
   * (the `price` rule above). A bare quantity is not: from the Marsa Al
   * Saadiyat launch article, "will span approximately 6.4 million square
   * metres" came back as "6.4 مليار متر مربع" — مليار is BILLION. Every digit
   * survived, so `numeral-drift` saw nothing, and the unit was inflated a
   * thousandfold on a DLD-regulated advertising surface. That article alone
   * carries eight such quantities: 6.4 million m², 58,000 residents, 350
   * berths, 140 km, 6,000 guests.
   */
  {
    name: "magnitude",
    re: /\b\d(?:[\d,.]*\d)?\s?(?:[MK]\b|million\b|billion\b|thousand\b)/giu,
  },

  // Measurements. ft², sq ft, sqft, m², sqm — all with an optional thousands
  // separator.
  //
  // No trailing `\b`: `²` is not a word character, so there is no boundary
  // between it and the space that follows, and "1,200 ft²" silently failed to
  // match at all.
  {
    name: "area",
    re: /\b\d(?:[\d,.]*\d)?\s?(?:ft²|sq\.?\s?ft\.?|sqft|m²|sq\.?\s?m\.?|sqm)/giu,
  },

  { name: "percent", re: /\b\d(?:[\d.]*\d)?\s?%/gu },

  // ISO dates and the written forms used in the corpus.
  //
  // `H1 2026` joined the quarter form because it was NOT matched, and the
  // failure was loud: the model read the bare "H1" as prose, rendered it
  // النصف الأول, and left the year to fend for itself — so the headline
  // "Abu Dhabi Property Sales Surge in H1 2026" came back reading
  // "…النصف الأول من 1 2026". The excerpt containing it failed `numeral-drift`
  // outright (`[1, 2026]` became `[2026]`), which is the same defect caught by
  // a different check. Five occurrences across two market-report articles.
  {
    name: "date",
    re: /\b\d{4}-\d{2}-\d{2}\b|\b[QH][1-4]\s?\d{4}\b|\b[QH][1-4]\b(?!\s?\d)|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/giu,
  },
];

export type MaskResult = {
  /** Text with every protected span replaced by `⟦n⟧`. */
  masked: string;
  /** `tokens[n]` is the original text of sentinel `⟦n⟧`. */
  tokens: string[];
  /** Parallel to `tokens` — which pattern matched, for diagnostics. */
  kinds: string[];
};

const SENTINEL = (n: number) => `⟦${n}⟧`;

/**
 * A sentinel in output, tolerant of whitespace the model may introduce inside
 * the brackets. Anything looser risks eating real text.
 */
export const SENTINEL_RE = /⟦\s*(\d+)\s*⟧/gu;

/**
 * One regex matching any of `terms`, longest first.
 *
 * Longest-first matters because alternation is first-match-wins at a given
 * position: with `Al Maryah` ahead of `Al Maryah Island`, the island loses its
 * last word and the model is handed a dangling "Island" to translate.
 *
 * The boundaries are the explicit lookarounds `glossary.ts` already settled on
 * rather than `\b`, because `\b` is wrong at the edge of a term containing a
 * hyphen or an apostrophe — and this list is full of them ("Al Raha Beach",
 * "Jumeirah Golf Estates", "Saadiyat Reserve").
 */
function termsRe(terms: readonly string[]): RegExp | null {
  const usable = [...new Set(terms.filter((t) => t.trim()))].sort(
    (a, b) => b.length - a.length,
  );
  if (!usable.length) return null;
  const alt = usable
    .map((t) => t.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return new RegExp(`(?<![\\w-])(?:${alt})(?![\\w-])`, "giu");
}

/** Collect non-overlapping matches across all patterns, earliest-then-longest. */
function protectedSpans(
  text: string,
  terms?: readonly string[],
): { start: number; end: number; kind: string }[] {
  const found: { start: number; end: number; kind: string }[] = [];
  for (const { name, re } of PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      if (m.index === undefined) continue;
      found.push({ start: m.index, end: m.index + m[0].length, kind: name });
    }
  }

  /*
   * Proper nouns, if the caller supplied any.
   *
   * These join the same `found` array rather than getting their own pass, so
   * the existing earliest-start-then-longest tie-break resolves every overlap
   * for free — a development called "Saadiyat Lagoons" beats the area
   * "Saadiyat Island" only where it actually appears, and "AED 2M" still beats
   * a term that happens to contain a number.
   */
  const tre = terms && terms.length ? termsRe(terms) : null;
  if (tre) {
    for (const m of text.matchAll(tre)) {
      if (m.index === undefined) continue;
      found.push({
        start: m.index,
        end: m.index + m[0].length,
        kind: "proper-noun",
      });
    }
  }
  // Earliest start wins; on a tie the longer span wins, so `AED 2,500,000`
  // beats the bare number inside it.
  found.sort((a, b) => a.start - b.start || b.end - a.end);

  const kept: typeof found = [];
  let cursor = -1;
  for (const span of found) {
    if (span.start < cursor) continue; // overlaps something already taken
    kept.push(span);
    cursor = span.end;
  }
  return kept;
}

/**
 * @param terms Proper nouns to protect — area, development and developer
 *   names. Masking these is not a polish step: `validate()` rejects any Latin
 *   run of four or more characters as `latin-leak`, so an unmasked name means
 *   the model either preserves it (rejected, field stays English) or invents a
 *   fresh transliteration (accepted, and different on the next record). With a
 *   term list the name travels as a sentinel and `unmask`'s `overrides` puts
 *   the one canonical Arabic form back.
 */
export function mask(text: string, terms?: readonly string[]): MaskResult {
  const spans = protectedSpans(text, terms);
  const tokens: string[] = [];
  const kinds: string[] = [];
  let out = "";
  let cursor = 0;
  for (const span of spans) {
    out += text.slice(cursor, span.start) + SENTINEL(tokens.length);
    tokens.push(text.slice(span.start, span.end));
    kinds.push(span.kind);
    cursor = span.end;
  }
  return { masked: out + text.slice(cursor), tokens, kinds };
}

/**
 * Put the originals back.
 *
 * `overrides` is how a proper noun gets its hand-authored Arabic rather than
 * its English: an area masked as `⟦3⟧` can come back as `جزيرة السعديات`
 * instead of "Saadiyat Island". That is the payoff for hand-authoring
 * `areas.name_ar` — the canonical toponym is used everywhere downstream
 * instead of being re-invented by the model on every call.
 */
export function unmask(
  text: string,
  tokens: string[],
  overrides: Record<number, string> = {},
): string {
  return text.replace(SENTINEL_RE, (whole, digits: string) => {
    const i = Number(digits);
    if (!Number.isInteger(i) || i < 0 || i >= tokens.length) return whole;
    return overrides[i] ?? tokens[i];
  });
}

/** Sentinel indices present in a string, in order of appearance. */
export function sentinelsIn(text: string): number[] {
  return [...text.matchAll(SENTINEL_RE)].map((m) => Number(m[1]));
}
