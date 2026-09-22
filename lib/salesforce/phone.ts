/**
 * `enquiries.phone` → Salesforce's split `Country_Code__c` + `Phone__c`.
 *
 * The doc's example is `{"Country_Code__c": "+91", "Phone__c": "78119765543"}`
 * — two fields where this product has always had one. Every public form takes
 * a single free-text phone box, so what arrives is whatever the visitor typed:
 * "+971 50 123 4567", "050 123 4567", "00971501234567", "(971) 50-1234567".
 *
 * ── Why a prefix table rather than libphonenumber ────────────────────────
 * The real library is ~150 KB and answers a much harder question — validity,
 * region, line type — that Salesforce is not asking. All that is needed here
 * is "where does the country code end", and the ambiguity in that is almost
 * entirely confined to +1 and +7 (shared by many territories) which do not
 * need splitting further because the code itself is the whole answer.
 *
 * The table covers the Gulf, the source markets Bazar actually sells into
 * (India, Pakistan, UK, Russia, China), and the common one-digit codes.
 * Longest match wins, so +971 beats +97. Anything unrecognised keeps its
 * leading digits as the code rather than guessing — a wrong split is worse
 * than a conservative one, because the advisor still has the full number.
 */

/** Calling codes, longest first at match time. */
const CALLING_CODES = [
  // Gulf + Levant — the home market and its neighbours.
  "971", "966", "965", "968", "973", "974", "962", "961", "964", "963", "967",
  "970", "218", "216", "213", "212", "20",
  // Source markets.
  "91", "92", "94", "880", "977", "63", "62", "60", "65", "66", "98",
  "44", "353", "33", "49", "39", "34", "31", "32", "41", "43", "46", "47",
  "45", "358", "351", "30", "48", "40", "420", "36", "90", "380", "7",
  "1", "86", "81", "82", "852", "886", "61", "64", "27", "234", "254",
  "55", "52", "54", "57", "56", "51",
] as const;

const UAE_CODE = "971";

export type SplitPhone = {
  /** E.164-style calling code with its leading plus, e.g. "+971". */
  countryCode: string;
  /** The national number, digits only, no leading zero. */
  national: string;
};

/**
 * Returns `null` for anything with too few digits to be a phone number, so
 * the caller can omit both fields rather than send Salesforce a fragment.
 * `enquiries.phone` is nullable and several forms do not ask for it.
 */
export function splitPhone(
  raw: string | null | undefined,
  defaultCountryCode: string = UAE_CODE,
): SplitPhone | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  // "00971…" is the same intent as "+971…" — the international access prefix
  // used across Europe and the Gulf. Normalise before anything else looks.
  const hadPlus = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/^00/, "").replace(/\D/g, "");
  if (digits.length < 6) return null;

  if (hadPlus) {
    const match = [...CALLING_CODES]
      .sort((a, b) => b.length - a.length)
      .find((code) => digits.startsWith(code) && digits.length > code.length);
    if (match) {
      return { countryCode: `+${match}`, national: digits.slice(match.length) };
    }
    // Unrecognised international number. Take the first 1-3 digits as the
    // code — wrong in detail, but it keeps every digit the visitor typed and
    // an advisor can still dial it.
    const width = digits.length > 10 ? 3 : 2;
    return {
      countryCode: `+${digits.slice(0, width)}`,
      national: digits.slice(width),
    };
  }

  // No international prefix: a local number. "0501234567" is the UAE trunk
  // form and the zero is not part of the subscriber number.
  const national = digits.replace(/^0+/, "");
  if (!national) return null;

  // Someone typed the country code without a plus ("971501234567").
  if (national.startsWith(defaultCountryCode) && national.length > defaultCountryCode.length + 5) {
    return {
      countryCode: `+${defaultCountryCode}`,
      national: national.slice(defaultCountryCode.length),
    };
  }

  return { countryCode: `+${defaultCountryCode}`, national };
}
