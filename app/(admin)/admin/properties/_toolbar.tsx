"use client";

import { useMemo } from "react";
import {
  Send,
  ArrowDownToLine,
  UserRoundCog,
  Archive,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { parseAsString, useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BULK_SELECTION_CAP,
  BULK_SELECTION_PARAM,
  parseSelectedParam,
} from "@/lib/bulk/selection";

const selectedParser = parseAsString.withDefault("");

const COMING_SOON_TOASTS: Record<BulkAction, string> = {
  publish: "Bulk publish lands in PR I4.",
  off_market: "Bulk off-market lands in PR I6.",
  reassign: "Bulk reassign lands in PR I5.",
  archive: "Bulk archive lands in PR I7.",
};

type BulkAction = "publish" | "off_market" | "reassign" | "archive";

export function BulkToolbar() {
  const [rawSelected, setRawSelected] = useQueryState(
    BULK_SELECTION_PARAM,
    selectedParser,
  );

  const ids = useMemo(() => parseSelectedParam(rawSelected), [rawSelected]);
  const count = ids.length;

  if (count === 0) return null;

  function onClear() {
    void setRawSelected(null);
  }

  function onAction(action: BulkAction) {
    toast.info(COMING_SOON_TOASTS[action]);
  }

  const atCap = count >= BULK_SELECTION_CAP;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={cn(
        "sticky top-[60px] z-30 -mx-6 px-6 py-3",
        "bg-bz-accent-soft border-y border-bz-border",
        "flex items-center gap-3 flex-wrap",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          data-testid="bulk-count"
          className="inline-flex items-center h-6 px-2 rounded-full text-[12px] font-medium bg-bz-ink text-bz-bg"
        >
          {count} selected
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 px-2 text-[12px] text-bz-muted hover:text-bz-ink"
        >
          <X size={12} strokeWidth={1.8} />
          Clear selection
        </Button>
        {atCap ? (
          <span className="text-[11px] text-bz-muted-2">
            Selection cap reached ({BULK_SELECTION_CAP}).
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAction("publish")}
          data-action="publish"
        >
          <Send size={12} strokeWidth={1.8} />
          Publish
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAction("off_market")}
          data-action="off_market"
        >
          <ArrowDownToLine size={12} strokeWidth={1.8} />
          Move off-market
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAction("reassign")}
          data-action="reassign"
        >
          <UserRoundCog size={12} strokeWidth={1.8} />
          Reassign agent
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAction("archive")}
          data-action="archive"
          className="text-[oklch(0.45_0.13_28)] hover:text-[oklch(0.4_0.15_28)]"
        >
          <Archive size={12} strokeWidth={1.8} />
          Archive
        </Button>
      </div>
    </div>
  );
}
