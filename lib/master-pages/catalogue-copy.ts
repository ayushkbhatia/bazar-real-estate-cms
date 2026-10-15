/**
 * Copy that lives in a next-intl catalogue, made editable in Pages & blocks.
 *
 * The mortgage application wizard (`wizards.ts`) was the first surface whose
 * words were all catalogue messages rather than section defaults; the
 * mortgage calculator's labels (`tools.mortgage`) are the second. Both take
 * the same approach, and this module is the part they share:
 *
 *  - each message is a field, keyed by its catalogue path, with the
 *    catalogue's English as the default and its Arabic as the twin;
 *  - a save keeps the message formattable — the same `{placeholders}`, the
 *    same `<b>`-style marks, no stray brace — in either language;
 *  - only what differs from the catalogue is stored, so a field nobody edited
 *    keeps following the catalogue when its wording changes in code;
 *  - the reader lays the stored words over the catalogue at request time, so
 *    no component knows its copy was edited.
 *
 * Counted phrases (ICU plural/select) are never fields: their branches are
 * easy to break by hand and impossible to check by eye.
 */

import { createTranslator } from "next-intl";
import { icuArguments, parseMessage } from "@/lib/i18n/icu";
import type { Locale } from "@/lib/i18n/locales";
import type { SectionValues } from "./types";

export type Catalogue = { [key: string]: string | Catalogue };

/** `{ a: { b: "x" } }` → `[["a.b", "x"]]`. */
export function flattenCatalogue(tree: Catalogue, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? [[path, v] as [string, string]] : flattenCatalogue(v, path);
  });
}

/** A counted phrase: an ICU plural or select anywhere in the message. */
export function isCountedMessage(message: string): boolean {
  return parseMessage(message).kind === "plural" || /\{\s*\w+\s*,\s*(plural|select|selectordinal)\s*,/.test(message);
}

/** Copy that is data, not prose: kept the same in Arabic, with no Arabic twin to fill. */
export function isDataMessage(message: string): boolean {
  const bare = message.replace(/\{\w+\}|<\/?\w+>/g, "").trim();
  if (/^\S+@\S+\.\S+$/.test(bare) || /^https?:\/\//.test(bare)) return true; // an email or a link
  return !/\p{L}{3,}/u.test(bare);
}

const TAG = /<\/?([a-z]+)>/g;

function tagsOf(message: string): string[] {
  return [...message.matchAll(TAG)].map((m) => m[0]).sort();
}

/** Whether next-intl can format the message with these arguments at all. */
function formats(message: string, args: readonly string[]): boolean {
  let failed = false;
  const t = createTranslator({
    locale: "en",
    messages: { check: { message } },
    namespace: "check",
    onError: () => {
      failed = true;
    },
    getMessageFallback: () => "",
  });
  const sample = Object.fromEntries(args.map((a) => [a, "x"]));
  const tag = (chunks: string) => chunks;
  t.markup("message", { ...sample, b: tag, ink: tag, link: tag });
  return !failed;
}

export type CatalogueCopyIssue = { section: string; field: string; message: string };

/**
 * What a save must keep of each message, English and Arabic: the same
 * `{placeholders}` (the page fills them in — a dropped `{pct}` shows no
 * figure, a new `{name}` goes live in braces), the same marks, and a message
 * next-intl can format at all (an unbalanced brace would render the key path
 * instead of the sentence).
 */
export function catalogueCopyIssues(
  sections: readonly { label: string; fields: readonly { key: string; label: string }[]; values: SectionValues }[],
  english: ReadonlyMap<string, string>,
): CatalogueCopyIssue[] {
  const issues: CatalogueCopyIssue[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      const base = english.get(field.key);
      if (base === undefined) continue;
      const args = icuArguments(base);
      for (const [lang, value] of [
        ["English", section.values[field.key]],
        ["Arabic", section.values[`${field.key}_ar`]],
      ] as const) {
        if (typeof value !== "string" || !value.trim()) continue;
        const where = { section: section.label, field: lang === "Arabic" ? `${field.label} (Arabic)` : field.label };
        const kept = icuArguments(value);
        const missing = args.filter((a) => !kept.includes(a));
        const extra = kept.filter((a) => !args.includes(a));
        if (missing.length) issues.push({ ...where, message: `Keep ${missing.map((a) => `{${a}}`).join(", ")}: it's filled in as the visitor reads it.` });
        if (extra.length) issues.push({ ...where, message: `${extra.map((a) => `{${a}}`).join(", ")} isn't something this message can fill in.` });
        if (tagsOf(value).join() !== tagsOf(base).join()) {
          issues.push({ ...where, message: "Keep the <b>…</b>, <ink>…</ink> and <link>…</link> marks exactly as the default has them." });
        } else if (!missing.length && !extra.length && !formats(value, args)) {
          issues.push({ ...where, message: "This can't be shown as written: check for a stray { or }." });
        }
      }
    }
  }
  return issues;
}

/**
 * A section's values as stored: only what differs from the catalogue, so a
 * field nobody edited keeps following the catalogue when its wording changes
 * in code.
 */
export function catalogueStoredValues(
  values: SectionValues,
  english: ReadonlyMap<string, string>,
  arabic: ReadonlyMap<string, string>,
): SectionValues {
  const out: SectionValues = {};
  for (const [k, v] of Object.entries(values)) {
    const isAr = k.endsWith("_ar");
    const path = isAr ? k.slice(0, -3) : k;
    const base = isAr ? arabic.get(path) : english.get(path);
    if (v === null || v === undefined || v === "" || v === base) continue;
    out[k] = v;
  }
  return out;
}

export type MessageTree = { [key: string]: string | MessageTree };

/** Write `value` at a dotted path, creating the branches it needs. */
export function setMessagePath(target: MessageTree, path: string, value: string) {
  const parts = path.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== "object") node[part] = {};
    node = node[part] as MessageTree;
  }
  node[parts.at(-1)!] = value;
}

/**
 * The messages to lay over the catalogue for one locale, from sections
 * already resolved (and folded) to that locale: only the fields whose text
 * differs from the catalogue's, nested as the catalogue is.
 */
export function catalogueOverlay(
  sections: readonly { def: { fields: readonly { key: string }[] }; values: SectionValues }[],
  locale: Locale,
  english: ReadonlyMap<string, string>,
  arabic: ReadonlyMap<string, string>,
): MessageTree {
  const messages: MessageTree = {};
  for (const section of sections) {
    for (const field of section.def.fields) {
      const value = section.values[field.key];
      if (typeof value !== "string" || !value.trim()) continue;
      const base = locale === "ar" ? (arabic.get(field.key) ?? english.get(field.key)) : english.get(field.key);
      if (base !== undefined && value !== base) setMessagePath(messages, field.key, value);
    }
  }
  return messages;
}
