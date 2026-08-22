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
  | "site_url"
  // System-email tokens. Only meaningful inside the system asset that
  // supplies them — see `scope` below and lib/content-assets/system.ts.
  | "enquiry_message"
  | "valuation_property"
  | "valuation_range"
  | "valuation_midpoint"
  | "viewing_time"
  | "viewing_location"
  | "viewing_duration"
  | "unsubscribe_url";

/**
 * `shared` tokens describe a lead and are offered in every asset. `system`
 * tokens are only filled by one particular system email — `{{viewing_time}}`
 * has no value when an advisor writes a general follow-up, so offering it
 * there would be an invitation to a fallback in a sent message.
 */
export type TokenScope = "shared" | "system";

export type TokenDef = {
  name: TokenName;
  label: string;
  /** Shown in the editor's preview so copy can be judged in context. */
  sample: string;
  /** Used when the real value is absent at send time. */
  fallback: string;
  scope: TokenScope;
};

export const TOKENS: readonly TokenDef[] = [
  {
    name: "lead_first_name",
    label: "Lead first name",
    sample: "Amira",
    fallback: "there",
    scope: "shared",
  },
  {
    name: "lead_name",
    label: "Lead full name",
    sample: "Amira Haddad",
    fallback: "there",
    scope: "shared",
  },
  {
    name: "property_reference",
    label: "Property reference",
    sample: "BAZ-AD-04891",
    fallback: "your enquiry",
    scope: "shared",
  },
  {
    name: "property_title",
    label: "Property title",
    sample: "3-bed on Al Reem Island",
    fallback: "the property you asked about",
    scope: "shared",
  },
  {
    name: "advisor_name",
    label: "Advisor name",
    sample: "Khalid Al Zaabi",
    fallback: "your Bazar advisor",
    scope: "shared",
  },
  {
    name: "advisor_phone",
    label: "Advisor phone",
    sample: "+971 54 737 0776",
    fallback: "the number in my signature",
    scope: "shared",
  },
  {
    name: "site_url",
    label: "Site URL",
    sample: "bazar.ae",
    fallback: "bazar.ae",
    scope: "shared",
  },
  {
    name: "enquiry_message",
    label: "What the lead wrote",
    sample: "Is the 3-bed still available for a September move?",
    fallback: "your message",
    scope: "system",
  },
  {
    name: "valuation_property",
    label: "Valued property",
    sample: "Marina Heights · Al Reem Island",
    fallback: "your property",
    scope: "system",
  },
  {
    name: "valuation_range",
    label: "Instant valuation range",
    sample: "AED 2.1M – AED 2.6M",
    fallback: "the range in your report",
    scope: "system",
  },
  {
    name: "valuation_midpoint",
    label: "Instant valuation midpoint",
    sample: "AED 2.3M",
    fallback: "the midpoint in your report",
    scope: "system",
  },
  {
    name: "viewing_time",
    label: "Viewing time",
    sample: "Thursday 4 September, 4:30 pm",
    fallback: "the time we agreed",
    scope: "system",
  },
  {
    name: "viewing_location",
    label: "Viewing location",
    sample: "Marina Heights lobby, Al Reem Island",
    fallback: "the meeting point we sent you",
    scope: "system",
  },
  {
    name: "viewing_duration",
    label: "Viewing duration",
    sample: "45 minutes",
    fallback: "about 45 minutes",
    scope: "system",
  },
  {
    name: "unsubscribe_url",
    label: "Unsubscribe link",
    sample: "bazar.ae/newsletter/unsubscribe?t=…",
    fallback: "bazar.ae",
    scope: "system",
  },
] as const;

const TOKEN_NAMES = new Set<string>(TOKENS.map((t) => t.name));

/** Tokens every asset may use, system or hand-written. */
export const SHARED_TOKENS: readonly TokenDef[] = TOKENS.filter(
  (t) => t.scope === "shared",
);

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

/**
 * Known tokens the body uses that this asset is not allowed to use. A
 * `{{viewing_time}}` in a hand-written follow-up is spelled correctly and
 * still wrong — nothing on that send path fills it, so it would render as a
 * fallback every time. The rule the editor enforces is simply: a token you
 * can't insert is a token you can't save.
 */
export function outOfScopeTokens(
  body: string,
  allowed: readonly TokenName[],
): TokenName[] {
  const ok = new Set<string>(allowed);
  return usedTokens(body).filter((t) => !ok.has(t));
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
