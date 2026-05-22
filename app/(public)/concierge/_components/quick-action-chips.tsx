"use client";

import { Sparkles } from "lucide-react";

/**
 * Sprint 5c (backfilled): quick-action chip row beneath an assistant
 * message. Tapping a chip sends that text as the user's next message —
 * matches the design's "Show me X / Compare top 3 / Send to Mariam"
 * pattern.
 */
export function QuickActionChips({
  actions,
  onSelect,
}: {
  actions: string[];
  onSelect: (text: string) => void;
}) {
  if (actions.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onSelect(a)}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-bz-surface border border-bz-border text-[11.5px] text-bz-ink-2 hover:border-bz-border-strong hover:text-bz-ink transition-colors"
        >
          <Sparkles size={10} strokeWidth={1.8} className="text-bz-accent" />
          {a}
        </button>
      ))}
    </div>
  );
}
