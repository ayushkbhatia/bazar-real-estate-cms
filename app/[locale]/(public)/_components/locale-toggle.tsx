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
 *
 * ## Order is pinned LTR
 *
 * The pill used to inherit `<html dir>`, so `EN | ع` on the English site
 * became `ع | EN` on the Arabic one — the two options traded places every
 * time the control was used. That is measurable: `EN` sits at x≈310 on
 * `/contact-qr` and x≈65 on `/ar/contact-qr`.
 *
 * A control whose halves move cannot be operated by position, and a language
 * switch is operated by position — it is two glyphs in a pill, tapped without
 * re-reading. Tap the wrong half and you get the locale you are already in:
 * a navigation to the current page, a proxy redirect back to it, and no
 * visible change at all. The control reads as dead while every href is right.
 *
 * The QR card's `CardLocaleToggle` is where this was caught, because `EN` and
 * `AR` are two Latin pairs of identical width and nothing cues you to re-read.
 * The defect is the same here and is fixed the same way. Only the ORDER of
 * two siblings is pinned — the page around it still flips, and each option
 * keeps its own `dir`/`lang` so `ع` renders and announces correctly.
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
      className="flex items-center rounded-full border border-bz-border bg-bz-surface/95 p-0.5 shadow-sm backdrop-blur-sm"
      role="group"
      aria-label={t("language")}
      // Pinned, not inherited. See "Order is pinned LTR" above: English left,
      // Arabic right, in both locales, so a tap means the same thing twice.
      dir="ltr"
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
              // The ANCHOR is the hit box; the span inside it is the ink.
              //
              // 44x44 below `md`, in the anchor's own border box. Width was
              // always real (`min-w-11`); height used to be a transparent
              // `::after` spanning `-inset-y-2.5`, on the argument that a
              // click on a pseudo-element hits its originating element, so the
              // control was 44px to a thumb and 24px to the eye. True for a
              // human and false for a measurement: `e2e/mobile-geometry.spec`
              // reads `getBoundingClientRect()`, which knows nothing about
              // pseudo-elements, and its `touchTargets` check is blocking with
              // a deliberately empty waiver list. It reported `44x24 "English"`
              // on all 26 mobile routes the moment this pill stopped being
              // gated at `xl` — the gate had been hiding the finding, not
              // preventing it.
              //
              // So the height is real now and the ink is unchanged: `h-11`
              // with `-my-2.5` cancels the extra 20px out of the flex line, so
              // the painted pill stays 28px and the anchor still reports 44.
              // The pill is `fixed top-[84px]`, floating over content on all
              // 37 routes at every scroll position, and 44px of ink there
              // would cost more than it buys.
              //
              // Block axis only, as before: the two options are adjacent, and
              // an inline expansion would overlap and hand a tap to whichever
              // painted last — precisely the failure this file's "Order is
              // pinned LTR" note exists to prevent.
              "group/opt inline-flex min-w-11 items-center justify-center md:min-w-[30px]",
              "h-11 -my-2.5 md:h-6 md:my-0",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                // The Arabic glyph sits lower than Latin caps at the same
                // size, so the two options look vertically misaligned in a
                // shared row unless the line box is normalised.
                "flex h-6 w-full items-center justify-center rounded-full px-2 text-center text-[12px] leading-none transition-colors",
                active
                  ? "bg-bz-navy text-white font-medium"
                  : "text-bz-ink-2 group-hover/opt:bg-bz-surface-2 group-hover/opt:text-bz-ink",
              )}
            >
              {SHORT[locale]}
            </span>
          </a>
        );
      })}
    </div>
  );
}
