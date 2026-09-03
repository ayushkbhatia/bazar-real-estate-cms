/**
 * The site-wide dictionary for the two words every price and every area on
 * this site is written with: the currency and the area unit.
 *
 * WHY THIS EXISTS
 *
 * "AED" and "ft²" were literals — some inside `CURRENCY_SYMBOL` and
 * `areaUnitLabel`, some typed straight into a component, one hidden inside a
 * regular expression that stripped a suffix back off. On `/ar` every one of
 * them stayed English, on a page where the rest of the sentence had been
 * translated, and nothing reported it: the machine-translation pipeline
 * deliberately MASKS `AED` and `ft²` so they survive a translation intact
 * (`lib/i18n/mt/mask.ts:78,118`), which is right for prose written by an editor
 * and wrong for a glyph the code emits. There is no editor to ask.
 *
 * So the glyphs move here, keyed by locale, and the CMS can override the
 * Arabic half (`site_settings.unit_labels`, migration 0122). A client who
 * would rather see the ISO code in Arabic types `AED` back into the box.
 *
 * WHAT IS NOT HERE
 *
 * - Nothing in `/admin`. The CMS is English-only and renders outside the
 *   provider that carries these, so it keeps the shipped English by default.
 * - Prose. A sentence that happens to contain "AED" belongs to the CMS and its
 *   translator, not to this dictionary.
 * - Digits. Figures stay Western (`en-US` grouping, pinned in `formatters.ts`)
 *   in both locales, which is what UAE property listings use in Arabic too.
 */

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import type { AreaUnit, Currency } from "./types";

/**
 * One locale's worth of the dictionary.
 *
 * `short` is the token that sits beside a number — "AED", "ft²". `long` is the
 * spelled-out name, which only the preferences toggle renders, where there is
 * room for it and where a visitor is choosing between two things they have to
 * be able to tell apart.
 *
 * `currencyLeads` is the half that is easy to forget. English writes the
 * currency first ("AED 4.2M"); Arabic writes it last ("4.2M درهم"). Getting
 * this wrong does not throw and does not look wrong to an English reviewer —
 * it reads as a translation nobody finished. It is derived from the locale and
 * deliberately NOT editable: it is grammar, not branding, and a text input is
 * the wrong control for a rule with two possible values.
 */
export type UnitLabels = {
  currency: Record<Currency, string>;
  /**
   * The compact magnitude suffixes — "M" and "K" — as the language writes them.
   *
   * Easy to miss, and it was: the first cut of this dictionary translated the
   * currency and left the suffix, so an Arabic card read "3.1M درهم" with one
   * Latin letter wedged between the figure and the word. The `.mono` LTR
   * isolation makes that read as a typo rather than as English.
   */
  magnitude: { million: string; thousand: string };
  currencyLong: Record<Currency, string>;
  area: Record<AreaUnit, string>;
  areaLong: Record<AreaUnit, string>;
  currencyLeads: boolean;
};

/**
 * English — byte-identical to the constants this replaced
 * (`CURRENCY_SYMBOL`, `CURRENCY_LABEL`, `AREA_UNIT_LABEL`, `areaUnitLabel`),
 * so an English page renders exactly what it rendered before.
 */
export const UNIT_LABELS_EN: UnitLabels = {
  currency: { AED: "AED", USD: "$" },
  magnitude: { million: "M", thousand: "K" },
  currencyLong: { AED: "AED · UAE Dirham", USD: "USD · US Dollar" },
  area: { ft2: "ft²", m2: "m²" },
  areaLong: { ft2: "Square feet (ft²)", m2: "Square metres (m²)" },
  currencyLeads: true,
};

/**
 * Arabic.
 *
 * `درهم` (dirham) rather than `د.إ`: the abbreviation is what a bank statement
 * uses, and the word is what a listing uses. The superscript ² is kept on both
 * area units — it is a number, it renders in every Arabic face the site can
 * load, and `قدم مربع` spelled out is three times the width inside a card
 * that has one line for it.
 *
 * All four are overridable per client; these are the first draft, not a
 * decision. See `/admin/settings/units`.
 */
export const UNIT_LABELS_AR: UnitLabels = {
  currency: { AED: "درهم", USD: "دولار" },
  // The same words `lib/i18n/mt/numerals.ts` substitutes into translated prose,
  // so a compacted price on a card and a written-out one in a paragraph beside
  // it use the same vocabulary.
  magnitude: { million: "مليون", thousand: "ألف" },
  currencyLong: { AED: "درهم إماراتي", USD: "دولار أمريكي" },
  area: { ft2: "قدم²", m2: "م²" },
  areaLong: { ft2: "قدم مربع", m2: "متر مربع" },
  currencyLeads: false,
};

export const UNIT_LABEL_DEFAULTS: Record<Locale, UnitLabels> = {
  en: UNIT_LABELS_EN,
  ar: UNIT_LABELS_AR,
};

/** The shipped dictionary for a locale, before any CMS override. */
export function unitLabelsFor(locale: Locale = DEFAULT_LOCALE): UnitLabels {
  return UNIT_LABEL_DEFAULTS[locale] ?? UNIT_LABELS_EN;
}

/**
 * What every formatter falls back to when no dictionary reached it.
 *
 * English, deliberately. A formatter called outside the provider — from
 * `/admin`, from a PDF, from an OG image generated at build time — has no
 * locale to ask, and the shipped English is the answer that has always been
 * correct there. The alternative (throwing, or rendering a placeholder) would
 * turn a missing provider into a blank price.
 */
export const DEFAULT_UNIT_LABELS = UNIT_LABELS_EN;

/**
 * A CMS override: any subset of one locale's dictionary. A blank string means
 * "no override" rather than "an empty label", which is what makes clearing a
 * box in the admin form a way to return to the shipped default rather than a
 * way to render nothing beside a price.
 */
export type UnitLabelOverride = {
  currency?: Partial<Record<Currency, string>>;
  currencyLong?: Partial<Record<Currency, string>>;
  area?: Partial<Record<AreaUnit, string>>;
  areaLong?: Partial<Record<AreaUnit, string>>;
};

/** The stored bag: overrides per locale. `{}` renders the shipped dictionary. */
export type UnitLabelSettings = Partial<Record<Locale, UnitLabelOverride>>;

export const UNIT_LABEL_SETTINGS_DEFAULTS: UnitLabelSettings = {};

function merge<K extends string>(
  base: Record<K, string>,
  override: Partial<Record<K, string>> | undefined,
): Record<K, string> {
  if (!override) return base;
  const out = { ...base };
  for (const key of Object.keys(base) as K[]) {
    const value = override[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

/**
 * The dictionary a page actually renders: shipped defaults for the locale,
 * with whatever the CMS has overridden folded in on top.
 *
 * Total by construction — a malformed bag, a missing locale key and a bag full
 * of empty strings all resolve to the shipped labels rather than to a hole.
 */
export function resolveUnitLabels(
  locale: Locale = DEFAULT_LOCALE,
  settings?: UnitLabelSettings | null,
): UnitLabels {
  const base = unitLabelsFor(locale);
  const override = settings?.[locale];
  if (!override) return base;
  return {
    currency: merge(base.currency, override.currency),
    currencyLong: merge(base.currencyLong, override.currencyLong),
    area: merge(base.area, override.area),
    areaLong: merge(base.areaLong, override.areaLong),
    currencyLeads: base.currencyLeads,
    // Not overridable: these are the language's words for a quantity, not the
    // client's branding, and a currency renamed on the settings screen has no
    // bearing on how Arabic writes "million".
    magnitude: base.magnitude,
  };
}

// ───────────────────────────────────────────────────────────────
// What a formatter is handed
// ───────────────────────────────────────────────────────────────

/**
 * The argument shape every label-emitting formatter takes.
 *
 * Deliberately an OBJECT and not a bare `Currency` / `AreaUnit`, which is what
 * these used to be. The change is the enforcement mechanism for the whole
 * dictionary: a call site that still passes `prefs.currency` no longer
 * compiles, so `npm run typecheck` enumerates every surface that renders one
 * of these words rather than leaving them to be found by reading. Formatters
 * that emit no label — `convertArea`, `toFt2`, `toAed` — keep their bare unit,
 * because there is nothing there to get wrong.
 *
 * `labels` is optional at the type level so `/admin`, the PDFs and the OG
 * images can keep calling with a plain `{ currency: "AED" }`; they fall back to
 * `DEFAULT_UNIT_LABELS`.
 */
export type PriceLabels = { currency: Currency; labels?: UnitLabels };
export type AreaLabels = { area_unit: AreaUnit; labels?: UnitLabels };
export type UnitLabelsCtx = PriceLabels & AreaLabels;

/** Pick the dictionary off a formatter argument, or fall back to English. */
export function labelsOf(ctx: { labels?: UnitLabels } | undefined): UnitLabels {
  return ctx?.labels ?? DEFAULT_UNIT_LABELS;
}
