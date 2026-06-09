"use client";

/**
 * Floating preferences trigger that sits alongside `PublicMegaNav` in the
 * (public) layout.
 *
 * Composes the megamenu rather than wrapping it (per the locked-files rule):
 * the popover renders as a sibling element inside the same header strip,
 * positioned via flexbox utility on the parent.
 */

import { Coins } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/lib/preferences";
import { PreferencesControls } from "./preferences-controls";

export function PreferencesPopover() {
  const { prefs } = usePreferences();

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

        <PreferencesControls />

        <div className="px-4 py-2 border-t border-bz-border text-[11px] text-bz-muted">
          AR locale & RTL coming soon.
        </div>
      </PopoverContent>
    </Popover>
  );
}
