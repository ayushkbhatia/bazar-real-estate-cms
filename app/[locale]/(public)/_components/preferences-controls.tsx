"use client";

/**
 * The currency + area-unit pickers, shared by the desktop
 * `PreferencesPopover` and the mobile `MobilePreferences` bottom sheet
 * so both stay in sync. Reads/writes via `usePreferences`.
 */

import { Check, Coins, Ruler } from "lucide-react";
import {
  CURRENCIES,
  AREA_UNITS,
  CURRENCY_LABEL,
  CURRENCY_SYMBOL,
  AREA_UNIT_LABEL,
  usePreferences,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

export function PreferencesControls() {
  const { prefs, setCurrency, setAreaUnit } = usePreferences();

  return (
    <>
      <div className="p-2">
        <div className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-bz-muted flex items-center gap-1.5">
          <Coins size={11} strokeWidth={1.8} /> Currency
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
                  <span className="mono text-[12px] w-9 inline-block text-start text-bz-ink-2">
                    {CURRENCY_SYMBOL[c]}
                  </span>
                  <span>{CURRENCY_LABEL[c]}</span>
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
          <Ruler size={11} strokeWidth={1.8} /> Area unit
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
                <span>{AREA_UNIT_LABEL[u]}</span>
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
