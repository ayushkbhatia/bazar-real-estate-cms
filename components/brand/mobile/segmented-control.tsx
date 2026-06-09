"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
};

/**
 * Segmented control (handoff `.bzm-seg`) — a value picker, NOT a tab
 * panel switcher. Used for search mode (Buy/Rent/Off-plan) and the
 * list⇄map view toggle. Net-new rather than Radix Tabs because the
 * "panels" are often the same surface with different params, and we
 * don't want tablist ARIA coupling. Rendered as a radiogroup. The 4px
 * container padding lifts the 36px buttons into a 44px hit row.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "md",
  className,
}: {
  value: T;
  onValueChange: (next: T) => void;
  options: SegmentOption<T>[];
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex w-full items-center gap-0.5 rounded-lg bg-bz-surface-2 p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "flex-1 rounded-md px-3 text-[13px] font-medium transition-colors",
              size === "md" ? "h-9" : "h-8",
              selected
                ? "bg-bz-surface text-bz-ink bz-shadow-1"
                : "text-bz-muted hover:text-bz-ink-2",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
