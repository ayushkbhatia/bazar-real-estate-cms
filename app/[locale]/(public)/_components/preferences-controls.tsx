"use client";

/**
 * The currency + area-unit pickers, shared by the desktop
 * `PreferencesPopover` and the mobile `MobilePreferences` bottom sheet
 * so both stay in sync. Reads/writes via `usePreferences`.
 */

import { useTranslations } from "next-intl";
import { Check, Coins, Ruler } from "lucide-react";
import {
  CURRENCIES,
  AREA_UNITS,
  usePreferences,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

export function PreferencesControls() {
  const { prefs, setCurrency, setAreaUnit } = usePreferences();
  // Two different sources, and the split is the point. The two GROUP HEADINGS
  // are UI copy and live in the message catalogue like every other string on
  // the site. The rows beneath them are the dictionary — the same words these
  // controls are choosing between, and the same ones every card on the site
  // will draw once chosen — so they come off `prefs.labels`, which the CMS can
  // override. A toggle that offered "درهم" and then priced the page in "AED"
  // would be the one place the whole feature is visibly self-contradictory.
  const t = useTranslations("common");
  const labels = prefs.labels;

  return (
    <>
      <div className="p-2">
        <div className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-bz-muted flex items-center gap-1.5">
          <Coins size={11} strokeWidth={1.8} /> {t("prefsCurrency")}
        </div>
        <ul className="flex flex-col">
          {CURRENCIES.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => setCurrency(c)}
                aria-pressed={prefs.currency === c}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-2 py-2.5 rounded-md text-[13.5px]",
                  "text-bz-ink hover:bg-bz-surface-2 transition-colors",
                  prefs.currency === c && "bg-bz-surface-2",
                )}
              >
                <span className="flex items-center gap-2">
                  {/* `min-w-9`, not `w-9`. The column was sized for "AED" and
                      "$"; "درهم" is wider than either and a fixed width clipped
                      it. A minimum keeps the two rows' names aligned in English
                      without capping what Arabic can put here. */}
                  <span className="mono text-[12px] min-w-9 inline-block text-start text-bz-ink-2">
                    {labels.currency[c]}
                  </span>
                  <span>{labels.currencyLong[c]}</span>
                </span>
                {prefs.currency === c && (
                  <Check
                    size={14}
                    strokeWidth={1.8}
                    className="text-bz-accent"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-2 border-t border-bz-border">
        <div className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-bz-muted flex items-center gap-1.5">
          <Ruler size={11} strokeWidth={1.8} /> {t("prefsAreaUnit")}
        </div>
        <ul className="flex flex-col">
          {AREA_UNITS.map((u) => (
            <li key={u}>
              <button
                type="button"
                onClick={() => setAreaUnit(u)}
                aria-pressed={prefs.area_unit === u}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-2 py-2.5 rounded-md text-[13.5px]",
                  "text-bz-ink hover:bg-bz-surface-2 transition-colors",
                  prefs.area_unit === u && "bg-bz-surface-2",
                )}
              >
                <span>{labels.areaLong[u]}</span>
                {prefs.area_unit === u && (
                  <Check
                    size={14}
                    strokeWidth={1.8}
                    className="text-bz-accent"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
