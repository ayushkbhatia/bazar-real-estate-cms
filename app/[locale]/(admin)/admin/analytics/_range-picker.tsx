"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
} from "@/lib/queries/analytics-utils";

export function AnalyticsRangePicker({
  current,
}: {
  current: AnalyticsRange;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function pick(range: AnalyticsRange) {
    const next = new URLSearchParams(params.toString());
    next.set("range", String(range));
    router.replace(`/admin/analytics?${next}`, { scroll: false });
  }

  return (
    <div className="inline-flex items-center bg-bz-surface border border-bz-border rounded overflow-hidden h-9 text-[12.5px]">
      <span className="px-2.5 text-bz-muted-2 uppercase tracking-wider text-[10.5px] border-r border-bz-border">
        Range
      </span>
      {ANALYTICS_RANGES.map((r) => {
        const active = current === r;
        return (
          <button
            key={r}
            type="button"
            onClick={() => pick(r)}
            className={cn(
              "h-full px-3 transition-colors",
              active
                ? "bg-bz-navy text-bz-bg"
                : "text-bz-ink-2 hover:bg-bz-surface-2",
            )}
            aria-pressed={active}
          >
            Last {r}d
          </button>
        );
      })}
    </div>
  );
}
