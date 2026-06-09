"use client";

/**
 * Mobile entry point for currency / area-unit preferences. The desktop
 * `PreferencesPopover` is hidden below md, so this bottom-sheet trigger
 * lives in the hamburger drawer footer to give mobile users the same
 * control (handoff: preferences fold into the drawer).
 */

import { useState } from "react";
import { Coins } from "lucide-react";
import { usePreferences } from "@/lib/preferences";
import { BottomSheet } from "@/components/brand/mobile";
import { PreferencesControls } from "./preferences-controls";

export function MobilePreferences() {
  const { prefs } = usePreferences();
  const [open, setOpen] = useState(false);

  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      title="Preferences"
      description="How prices and areas display across the site. Saved to this browser."
      trigger={
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 w-full items-center justify-between rounded-md px-3 text-[13.5px] text-bz-ink-2 hover:bg-bz-surface-2"
        >
          <span className="flex items-center gap-2">
            <Coins size={14} strokeWidth={1.6} />
            Currency &amp; units
          </span>
          <span className="mono text-[12px] text-bz-muted">
            {prefs.currency} · {prefs.area_unit === "m2" ? "m²" : "ft²"}
          </span>
        </button>
      }
    >
      <PreferencesControls />
      <p className="px-2 pt-3 text-[11px] text-bz-muted">
        AR locale &amp; RTL coming soon.
      </p>
    </BottomSheet>
  );
}
