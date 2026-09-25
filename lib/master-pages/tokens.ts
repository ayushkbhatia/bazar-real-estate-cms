/**
 * The save-time check for `{token}`s a page cannot fill.
 *
 * `fillTokens` and the listing page's `TokenText` leave an unrecognised token
 * on the page on purpose, so a typo shows up as itself rather than silently
 * deleting a word. For a document every listing shares, "shows up" means on
 * every listing at once, and the vocabularies differ between documents in
 * ways an editor has no reason to remember: the project card's name token is
 * `{name}`, the listing cards' is `{title}`. So a save is refused first, with
 * the tokens that do work named in the message.
 */
import type { ValidationIssue } from "./index";
import { arKey } from "./twins";
import {
  isListField,
  type FieldDef,
  type MasterPageDef,
  type StoredSection,
} from "./types";

const TOKEN = /\{\w+\}/g;

/** The `{word}`s in `value` that are not in `allowed`, each once. */
export function unknownTokensIn(
  value: unknown,
  allowed: readonly string[],
): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.match(TOKEN) ?? [])].filter(
    (t) => !allowed.includes(t),
  );
}

function listTokens(tokens: readonly string[]): string {
  if (tokens.length <= 1) return tokens.join("");
  return `${tokens.slice(0, -1).join(", ")} or ${tokens[tokens.length - 1]}`;
}

/**
 * Every field, English or Arabic, carrying a token the page does not fill.
 *
 * Runs over the VALIDATED sections, so only fields the registry declares are
 * looked at — anything else was already stripped.
 */
export function unknownTokenIssues(
  def: MasterPageDef,
  sections: StoredSection[],
  allowed: readonly string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const check = (
    section: string,
    label: string,
    values: Record<string, unknown>,
    field: FieldDef,
  ) => {
    for (const [key, suffix] of [
      [field.key, ""],
      [arKey(field.key), " (Arabic)"],
    ] as const) {
      const bad = unknownTokensIn(values[key], allowed);
      if (bad.length === 0) continue;
      issues.push({
        section,
        field: `${label}${suffix}`,
        message: `${listTokens(bad)} ${bad.length === 1 ? "is not a token" : "are not tokens"} this page fills in. Use ${listTokens(allowed)}.`,
      });
    }
  };

  for (const stored of sections) {
    const sectionDef = def.sections.find((s) => s.key === stored.key);
    if (!sectionDef) continue;
    for (const field of sectionDef.fields) {
      if (isListField(field)) {
        const items = stored.values[field.key];
        if (!Array.isArray(items)) continue;
        items.forEach((item, i) => {
          for (const sub of field.fields) {
            check(
              sectionDef.label,
              `${field.label} ${i + 1} · ${sub.label}`,
              (item ?? {}) as Record<string, unknown>,
              sub,
            );
          }
        });
      } else {
        check(sectionDef.label, field.label, stored.values, field);
      }
    }
  }
  return issues;
}
