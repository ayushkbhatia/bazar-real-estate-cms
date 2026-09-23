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

/**
 * The calling codes `Country_Code__c` will accept.
 *
 * Taken from a describe of the live object, not from the vendor doc — which
 * never mentioned that the field is a restricted picklist at all. Sending a
 * code that is not on this list fails the whole record with
 * INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST.
 *
 * Note what is NOT here: **+7**. Russia and Kazakhstan are missing from the
 * org's list, though every one of their neighbours (+994, +995, +996, +998)
 * is present, so it reads as an omission rather than a decision. A Russian
 * buyer is a real segment for Abu Dhabi property, and until Levarus add it
 * those leads are refused locally rather than sent with a wrong code — see
 * `buildLeadPayload`.
 */
export const SALESFORCE_COUNTRY_CODES: ReadonlySet<string> = new Set([
  "1", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44",
  "45", "46", "47", "48", "49", "51", "52", "53", "54", "55", "56", "57", "58", "60",
  "61", "62", "63", "64", "65", "66", "81", "82", "84", "86", "90", "91", "92", "93",
  "94", "95", "98", "211", "212", "213", "216", "218", "220", "221", "222", "223", "224", "225",
  "226", "227", "228", "229", "230", "231", "232", "233", "234", "235", "236", "237", "238", "239",
  "240", "241", "242", "243", "244", "245", "246", "247", "248", "249", "250", "251", "252", "253",
  "254", "255", "256", "257", "258", "260", "261", "262", "263", "264", "265", "266", "267", "268",
  "269", "290", "291", "297", "298", "299", "350", "351", "352", "353", "354", "355", "356", "357",
  "358", "359", "370", "371", "372", "373", "374", "375", "376", "377", "378", "379", "380", "381",
  "382", "383", "385", "386", "387", "389", "420", "421", "423", "500", "501", "502", "503", "504",
  "505", "506", "507", "508", "509", "590", "591", "592", "593", "594", "595", "596", "597", "598",
  "599", "670", "672", "673", "674", "675", "676", "677", "678", "679", "680", "681", "682", "683",
  "685", "686", "687", "688", "689", "690", "691", "692", "850", "852", "853", "855", "856", "880",
  "886", "960", "961", "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973",
  "974", "975", "976", "977", "992", "993", "994", "995", "996", "998",
]);

/** Calling codes this splitter knows how to separate, longest first at match
 *  time. Kept distinct from the picklist above: this one is about reading a
 *  number correctly, that one is about what the CRM will store. */
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
