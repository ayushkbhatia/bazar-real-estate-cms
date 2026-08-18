"use client";

import { useTranslations } from "next-intl";

import { usePathname } from "next/navigation";

import { useSearchSuffix } from "@/lib/i18n/use-search-suffix";
import { Check } from "lucide-react";
import { LOCALES, LOCALE_DIR, type Locale } from "@/lib/i18n/locales";
import { localeUrl } from "@/lib/i18n/locales";
import { stripLocalePrefix } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * The language switch, shared by the desktop popover and the mobile sheet.
 *
 * A plain `<a>`, not `next/link`, and that is load-bearing. Switching locale
 * changes `<html lang>` and `<html dir>`, swaps the font stack, and re-renders
 * from a different message catalogue — none of which a client-side transition
 * applies, because the root layout is not re-executed. Next's own docs note
 * that navigating across root layouts triggers a full page load; this makes
 * that explicit rather than relying on it.
 *
 * It preserves the current path, so a visitor reading a listing in English
 * lands on the same listing in Arabic rather than being dumped at the home
 * page — which is the single most common way a language switch annoys people.
 *
 * The querystring rides along for the same reason. This docblock claimed that
 * from the day it was written and the code did not do it: the href was built
 * from `usePathname()` alone, so switching locale on
 * `/buy/search?beds=3&type=villa&price_max=4000000` dropped every filter and
 * landed on an unfiltered `/ar/buy/search`. On a search-led site that is the
 * second most common way a language switch annoys people, and it was
 * documented as handled.
 *
 * Renders nothing while only one locale is served, so this can ship before
 * Arabic does without leaving a dead control on the page.
 */
export function LanguageSwitch({ current }: { current: Locale }) {
  const pathname = usePathname();
  // Carried so a locale switch mid-search keeps the filters.
  const suffix = useSearchSuffix();
  // Above the early return: hooks must run in the same order on every render.
  const t = useTranslations("common");
  /*
   * Each option is labelled in its OWN language, which is why these two keys
   * are the only entries in IDENTICAL_BY_DESIGN: `English` stays `English`
   * under Arabic and `العربية` stays `العربية` under English. A switch
   * labelled in the locale you cannot read is useless to the one person who
   * needs it.
   */
  const label: Record<Locale, string> = {
    en: t("languageEnglish"),
    ar: t("languageArabic"),
  };

  if (LOCALES.length < 2) return null;

  // `usePathname` returns the visitor-facing path, which is already
  // unprefixed for English and `/ar/…` for Arabic. Strip whatever is there and
  // re-prefix for the target so the two cannot compound.
  const bare = stripLocalePrefix(pathname ?? "/");

  return (
    <div className="px-2 py-1.5">
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <a
            key={locale}
            href={`${localeUrl(bare, locale)}${suffix}`}
            hrefLang={locale}
            lang={locale}
            dir={LOCALE_DIR[locale]}
            aria-current={active ? "true" : undefined}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
              active
                ? "text-bz-ink font-medium"
                : "text-bz-ink-2 hover:bg-bz-surface-2 hover:text-bz-ink",
            )}
          >
            <span>{label[locale]}</span>
            {active ? (
              <Check size={14} strokeWidth={2} className="text-bz-teal" />
            ) : null}
          </a>
        );
      })}
    </div>
  );
}
