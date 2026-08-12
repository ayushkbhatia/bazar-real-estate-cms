"use client";

import { Calendar } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * Sprint 7f (backfilled): future-publish date picker on the blog editor.
 * Sets `articles.published_at` in the future. Sprint 10 cron flips
 * status='scheduled' → 'published' when the timestamp passes.
 */
export function ArticleSchedulePicker({
  value,
  onChange,
  minTodayIso,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  minTodayIso: string;
}) {
  return (
    <div>
      <Eyebrow>Schedule publish</Eyebrow>
      <p className="mt-2 text-[12px] text-bz-muted leading-relaxed">
        Pick a date and time. The Sprint 10 cron flips status from
        scheduled → published when the moment hits.
      </p>
      <div className="relative mt-3">
        <Calendar
          size={14}
          strokeWidth={1.7}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
        />
        <input
          type="datetime-local"
          value={value ? value.slice(0, 16) : ""}
          min={`${minTodayIso}T00:00`}
          onChange={(e) =>
            onChange(e.target.value ? `${e.target.value}:00Z` : null)
          }
          className="w-full h-9 pl-9 pr-3 rounded-md border border-bz-border bg-bz-bg text-[13px] outline-none focus:border-bz-accent"
        />
      </div>
    </div>
  );
}
