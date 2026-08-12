"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BULK_SELECTION_CAP,
  BULK_SELECTION_PARAM,
  parseSelectedParam,
  serializeSelection,
} from "@/lib/bulk/selection";
import { BulkPublishDialog } from "./_bulk-publish-dialog";
import {
  BulkReassignDialog,
  type AgentOption,
} from "./_bulk-reassign-dialog";
import { BulkOffMarketDialog } from "./_bulk-offmarket-dialog";
import { BulkArchiveDialog } from "./_bulk-archive-dialog";

const selectedParser = parseAsString.withDefault("");

export type ToolbarRow = { id: string; reference: string };

export function BulkToolbar({
  rows,
  agents,
}: {
  rows: ToolbarRow[];
  agents: AgentOption[];
}) {
  const [rawSelected, setRawSelected] = useQueryState(
    BULK_SELECTION_PARAM,
    selectedParser,
  );

  const ids = useMemo(() => parseSelectedParam(rawSelected), [rawSelected]);
  const count = ids.length;

  const references = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.id, r.reference);
    return m;
  }, [rows]);

  if (count === 0) return null;

  function onClear() {
    void setRawSelected(null);
  }

  function onPublishComplete(remaining: string[]) {
    void setRawSelected(serializeSelection(remaining));
  }

  function onReassignComplete(remaining: string[]) {
    void setRawSelected(serializeSelection(remaining));
  }

  function onOffMarketComplete(remaining: string[]) {
    void setRawSelected(serializeSelection(remaining));
  }

  function onArchiveComplete(remaining: string[]) {
    void setRawSelected(serializeSelection(remaining));
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

      <div className="flex items-center gap-2 ms-auto">
        <BulkPublishDialog
          ids={ids}
          onComplete={onPublishComplete}
          references={references}
        />
        <BulkOffMarketDialog
          ids={ids}
          references={references}
          onComplete={onOffMarketComplete}
        />
        <BulkReassignDialog
          ids={ids}
          references={references}
          agents={agents}
          onComplete={onReassignComplete}
        />
        <BulkArchiveDialog
          ids={ids}
          references={references}
          onComplete={onArchiveComplete}
        />
      </div>
    </div>
  );
}
