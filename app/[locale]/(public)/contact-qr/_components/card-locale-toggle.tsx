"use client";

/**
 * The EN/AR pill at the top of the QR contact card.
 *
 * ## Why it is a link and not a state toggle
 *
 * It used to be one. The card held a `Lang` in `useState`, and switching it
 * swapped a `Bilingual` pair per label — a design that was correct on the day
 * it shipped, because the page was English-only and the card carried both
 * languages itself.
 *
 * The Arabic epic took that out from under it. `getMasterPageContent` folds
 * the `_ar` twins down to the request's locale (`lib/master-pages/i18n.ts`),
 * so the server now hands the card ONE language and the twin key is gone by
 * the time a renderer sees it. Both halves of every `Bilingual` therefore held
 * the same string, and the toggle stopped changing any text: on
 * `/ar/contact-qr`, pressing EN left the Arabic copy in place and merely
 * flipped the card to `dir="ltr"` and back to the Latin face — Arabic text,
 * laid out left-to-right, in Geist. Strictly worse than not offering it.
 *
 * The fix is to stop having a second, private notion of "the language". There
 * is exactly one, it lives in the URL, and this control now states it the same
 * way the header pill does: an anchor built by `useLocaleHrefs`, carrying the
 * path, the querystring and the `?setlang=` that makes the choice stick for
 * the session. Both toggles stay usable and they can no longer disagree,
 * because there is nothing left for them to disagree about.
 *
 * A full document load is the point, not a compromise — switching locale
 * changes `<html lang>` and `<html dir>`, swaps the font stack and re-renders
 * from a different message catalogue, none of which a client-side transition
 * applies. Same reasoning as `LanguageSwitch`, which spells it out at length.
 *
 * ## Labels
 *
 * `EN` and `AR`, kept as they were drawn. The header pill uses `ع` for the
 * Arabic side on the principle that an option should be labelled in its own
 * language; this one sits inside a printed-card design where the two Latin
 * pairs are a matched set, and the accessible name carries the full `العربية`
 * either way, so a screen reader announces the language rather than the
 * abbreviation.
 */

import { useTranslations } from "next-intl";

import { LOCALES, LOCALE_DIR, type Locale } from "@/lib/i18n/locales";
import { useLocaleHrefs } from "@/lib/i18n/use-locale-hrefs";

/** Short label per locale. Latin on both sides — see the docblock. */
const SHORT: Record<Locale, string> = {
  en: "EN",
  ar: "AR",
};

export function CardLocaleToggle({ current }: { current: Locale }) {
  // Above the early return — hooks must run in the same order every render.
  const hrefFor = useLocaleHrefs();
  const t = useTranslations("common");

  const full: Record<Locale, string> = {
    en: t("languageEnglish"),
    ar: t("languageArabic"),
  };

  // Nothing to toggle between while one locale is served. Matches the other
  // two controls, so the card does not grow a dead pill if `ar` is ever pulled
  // back out of `LOCALES`.
  if (LOCALES.length < 2) return null;

  return (
    /*
      Written in DOM order EN, AR — the card's `dir` flips it, so the active
      language always sits on the leading edge of the reading order.
    */
    <div
      role="group"
      aria-label={t("language")}
      className="mx-auto flex w-fit items-center gap-1 rounded-full bg-bz-surface-2 p-1"
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
            // `aria-current` rather than the `aria-pressed` this carried as a
            // button: it is a link to the other language now, not a control
            // holding a pressed state.
            aria-current={active ? "true" : undefined}
            // The visible label is an abbreviation; the accessible name is the
            // language's own full name.
            aria-label={full[locale]}
            data-testid={`qr-lang-${locale}`}
            className={
              active
                ? "rounded-full bg-bz-navy px-5 py-1.5 text-[12px] font-semibold tracking-wider text-white"
                : "rounded-full px-5 py-1.5 text-[12px] font-semibold tracking-wider text-bz-muted transition-colors hover:text-bz-ink"
            }
          >
            <span aria-hidden="true">{SHORT[locale]}</span>
          </a>
        );
      })}
    </div>
  );
}
