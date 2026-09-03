"use client";

import { cn } from "@/lib/utils";
import { type CardLabel, type CardLabelKind } from "@/lib/card-labels";

/**
 * Tick the labels a listing wears.
 *
 * One component for the three places a listing is edited — the property
 * wizard, the property edit page, and a development — because the thing being
 * chosen is the same vocabulary in all three, and three checkbox lists would
 * drift the moment one of them learned about a new label kind.
 *
 * It renders the actual chips rather than plain checkboxes. The whole point of
 * the screen behind this is that an operator picks words AND colours, and a
 * list of ticked boxes hides the half of the decision that shows up on the
 * card.
 *
 * Disabled labels are drawn, struck through, and not selectable: hiding them
 * would leave a listing carrying a tag its editor cannot see, and the reason
 * it is not on the card would be a setting on another screen.
 */

const SWATCH: Record<CardLabelKind, string> = {
  ink: "bg-bz-navy text-bz-bg",
  accent: "bg-bz-accent-soft text-bz-accent",
  success: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  warn: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  danger: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
};

/** The card's room. Mirrors the `limit` default in `labelsFor`. */
export const CARD_LABEL_SLOTS = 2;

export function CardLabelPicker({
  vocabulary,
  value,
  onChange,
  disabled,
}: {
  vocabulary: CardLabel[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value);
  // In vocabulary order, which is the order the card draws them in — so the
  // count below is telling the truth about which two would show.
  const shown = vocabulary.filter((l) => l.enabled && selected.has(l.id));

  function toggle(id: string) {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  if (!vocabulary.length)
    return (
      <p className="text-[12.5px] text-bz-muted">
        No labels yet — add some under Settings → Card labels.
      </p>
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {vocabulary.map((l) => {
          const on = selected.has(l.id);
          return (
            <button
              key={l.id}
              type="button"
              disabled={disabled || !l.enabled}
              aria-pressed={on}
              onClick={() => toggle(l.id)}
              title={l.enabled ? undefined : "Switched off in Settings"}
              className={cn(
                "h-[26px] px-2.5 rounded-full text-[11.5px] font-medium transition-opacity",
                SWATCH[l.kind],
                on ? "ring-2 ring-offset-1 ring-bz-ink" : "opacity-45",
                !l.enabled && "line-through cursor-not-allowed opacity-30",
              )}
            >
              {l.text}
            </button>
          );
        })}
      </div>
      {shown.length > CARD_LABEL_SLOTS ? (
        // Not an error — a listing may legitimately carry more than the card
        // can draw, and which two win is the vocabulary order the client set.
        // Saying so beats letting them wonder why the third never appears.
        <p className="text-[12px] text-bz-muted">
          A card shows {CARD_LABEL_SLOTS}. These {shown.length} are ticked, so{" "}
          <strong className="font-medium text-bz-ink-2">
            {shown
              .slice(0, CARD_LABEL_SLOTS)
              .map((l) => l.text)
              .join(" and ")}
          </strong>{" "}
          will show — reorder them under Settings → Card labels to change that.
        </p>
      ) : null}
    </div>
  );
}
