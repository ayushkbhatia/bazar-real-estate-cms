"use client";

/**
 * Floating preferences trigger that sits alongside `PublicMegaNav` in the
 * (public) layout.
 *
 * Composes the megamenu rather than wrapping it (per the locked-files rule):
 * the popover renders as a sibling element inside the same header strip,
 * positioned via flexbox utility on the parent.
 */

import { Check, Coins, Ruler } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  CURRENCIES,
  AREA_UNITS,
  CURRENCY_LABEL,
  CURRENCY_SYMBOL,
  AREA_UNIT_LABEL,
  usePreferences,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

export function PreferencesPopover() {
  const { prefs, setCurrency, setAreaUnit } = usePreferences();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Change currency and area unit"
          className="h-9 gap-1.5 text-[13px] text-bz-ink-2 hover:text-bz-ink"
        >
          <Coins size={13} strokeWidth={1.6} />
          <span className="mono tracking-tight">{prefs.currency}</span>
          <span className="text-bz-muted">·</span>
          <span className="mono tracking-tight">
            {prefs.area_unit === "m2" ? "m²" : "ft²"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 p-0">
        <div className="px-4 pt-3 pb-2 border-b border-bz-border">
          <div className="eyebrow">Preferences</div>
          <p className="mt-1 text-[12px] text-bz-muted leading-snug">
            Choose how prices and areas display across the site. Saved to this
            browser.
          </p>
        </div>

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
                    "w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md text-[13.5px]",
                    "text-bz-ink hover:bg-bz-surface-2 transition-colors",
                    prefs.currency === c && "bg-bz-surface-2",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="mono text-[12px] w-9 inline-block text-left text-bz-ink-2">
                      {CURRENCY_SYMBOL[c]}
                    </span>
                    <span>{CURRENCY_LABEL[c]}</span>
                  </span>
                  {prefs.currency === c && (
                    <Check size={14} strokeWidth={1.8} className="text-bz-accent" />
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
                    "w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md text-[13.5px]",
                    "text-bz-ink hover:bg-bz-surface-2 transition-colors",
                    prefs.area_unit === u && "bg-bz-surface-2",
                  )}
                >
                  <span>{AREA_UNIT_LABEL[u]}</span>
                  {prefs.area_unit === u && (
                    <Check size={14} strokeWidth={1.8} className="text-bz-accent" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-4 py-2 border-t border-bz-border text-[11px] text-bz-muted">
          AR locale & RTL coming soon.
        </div>
      </PopoverContent>
    </Popover>
  );
}
