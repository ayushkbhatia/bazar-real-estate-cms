"use client";

import { cn } from "@/lib/utils";
import {
  LIFESTYLE_TAGS,
  LIFESTYLE_TAG_LABEL,
  type LifestyleTag,
} from "@/lib/lifestyle-tags";

/**
 * Tick the lifestyle tags a listing is classified under.
 *
 * Used by the wizard and the edit page. Kept here rather than in
 * `components/brand/` beside `CardLabelPicker`: only the property screens
 * draw it, and those chips carry the card's colours while these are plain —
 * a tag is a search facet, not something the visitor sees on the photograph.
 */
export function LifestyleTagPicker({
  value,
  onChange,
  disabled,
}: {
  value: LifestyleTag[];
  onChange: (next: LifestyleTag[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value);

  function toggle(tag: LifestyleTag) {
    const next = new Set(selected);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    // Vocabulary order, so the stored array is canonical.
    onChange(LIFESTYLE_TAGS.filter((t) => next.has(t)));
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {LIFESTYLE_TAGS.map((tag) => {
        const on = selected.has(tag);
        return (
          <button
            key={tag}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => toggle(tag)}
            className={cn(
              "h-[28px] px-3 rounded-full border text-[12px] font-medium transition-colors",
              on
                ? "bg-bz-navy border-bz-navy text-bz-bg"
                : "bg-bz-surface border-bz-border text-bz-ink-2 hover:border-bz-border-strong",
              disabled && "opacity-60 cursor-not-allowed",
            )}
          >
            {LIFESTYLE_TAG_LABEL[tag].en}
          </button>
        );
      })}
    </div>
  );
}
