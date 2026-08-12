"use client";

import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { LOCALES, LOCALE_DIR, type Locale } from "@/lib/i18n/locales";
import { localeUrl } from "@/lib/i18n/locales";
import { stripLocalePrefix } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

const LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

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
 * The querystring rides along too, so an in-progress search survives.
 *
 * Renders nothing while only one locale is served, so this can ship before
 * Arabic does without leaving a dead control on the page.
 */
export function LanguageSwitch({ current }: { current: Locale }) {
  const pathname = usePathname();

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
            href={localeUrl(bare, locale)}
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
            <span>{LABELS[locale]}</span>
            {active ? (
              <Check size={14} strokeWidth={2} className="text-bz-teal" />
            ) : null}
          </a>
        );
      })}
    </div>
  );
}
