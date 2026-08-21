"use client";

/**
 * The English/Arabic toggle that sits in the public header bar.
 *
 * Distinct from `LanguageSwitch`, which is the same choice rendered as a list
 * inside the preferences popover and the mobile sheet. That one is fine where
 * it lives and useless as a discovery affordance: on desktop it is two clicks
 * behind a control labelled "AED · ft²" and only mounted at `xl` and above, and
 * on mobile it is three, behind the hamburger and then "Currency & units".
 * A visitor who reads Arabic has no way to know the site has an Arabic side.
 *
 * So this is one more presentation of one decision, not a second decision. All
 * three — this, `LanguageSwitch` and the QR card's `CardLocaleToggle` — build
 * their hrefs through `useLocaleHrefs`, and none of them owns state. The locale
 * IS the URL, and the `?setlang=` the helper adds is what tells the proxy to
 * remember the choice for the rest of the session rather than for the one
 * page.
 *
 * ## Why an anchor, and why no `next/link`
 *
 * Inherited from `LanguageSwitch` and load-bearing for the same reason:
 * switching locale changes `<html lang>` and `<html dir>`, swaps the font
 * stack, and re-renders from a different message catalogue. A client-side
 * transition applies none of that, because the root layout is not re-executed.
 * A full document load is the correct behaviour here, not a fallback.
 *
 * ## Labels
 *
 * `EN` and `ع` rather than the full names the popover shows. Each is still
 * written in its OWN language, which is the rule that matters — a control
 * labelled only in the language you cannot read is useless to the one person
 * who needs it. The accessible name carries the full word, so a screen reader
 * announces "العربية" rather than the bare letter.
 */

import { useTranslations } from "next-intl";

import { LOCALES, LOCALE_DIR, type Locale } from "@/lib/i18n/locales";
import { useLocaleHrefs } from "@/lib/i18n/use-locale-hrefs";
import { cn } from "@/lib/utils";

/** Short label per locale, each in its own language. */
const SHORT: Record<Locale, string> = {
  en: "EN",
  ar: "ع",
};

export function LocaleToggle({ current }: { current: Locale }) {
  // Above the early return — hooks must run in the same order every render.
  const hrefFor = useLocaleHrefs();
  const t = useTranslations("common");

  const full: Record<Locale, string> = {
    en: t("languageEnglish"),
    ar: t("languageArabic"),
  };

  // Nothing to toggle between while one locale is served. Matches
  // `LanguageSwitch`, so neither control becomes a dead affordance if `ar` is
  // ever pulled back out of `LOCALES`.
  if (LOCALES.length < 2) return null;

  return (
    <div
      // `group/locale` rather than a bare `group`: the header this sits inside
      // has its own hover groups, and an unnamed one would be captured by the
      // nearest ancestor.
      className="flex items-center rounded-full border border-bz-border bg-bz-surface/95 p-0.5 shadow-sm backdrop-blur-sm"
      role="group"
      aria-label={t("language")}
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <a
            key={locale}
            href={hrefFor(locale)}
            hrefLang={locale}
            lang={locale}
            dir={LOCALE_DIR[locale]}
            aria-current={active ? "true" : undefined}
            // The visible label is an abbreviation; the accessible name is the
            // language's own full name.
            aria-label={full[locale]}
            className={cn(
              "min-w-[30px] rounded-full px-2 py-1 text-center text-[12px] leading-none transition-colors",
              // The Arabic glyph sits lower than Latin caps at the same size,
              // so the two options look vertically misaligned in a shared row
              // unless the line box is normalised.
              "inline-flex h-6 items-center justify-center",
              active
                ? "bg-bz-navy text-white font-medium"
                : "text-bz-ink-2 hover:bg-bz-surface-2 hover:text-bz-ink",
            )}
          >
            <span aria-hidden="true">{SHORT[locale]}</span>
          </a>
        );
      })}
    </div>
  );
}
