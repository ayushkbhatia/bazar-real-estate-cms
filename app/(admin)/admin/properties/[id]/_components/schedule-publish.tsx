"use client";

import { Calendar } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * Sprint 7c (backfilled): schedule-publish date picker on the property
 * publish card. Sets a future `published_at` — Sprint 10 cron sweeps and
 * flips status when the time hits.
 */
export function SchedulePublishField({
  value,
  onChange,
  minTodayIso,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  /** Today's date in YYYY-MM-DD; passed from the server to avoid render-time Date.now(). */
  minTodayIso: string;
}) {
  return (
    <div>
      <Eyebrow>Schedule publish</Eyebrow>
      <p className="mt-2 text-[12px] text-bz-muted leading-relaxed">
        Set a future date and a Sprint 10 cron flips the listing from
        draft → published at that time. Leave blank to publish manually.
      </p>
      <div className="relative mt-3">
        <Calendar
          size={14}
          strokeWidth={1.7}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
        />
        <input
          type="date"
          value={value ?? ""}
          min={minTodayIso}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full h-9 pl-9 pr-3 rounded-md border border-bz-border bg-bz-bg text-[13px] outline-none focus:border-bz-border-strong"
        />
      </div>
    </div>
  );
}
