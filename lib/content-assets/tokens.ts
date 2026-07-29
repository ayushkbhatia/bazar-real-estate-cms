/**
 * Token substitution for content assets.
 *
 * An asset body is copy with `{{placeholders}}`:
 *
 *   "Thank you for your enquiry about {{property_title}} ({{property_reference}})."
 *
 * Three rules the rest of the feature depends on:
 *
 *  1. The token vocabulary is CLOSED. `TOKENS` below is the whole list, the
 *     editor refuses to save an unknown one, and the picker in the enquiry
 *     composer only ever renders these. A typo'd `{{propery_ref}}` reaching a
 *     client is the failure mode this prevents.
 *
 *  2. A known token with no value falls back to neutral wording rather than
 *     leaving a hole. An enquiry with no property attached still produces a
 *     sendable sentence.
 *
 *  3. Fallbacks are a safety net, not a feature. `missingTokens()` reports
 *     which ones fired so the composer can warn the advisor *before* sending,
 *     with the resolved text on screen. Nobody should discover a fallback by
 *     reading it in a sent message.
 */

export type TokenName =
  | "lead_first_name"
  | "lead_name"
  | "property_reference"
  | "property_title"
  | "advisor_name"
  | "advisor_phone"
  | "site_url";

export type TokenDef = {
  name: TokenName;
  label: string;
  /** Shown in the editor's preview so copy can be judged in context. */
  sample: string;
  /** Used when the real value is absent at send time. */
  fallback: string;
};

export const TOKENS: readonly TokenDef[] = [
  {
    name: "lead_first_name",
    label: "Lead first name",
    sample: "Amira",
    fallback: "there",
  },
  {
    name: "lead_name",
    label: "Lead full name",
    sample: "Amira Haddad",
    fallback: "there",
  },
  {
    name: "property_reference",
    label: "Property reference",
    sample: "BAZ-AD-04891",
    fallback: "your enquiry",
  },
  {
    name: "property_title",
    label: "Property title",
    sample: "3-bed on Al Reem Island",
    fallback: "the property you asked about",
  },
  {
    name: "advisor_name",
    label: "Advisor name",
    sample: "Khalid Al Zaabi",
    fallback: "your Bazar advisor",
  },
  {
    name: "advisor_phone",
    label: "Advisor phone",
    sample: "+971 54 737 0776",
    fallback: "the number in my signature",
  },
  {
    name: "site_url",
    label: "Site URL",
    sample: "bazar.ae",
    fallback: "bazar.ae",
  },
] as const;

const TOKEN_NAMES = new Set<string>(TOKENS.map((t) => t.name));

/**
 * Matches `{{token}}` with optional inner padding. Deliberately NOT global —
 * a /g regex carries lastIndex between calls and would skip every other match
 * when reused. Callers that need all matches build their own with matchAll.
 */
const TOKEN_RE = /\{\{\s*([a-z_]+)\s*\}\}/i;

function allTokens(body: string): string[] {
  return [...body.matchAll(new RegExp(TOKEN_RE, "gi"))].map((m) =>
    m[1].toLowerCase(),
  );
}

export function isTokenName(value: string): value is TokenName {
  return TOKEN_NAMES.has(value);
}

/** Every `{{token}}` in the body that isn't in the vocabulary. Deduped. */
export function unknownTokens(body: string): string[] {
  return [...new Set(allTokens(body).filter((t) => !TOKEN_NAMES.has(t)))];
}

/** Every known token the body uses. Deduped, in first-appearance order. */
export function usedTokens(body: string): TokenName[] {
  return [...new Set(allTokens(body).filter(isTokenName))] as TokenName[];
}

export type TokenContext = Partial<Record<TokenName, string | null>>;

/**
 * Known tokens the body uses that have no value in this context — i.e. the
 * ones that will render as a fallback. The composer surfaces these.
 */
export function missingTokens(body: string, ctx: TokenContext): TokenName[] {
  return usedTokens(body).filter((t) => {
    const v = ctx[t];
    return v === undefined || v === null || v.trim() === "";
  });
}

/**
 * Substitute tokens. Known tokens take their context value or fallback;
 * unknown tokens are stripped rather than sent as literal braces — the editor
 * blocks them at save, so anything reaching here is a bug, and a gap in a
 * sentence embarrasses less than `{{propery_ref}}`.
 */
export function renderTokens(body: string, ctx: TokenContext): string {
  return body.replace(new RegExp(TOKEN_RE, "gi"), (_match, rawName: string) => {
    const name = rawName.toLowerCase();
    if (!isTokenName(name)) return "";
    const value = ctx[name];
    if (value !== undefined && value !== null && value.trim() !== "")
      return value;
    return TOKENS.find((t) => t.name === name)?.fallback ?? "";
  });
}

/** Preview substitution using the sample values, for the editor. */
export function renderSample(body: string): string {
  return renderTokens(
    body,
    Object.fromEntries(TOKENS.map((t) => [t.name, t.sample])) as TokenContext,
  );
}
