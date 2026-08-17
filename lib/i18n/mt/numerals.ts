/**
 * Arabic for the magnitude words and month names that masking protects.
 *
 * `mask()` deliberately swallows the unit alongside the figure — `AED 12.4
 * billion` is one token, not a number beside a word — because splitting them
 * is what let "AED 750K – 1M" come back as half a range translated and half
 * not (see the `magnitude` pattern's comment in `mask.ts`). That is the right
 * call for the figure and the wrong outcome for the word attached to it: the
 * token is restored verbatim, so an otherwise Arabic sentence ends up reading
 * "…‏AED 12.4 billion‏…" with two English words in the middle of it.
 *
 * Measured on the article corpus: 89 masked tokens, of which 24 strand an
 * English word — five `billion`, one `M`, one `K`, three month names and
 * fifteen `Qn`. The remaining 65 are safe as they stand. Percentages and `ft²`
 * carry no word at all, and the four regulators are Latin ON PURPOSE — the
 * client's own Arabic writes "خاضعة لإشراف ADREC وDLD", so translating those
 * would diverge from copy they wrote themselves.
 *
 * The substitution is a table lookup on the token text, never a model call.
 * The digits are copied across untouched, which is the property that matters:
 * a price on a DLD-regulated advertising surface cannot acquire a typo from a
 * translation model, and here it never reaches one.
 */

/** Gulf month names. The Levantine set (كانون الثاني…) is wrong for the UAE. */
const MONTHS: Record<string, string> = {
  january: "يناير",
  february: "فبراير",
  march: "مارس",
  april: "أبريل",
  may: "مايو",
  june: "يونيو",
  july: "يوليو",
  august: "أغسطس",
  september: "سبتمبر",
  october: "أكتوبر",
  november: "نوفمبر",
  december: "ديسمبر",
};

const QUARTERS: Record<string, string> = {
  "1": "الربع الأول",
  "2": "الربع الثاني",
  "3": "الربع الثالث",
  "4": "الربع الرابع",
};

/** `billion` / `million` / the bare `M` and `K` suffixes. */
const HALVES: Record<string, string> = {
  "1": "النصف الأول من",
  "2": "النصف الثاني من",
};

const MAGNITUDES: Record<string, string> = {
  b: "مليار",
  bn: "مليار",
  billion: "مليار",
  m: "مليون",
  million: "مليون",
  k: "ألف",
  thousand: "ألف",
};

/**
 * Arabic for one masked token, or `null` to restore it unchanged.
 *
 * `null` is the common answer and the safe one: anything this does not
 * recognise keeps the exact bytes `mask()` captured.
 */
export function arabicNumeral(token: string): string | null {
  const t = token.trim();

  // AED 66 billion · AED 4.2M · AED 100 Billion — keep "AED" Latin, which is
  // how it is written on Arabic UAE property sites, and translate only the
  // magnitude word.
  const priced = /^AED\s?([\d,.]+)\s?([A-Za-z]+)$/u.exec(t);
  if (priced) {
    const word = MAGNITUDES[priced[2]!.toLowerCase()];
    if (word) return `AED ${priced[1]} ${word}`;
    return null;
  }

  // A bare magnitude with no currency beside it: 80K, 1M, "6.4 million".
  const bare = /^([\d,.]+)\s?([A-Za-z]+)$/u.exec(t);
  if (bare) {
    const word = MAGNITUDES[bare[2]!.toLowerCase()];
    if (word) return `${bare[1]} ${word}`;
  }

  // Q1 2026
  const quarter = /^Q([1-4])\s?(\d{4})$/u.exec(t);
  if (quarter) return `${QUARTERS[quarter[1]!]} ${quarter[2]}`;

  // H1 2026 — the half-year form the market reports are written around.
  const half = /^H([12])\s?(\d{4})$/u.exec(t);
  if (half) return `${HALVES[half[1]!]} ${half[2]}`;

  /*
   * A bare period with no year: "handing over within a 90-day window in Q3".
   *
   * Unmasked, the model renders it الربع الثالث and the digit disappears, so
   * `numeral-drift` reports [3, 60, 90, 90] became [60, 90, 90] and the block
   * keeps its English — a correct translation rejected because the check
   * counts digits and Arabic spells this one out.
   */
  const bareQ = /^Q([1-4])$/u.exec(t);
  if (bareQ) return QUARTERS[bareQ[1]!]!;
  const bareH = /^H([12])$/u.exec(t);
  if (bareH) return HALVES[bareH[1]!]!.replace(/ من$/u, "");

  // September 2026
  const month = /^([A-Za-z]+)\s+(\d{4})$/u.exec(t);
  if (month) {
    const name = MONTHS[month[1]!.toLowerCase()];
    if (name) return `${name} ${month[2]}`;
  }

  return null;
}

/**
 * Index-keyed overrides for `translateField`, for the numeric token kinds.
 *
 * Keyed by index because that is what `unmask` takes, and the indices come
 * from `mask()` — so a caller has to run the same `mask()` call the translator
 * will run. That is safe: `mask` is a pure function of the text and the
 * proper-noun list, so the same two arguments give the same indices.
 *
 * Deliberately narrow. `proper-noun` is left to `overridesFor`, and every
 * other kind — url, email, phone, permit, regulator, reference, percent, area
 * — is restored verbatim by design.
 */
const NUMERIC_KINDS = new Set(["price", "magnitude", "date"]);

export function numeralOverrides(masked: {
  tokens: string[];
  kinds: string[];
}): Record<number, string> {
  const out: Record<number, string> = {};
  masked.kinds.forEach((kind, i) => {
    if (!NUMERIC_KINDS.has(kind)) return;
    const ar = arabicNumeral(masked.tokens[i] ?? "");
    if (ar) out[i] = ar;
  });
  return out;
}
