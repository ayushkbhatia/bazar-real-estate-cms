/**
 * The little bit of ICU this project actually needs.
 *
 * Not a parser for the format — `next-intl` has one. This exists because two
 * other things have to reason about a message *before* it is formatted: the
 * parity guard in `messages.test.ts`, and the catalogue translator, which must
 * not hand a plural to a prose model.
 *
 * `icuArguments` was a private function in `messages.test.ts`. It moved here so
 * both callers share one implementation — a second, subtly different ICU
 * scanner is exactly how a placeholder-parity check starts passing for the
 * wrong reason.
 */

/**
 * Arabic's plural categories, in CLDR order.
 *
 * All six are required — `messages.test.ts` fails an Arabic message that
 * declares fewer. English has two (`one`, `other`), which is why every
 * hand-rolled `n === 1 ? "" : "s"` in the codebase is not merely untranslated
 * but structurally incapable of being translated.
 */
export const ARABIC_PLURAL_CATEGORIES = [
  "zero",
  "one",
  "two",
  "few",
  "many",
  "other",
] as const;

export type PluralCategory = (typeof ARABIC_PLURAL_CATEGORIES)[number];

/**
 * Top-level ICU argument names, sorted and de-duplicated.
 *
 * Brace-depth aware on purpose: a naive `/\{(\w+)[,}]/` also matches the
 * *contents* of plural branches, so `{count, plural, =0 {Studio} …}` reports an
 * argument called "Studio" — and then every translated message looks like a
 * placeholder mismatch, because the Arabic branch text is not `\w`.
 */
export function icuArguments(message: string): string[] {
  const names: string[] = [];
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    const ch = message[i];
    if (ch === "}") depth--;
    else if (ch === "{") {
      if (depth === 0) {
        const m = message.slice(i + 1).match(/^\s*([A-Za-z_]\w*)\s*[,}]/);
        if (m) names.push(m[1]!);
      }
      depth++;
    }
  }
  return [...new Set(names)].sort();
}

export type PluralBranch = { selector: string; text: string };

export type ParsedMessage =
  | { kind: "simple"; text: string }
  | { kind: "plural"; arg: string; branches: PluralBranch[] };

const PLURAL_HEAD = /^\s*\{\s*([A-Za-z_]\w*)\s*,\s*plural\s*,/;

/**
 * Split a message into the shape the translator needs.
 *
 * Only whole-message plurals are recognised — `{count, plural, …}` wrapping the
 * entire string. A plural embedded mid-sentence would parse as `simple` and go
 * to the prose model whole, which is wrong; `hasEmbeddedPlural` exists so the
 * translator can refuse rather than silently mangle one. There are none in the
 * catalogue today and the extraction waves should not introduce any: a message
 * that is *entirely* its plural is both easier to translate and easier to read.
 */
export function parseMessage(message: string): ParsedMessage {
  const head = message.match(PLURAL_HEAD);
  if (!head) return { kind: "simple", text: message };

  const body = message.slice(head[0].length);
  const branches: PluralBranch[] = [];
  let i = 0;

  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i]!)) i++;
    if (body[i] === "}") break;

    const sel = body.slice(i).match(/^(=\d+|[A-Za-z]+)\s*\{/);
    if (!sel) break;
    i += sel[0].length;

    // Walk to the matching brace so a branch containing braces survives.
    let depth = 1;
    const start = i;
    while (i < body.length && depth > 0) {
      if (body[i] === "{") depth++;
      else if (body[i] === "}") depth--;
      if (depth > 0) i++;
    }
    branches.push({ selector: sel[1]!, text: body.slice(start, i) });
    i++;
  }

  return branches.length > 0
    ? { kind: "plural", arg: head[1]!, branches }
    : { kind: "simple", text: message };
}

/** True when a plural appears somewhere other than wrapping the whole message. */
export function hasEmbeddedPlural(message: string): boolean {
  if (PLURAL_HEAD.test(message)) return false;
  return /\{\s*[A-Za-z_]\w*\s*,\s*plural\s*,/.test(message);
}

/** Rebuild a plural message from its branches. Inverse of `parseMessage`. */
export function formatPlural(arg: string, branches: PluralBranch[]): string {
  const body = branches.map((b) => `${b.selector} {${b.text}}`).join(" ");
  return `{${arg}, plural, ${body}}`;
}

/**
 * Branch selectors an Arabic message must carry.
 *
 * Exact-match selectors (`=0`) are preserved from the English rather than
 * required: `listing.bedrooms` uses `=0 {Studio}`, which is a product decision
 * about a specific number, not a grammatical category, and it must survive
 * translation as its own branch.
 */
export function requiredArabicSelectors(english: PluralBranch[]): string[] {
  const exact = english.map((b) => b.selector).filter((s) => s.startsWith("="));
  return [...exact, ...ARABIC_PLURAL_CATEGORIES];
}
