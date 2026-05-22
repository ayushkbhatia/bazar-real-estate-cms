"use client";

import { useQueryState } from "nuqs";
import { parseAsStringEnum } from "nuqs";
import { Grid3X3, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type MediaView = "grid" | "list";

/**
 * Sprint 7d (backfilled): grid / list toggle on /admin/media.
 */
export function MediaViewToggle() {
  const [view, setView] = useQueryState(
    "view",
    parseAsStringEnum<MediaView>(["grid", "list"]).withDefault("grid"),
  );

  return (
    <div className="inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
      <button
        type="button"
        onClick={() => setView(null)}
        aria-pressed={view === "grid"}
        className={cn(
          "inline-flex items-center gap-1 h-7 px-2 rounded text-[12px]",
          view === "grid"
            ? "bg-bz-ink text-bz-bg font-medium"
            : "text-bz-ink-2 hover:text-bz-ink",
        )}
      >
        <Grid3X3 size={12} strokeWidth={1.8} />
        Grid
      </button>
      <button
        type="button"
        onClick={() => setView("list")}
        aria-pressed={view === "list"}
        className={cn(
          "inline-flex items-center gap-1 h-7 px-2 rounded text-[12px]",
          view === "list"
            ? "bg-bz-ink text-bz-bg font-medium"
            : "text-bz-ink-2 hover:text-bz-ink",
        )}
      >
        <List size={12} strokeWidth={1.8} />
        List
      </button>
    </div>
  );
}
