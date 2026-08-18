import { arabicFor } from "@/lib/i18n/arabic-store";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";

/**
 * Collapse a bilingual database row down to one locale.
 *
 * This is the flat-table counterpart to `applyLocale` in
 * `lib/master-pages/i18n.ts`, and it keeps the same two invariants, because a
 * reader should not have to remember which kind of surface they are looking at:
 *
 *   1. The output NEVER contains an `_ar` key. A renderer cannot accidentally
 *      read the storage shape, because after this the storage shape is gone.
 *   2. A blank Arabic value leaves the English in place. An untranslated row
 *      renders complete in an RTL layout rather than leaving a hole, so
 *      publishing is never blocked on translation.
 *
 * Doing this once, generically, is what makes the remaining Arabic columns
 * cheap: a table gets its twins in a migration and its read path needs no code
 * beyond passing the locale through. The alternative — a hand-written
 * `row.label_ar ?? row.label` at every call site — is 40-odd chances to forget
 * one, in a language most reviewers here cannot proofread.
 */

const AR_SUFFIX = "_ar";

function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

/**
 * One row, one level deep.
 *
 * English is returned untouched apart from having its `_ar` keys stripped —
 * so the English path costs nothing but the strip, and cannot change shape
 * depending on locale.
 */
export function localiseRow<T extends Record<string, unknown>>(
  row: T,
  locale: Locale = DEFAULT_LOCALE,
): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.endsWith(AR_SUFFIX)) continue; // never leaks to a renderer
    const twinKey = `${key}${AR_SUFFIX}`;
    const twin = row[twinKey];
    if (locale === DEFAULT_LOCALE) {
      out[key] = value;
      continue;
    }
    if (!isBlank(twin)) {
      out[key] = twin;
      continue;
    }
    /*
     * Nothing typed into the twin — ask the store before giving up.
     *
     * This is the same fallback `fillArabic` gives master-page sections
     * (`lib/master-pages/arabic.ts`), and the flat columns simply never had
     * it. The consequence was measurable and lopsided: section documents
     * render ~88% Arabic because a blank twin still resolves through the
     * store, while flat columns sat at ~10% because a blank twin fell
     * straight back to English. Same content, same store, two answers.
     *
     * Guarded on the twin COLUMN being present rather than on the value, so
     * the lookup only ever runs for a column the schema declares
     * translatable. `localiseRow` sees every column on the row — `id`,
     * `slug`, `status`, `storage_key`, prices — and a bare
     * `arabicFor(value)` would happily swap any of them for a coincidental
     * store hit. `in` distinguishes "twin exists and is null" from "no twin
     * here", which `undefined` alone cannot.
     */
    out[key] =
      twinKey in row && typeof value === "string"
        ? (arabicFor(value) ?? value)
        : value;
  }
  return out as T;
}

/**
 * A row and everything nested inside it — arrays of rows, objects of rows.
 *
 * The megamenu needs this: a tab owns columns, a column owns items, and a tab
 * owns featured tiles, each with their own twins. Recursing means the read path
 * is one call at the top rather than one call per level, which is the
 * difference between "add a twin and it works" and "add a twin and remember to
 * fold it".
 *
 * Plain values inside arrays (a string[] of amenities, say) pass through
 * untouched — there is no twin to pair them with at that depth. A `<col>_ar`
 * array beside a `<col>` array is handled at the level above, by the ordinary
 * key-pairing rule, since the whole array is the value.
 */
export function localiseDeep<T>(value: T, locale: Locale = DEFAULT_LOCALE): T {
  if (Array.isArray(value)) {
    return value.map((entry) => localiseDeep(entry, locale)) as unknown as T;
  }
  if (value === null || typeof value !== "object") return value;
  // Dates and other class instances are values, not bags of columns.
  if (value instanceof Date) return value;

  const folded = localiseRow(value as Record<string, unknown>, locale);
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(folded)) {
    out[key] = localiseDeep(entry, locale);
  }
  return out as T;
}

/**
 * Which keys fell back to English, for coverage reporting.
 *
 * Deliberately separate from the fold: the renderers do not want it, and the
 * CMS does. `applyLocale` returns its own `fellBack` for the same reason.
 */
export function missingTranslations(
  row: Record<string, unknown>,
  locale: Locale = DEFAULT_LOCALE,
): string[] {
  if (locale === DEFAULT_LOCALE) return [];
  const out: string[] = [];
  for (const key of Object.keys(row)) {
    if (!key.endsWith(AR_SUFFIX)) continue;
    const english = row[key.slice(0, -AR_SUFFIX.length)];
    // Only counts as missing when there is English to translate.
    if (isBlank(row[key]) && !isBlank(english)) {
      out.push(key.slice(0, -AR_SUFFIX.length));
    }
  }
  return out.sort();
}
