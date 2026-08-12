"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  MEDIA_STATE_FILTERS,
  type MediaStateFilter,
} from "@/lib/media-usage";

const LABELS: Record<MediaStateFilter, string> = {
  all: "All",
  live: "Live",
  attached: "Not live",
  internal: "Internal",
  unused: "Unused",
};

const HINTS: Record<MediaStateFilter, string> = {
  all: "Every asset in this folder",
  live: "On a published public page right now",
  attached: "Attached only to drafts, off-market or archived records",
  internal: "Deal documents and licence files — never public",
  unused: "Nothing references these — safe to trash",
};

/**
 * Usage-state filter above the media grid. URL-driven (`?state=`) so the
 * counts, the grid and the browser back button stay in agreement.
 */
export function MediaStateTabs({
  counts,
}: {
  counts: Record<MediaStateFilter, number>;
}) {
  const sp = useSearchParams();
  const active = (sp.get("state") ?? "all") as MediaStateFilter;

  return (
    <div className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
      {MEDIA_STATE_FILTERS.map((value) => {
        const params = new URLSearchParams(sp.toString());
        if (value === "all") params.delete("state");
        else params.set("state", value);
        const qs = params.toString();
        const isActive = active === value;
        return (
          <Link
            key={value}
            href={qs ? `?${qs}` : "?"}
            title={HINTS[value]}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] transition-colors",
              isActive
                ? "bg-bz-navy text-bz-bg font-medium"
                : "text-bz-ink-2 hover:text-bz-ink",
            )}
          >
            {LABELS[value]}
            <span
              className={cn(
                "mono text-[10.5px]",
                isActive ? "text-bz-bg/80" : "text-bz-muted",
              )}
            >
              {counts[value]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
