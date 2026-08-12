"use client";

import { Clock, Calendar, Coffee } from "lucide-react";

export const VALUATION_INTENTS = [
  "sell_now",
  "sell_6_months",
  "curious",
] as const;

export type ValuationIntent = (typeof VALUATION_INTENTS)[number];

const OPTIONS: {
  value: ValuationIntent;
  label: string;
  helper: string;
  icon: React.ElementType;
}[] = [
  {
    value: "sell_now",
    label: "Sell now",
    helper: "Listed within 30 days",
    icon: Clock,
  },
  {
    value: "sell_6_months",
    label: "In 6 months",
    helper: "Planning ahead",
    icon: Calendar,
  },
  {
    value: "curious",
    label: "Just curious",
    helper: "No intent to sell",
    icon: Coffee,
  },
];

/**
 * Sprint 5b (backfilled): intent picker on the valuation wizard's last
 * step. Routes high-intent submissions to a senior advisor immediately;
 * low-intent ones drop into the nurture sequence (Sprint 10).
 */
export function IntentField({
  value,
  onChange,
}: {
  value: ValuationIntent | null;
  onChange: (v: ValuationIntent) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value: v, label, helper, icon: Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={active}
            className={
              active
                ? "flex flex-col items-start gap-1 p-3 rounded-md border-2 border-bz-ink bg-bz-bg text-left transition-colors"
                : "flex flex-col items-start gap-1 p-3 rounded-md border border-bz-border bg-bz-bg text-left hover:border-bz-border-strong transition-colors"
            }
          >
            <Icon
              size={16}
              strokeWidth={1.7}
              className={active ? "text-bz-accent" : "text-bz-muted"}
            />
            <span className="text-[13.5px] text-bz-ink font-medium mt-1">
              {label}
            </span>
            <span className="text-[11px] text-bz-muted">{helper}</span>
          </button>
        );
      })}
    </div>
  );
}
