import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { AR, arKey, isArKey } from "./twins";
import type { FieldDef, ItemValue, SectionValues } from "./types";

/**
 * Collapse a bilingual stored bag down to one locale.
 *
 * This is where the leverage is. Every renderer — all 473 `str(...)` calls, 63
 * adapter functions across 52 files, the 16-arm switch in the landing renderer
 * — keeps reading `values.title`. They never learn that Arabic exists. One
 * fold at the read boundary is the entire public-side change.
 *
 * Two invariants make that safe:
 *
 *   1. The output NEVER contains an `_ar` key. A renderer cannot accidentally
 *      read the storage shape, because after this the storage shape is gone.
 *   2. A blank Arabic value leaves the English in place. That is the fallback
 *      the whole epic rests on: an untranslated page renders complete in an
 *      RTL layout rather than showing a hole, so publishing is never blocked
 *      on translation.
 *
 * `fellBack` reports which keys took English, so the CMS can badge coverage
 * and `/admin/translations` can count what is missing without re-deriving it.
 */
export type LocaleFold = {
  values: SectionValues;
  /** Keys that rendered English because Arabic was blank. */
  fellBack: string[];
};

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Fold a media value — an `ImageValue` — a level deeper than the rest.
 *
 * The twins live INSIDE the object rather than beside it, so the swap has to
 * happen key by key: `alt_ar` replaces `alt`, `media_id_ar` replaces
 * `media_id`, and everything else (`label`, and the `url`/`mime` a resolver
 * attaches later) survives untouched. Replacing the whole object instead would
 * throw away the placeholder caption of any image with no Arabic asset.
 *
 * Shared by the scalar path and the list-item path. Before it was shared, an
 * image inside a list field was folded by the generic branch, which looked for
 * a sibling key named `image_ar` — a key that never exists — and so left the
 * English alt text in place on every card on the site.
 */
function foldMedia(
  media: Record<string, unknown>,
  path: string,
  fellBack: string[],
): Record<string, unknown> {
  const { alt_ar, media_id_ar, ...rest } = media;
  // Only count a fallback where there was English worth translating.
  if (isBlank(alt_ar) && !isBlank(media.alt)) fellBack.push(`${path}.alt`);
  return {
    ...rest,
    // A blank Arabic asset keeps the English artwork, which is the right
    // default for the ~99% of images that carry no language at all.
    media_id: isBlank(media_id_ar) ? media.media_id : media_id_ar,
    alt: isBlank(alt_ar) ? media.alt : alt_ar,
  };
}

/** Fold one item inside a list field. */
function foldItem(
  item: Record<string, ItemValue>,
  locale: Locale,
  path: string,
  fellBack: string[],
): Record<string, ItemValue> {
  const out: Record<string, ItemValue> = {};

  for (const [key, value] of Object.entries(item)) {
    if (isArKey(key)) continue;

    if (locale === DEFAULT_LOCALE) {
      out[key] = value;
      continue;
    }

    // Media inside a list item — a card's photo — folds a level deeper, same
    // as a scalar image field does.
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = foldMedia(
        value as Record<string, unknown>,
        `${path}.${key}`,
        fellBack,
      ) as ItemValue;
      continue;
    }

    const translated = item[arKey(key)];
    if (isBlank(translated)) {
      out[key] = value;
      // Only count a fallback where there was English worth translating.
      if (!isBlank(value)) fellBack.push(`${path}.${key}`);
    } else {
      out[key] = translated;
    }
  }
  return out;
}

/**
 * Fold a section's values to `locale`.
 *
 * Media values are folded a level deeper: `alt_ar` replaces `alt` and
 * `media_id_ar` replaces `media_id` inside the object rather than replacing
 * the object, so the placeholder caption survives.
 */
export function applyLocale(
  values: SectionValues,
  locale: Locale,
  sectionKey = "",
): LocaleFold {
  const out: SectionValues = {};
  const fellBack: string[] = [];

  for (const [key, value] of Object.entries(values)) {
    // Twins are consumed, never emitted.
    if (isArKey(key)) continue;

    // Lists recurse; their items carry their own twins.
    if (Array.isArray(value)) {
      out[key] = value.map((item, i) =>
        foldItem(
          item as Record<string, ItemValue>,
          locale,
          `${sectionKey}${key}[${i}]`,
          fellBack,
        ),
      );
      continue;
    }

    // Media: the alt text and, where the artwork is typeset copy, the asset
    // itself are translatable.
    if (value && typeof value === "object") {
      out[key] =
        locale === DEFAULT_LOCALE
          ? value
          : (foldMedia(
              value as Record<string, unknown>,
              `${sectionKey}${key}`,
              fellBack,
            ) as SectionValues[string]);
      continue;
    }

    if (locale === DEFAULT_LOCALE) {
      out[key] = value;
      continue;
    }

    const translated = values[arKey(key)];
    if (isBlank(translated)) {
      out[key] = value;
      if (!isBlank(value)) fellBack.push(`${sectionKey}${key}`);
    } else {
      out[key] = translated as SectionValues[string];
    }
  }

  return { values: out, fellBack };
}

/** Fold a list of resolved sections in one pass, accumulating coverage. */
export function applyLocaleToSections<
  T extends { key: string; values: SectionValues },
>(sections: T[], locale: Locale): { sections: T[]; fellBack: string[] } {
  const fellBack: string[] = [];
  const out = sections.map((section) => {
    const folded = applyLocale(section.values, locale, `${section.key}.`);
    fellBack.push(...folded.fellBack);
    return { ...section, values: folded.values };
  });
  return { sections: out, fellBack };
}

/**
 * How much of a section document is translated.
 *
 * Counts against the *derived* twins rather than stored keys, so a page that
 * has never been opened in the editor reports 0/N rather than 0/0 — the
 * difference between "nothing translated" and "nothing to translate".
 */
export function arabicCoverage(
  fields: FieldDef[],
  values: SectionValues,
): { filled: number; total: number } {
  let filled = 0;
  let total = 0;

  for (const field of fields) {
    if (field.kind !== "text" && field.kind !== "textarea") continue;
    if (isArKey(field.key)) continue;
    if ((field as { i18n?: false }).i18n === false) continue;
    // Nothing to translate if the English is blank.
    if (isBlank(values[field.key])) continue;
    total++;
    if (!isBlank(values[`${field.key}${AR}`])) filled++;
  }

  return { filled, total };
}
