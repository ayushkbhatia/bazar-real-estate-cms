import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";

/**
 * Dates a visitor reads, in the language they are reading.
 *
 * Every editorial surface formatted its own dates with a `toLocaleDateString`
 * call pinned to `"en-GB"`. Under `/ar` that put "14 Mar 2026" under an
 * article whose headline, excerpt, category chip and byline had all been
 * translated — the one English fragment left on the card, and the kind of miss
 * `docs/I18N.md` describes as looking finished.
 *
 * ## The tags, and why they are not just the locale
 *
 * `en-GB` rather than `en`: the site is UAE/British-English, and `en` gives
 * "Mar 14, 2026". `ar-AE` rather than `ar`: the region carries the Gulf month
 * names ("مارس", not the Levantine "آذار").
 *
 * `-u-nu-latn` is the load-bearing part. Arabic's CLDR default numbering
 * system is `arab` on most ICU builds — "١٤ مارس ٢٠٢٦" — and this site writes
 * figures in Western digits in both locales, deliberately (ADR-0007; the same
 * rule `lib/preferences/formatters.ts` pins `en-US` for and
 * `lib/preferences/unit-labels.ts` restates). Pinning the numbering system in
 * the tag is what makes that hold on every runtime rather than on whichever
 * ICU version happens to be installed: newer ICU has flipped `ar` to `latn`,
 * so a build that looked right locally would have started printing
 * Arabic-Indic digits the day the Node image moved.
 */
const DATE_TAG: Record<Locale, string> = {
  en: "en-GB",
  ar: "ar-AE-u-nu-latn",
};

/**
 * The tag itself, for the surfaces that need their own `Intl` options.
 *
 * `formatPublishedDate` below is opinionated — day, short month, year — and
 * that is right for an editorial byline. It is not right for every date on the
 * site: /press writes the month out in full, /agents omits the day, the
 * market-report comparables and the listing "listed on" line pin `timeZone:
 * "UTC"` so a server and a client agree, and /status wants a time and a zone
 * name beside the date. Six surfaces, five different option sets — bolting
 * five flags onto one function would leave a wrapper over `Intl` with none of
 * the opinion that made it worth having.
 *
 * So those keep their own options and take only the tag from here. That is the
 * part that must not be written by hand: the choice of `en-GB` over `en`, of
 * `ar-AE` over `ar`, and above all the `-u-nu-latn` pin, whose absence is
 * invisible until the day an ICU build flips `ar` to Arabic-Indic digits.
 *
 * `lib/i18n/no-hardcoded-locale-tags.test.ts` is what keeps the literal from
 * coming back.
 */
export function localeDateTag(locale: Locale = DEFAULT_LOCALE): string {
  return DATE_TAG[locale] ?? DATE_TAG[DEFAULT_LOCALE];
}

/**
 * A publication date — "14 Mar 2026" / "14 مارس 2026".
 *
 * Returns "" for a null date, because every call site renders it inline in a
 * byline and a missing date should collapse rather than print "Invalid Date".
 */
export function formatPublishedDate(
  iso: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(DATE_TAG[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
