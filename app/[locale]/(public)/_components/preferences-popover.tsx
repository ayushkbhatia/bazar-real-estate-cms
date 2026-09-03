"use client";

/**
 * Floating preferences trigger that sits alongside `PublicMegaNav` in the
 * (public) layout.
 *
 * Composes the megamenu rather than wrapping it (per the locked-files rule).
 * Not "inside the same header strip positioned via flexbox", as this said for
 * months — the layout renders it `fixed top-[84px] end-4`, i.e. floating 12px
 * BELOW the 72px bar, because the bar's inline-end is occupied at every
 * breakpoint and `PublicMegaNav` has no slot for it. Scoping a change from the
 * old description started from a model the code never implemented.
 */

import { Coins } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "next-intl";
import { usePreferences } from "@/lib/preferences";
import { PreferencesControls } from "./preferences-controls";
import { LanguageSwitch } from "./language-switch";
import type { Locale } from "@/lib/i18n/locales";

export function PreferencesPopover() {
  const { prefs } = usePreferences();
  const t = useTranslations("common");
  const locale = useLocale() as Locale;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("preferences")}
          // Carries its own surface because it does not sit on the page — it
          // is fixed to the viewport and floats over whatever scrolls beneath.
          // On a cream page dark ink was fine; over a media hero, a navy band
          // or the footer it was dark-on-dark. The pill makes it legible
          // against anything without needing to know what it is over.
          className="h-9 gap-1.5 rounded-full border border-bz-border bg-bz-surface/95 px-3 text-[13px] text-bz-ink-2 shadow-sm backdrop-blur-sm hover:bg-bz-surface hover:text-bz-ink"
        >
          <Coins size={13} strokeWidth={1.6} />
          {/*
            Both halves come off the dictionary rather than off the raw
            preference. The currency used to render `prefs.currency` — the
            enum member, "AED" — and the unit a ternary on `m2`, which is the
            single place the two words the site is full of were still typed by
            hand. On /ar the pill was the label on a control offering Arabic
            for everything except itself.

            `.mono` stays on both: globals.css isolates it as an LTR run on
            Arabic pages, which is what stops the "·" between them being
            reordered to the far end of the pill.
          */}
          <span className="mono tracking-tight">
            {prefs.labels.currency[prefs.currency]}
          </span>
          <span className="text-bz-muted">·</span>
          <span className="mono tracking-tight">
            {prefs.labels.area[prefs.area_unit]}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 p-0">
        <div className="px-4 pt-3 pb-2 border-b border-bz-border">
          <div className="eyebrow">{t("preferences")}</div>
          <p className="mt-1 text-[12px] text-bz-muted leading-snug">
            {t("preferencesHelp")}
          </p>
        </div>

        <PreferencesControls />

        {/* The slot that used to read "AR locale & RTL coming soon." It now
            holds the real control, and renders nothing while only one locale
            is served — so this shipped before Arabic did without leaving a
            dead affordance on the page. */}
        <div className="border-t border-bz-border">
          <div className="px-4 pt-2 eyebrow">{t("language")}</div>
          <LanguageSwitch current={locale} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
