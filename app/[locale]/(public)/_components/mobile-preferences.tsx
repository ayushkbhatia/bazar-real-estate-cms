"use client";

/**
 * Mobile entry point for currency / area-unit preferences. The desktop
 * `PreferencesPopover` is hidden below md, so this bottom-sheet trigger
 * lives in the hamburger drawer footer to give mobile users the same
 * control (handoff: preferences fold into the drawer).
 */

import { useState } from "react";
import { Coins } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePreferences } from "@/lib/preferences";
import { BottomSheet } from "@/components/brand/mobile";
import { PreferencesControls } from "./preferences-controls";
import { LanguageSwitch } from "./language-switch";
import type { Locale } from "@/lib/i18n/locales";

export function MobilePreferences() {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const { prefs } = usePreferences();
  const [open, setOpen] = useState(false);

  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      title={t("preferences")}
      description={t("preferencesHelp")}
      trigger={
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 w-full items-center justify-between rounded-md px-3 text-[13.5px] text-bz-ink-2 hover:bg-bz-surface-2"
        >
          <span className="flex items-center gap-2">
            <Coins size={14} strokeWidth={1.6} />
            {t("currencyAndUnits")}
          </span>
          {/* Same dictionary as the desktop pill — see the note there. */}
          <span className="mono text-[12px] text-bz-muted">
            {prefs.labels.currency[prefs.currency]} ·{" "}
            {prefs.labels.area[prefs.area_unit]}
          </span>
        </button>
      }
    >
      <PreferencesControls />
      {/* Was "AR locale & RTL coming soon." — now the real control. Renders
          nothing while only one locale is served. */}
      <div className="mt-3 border-t border-bz-border pt-2">
        <div className="px-2 eyebrow">{t("language")}</div>
        <LanguageSwitch current={locale} />
      </div>
    </BottomSheet>
  );
}
