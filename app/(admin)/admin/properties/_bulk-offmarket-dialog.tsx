"use client";

import { useState, useTransition } from "react";
import { ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { bulkMoveOffMarket } from "./_bulk-actions";

const PREVIEW_LIMIT = 5;

type Props = {
  ids: string[];
  references: Map<string, string>;
  onComplete: (remainingIds: string[]) => void;
};

export function BulkOffMarketDialog({ ids, references, onComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const previewRefs = ids
    .slice(0, PREVIEW_LIMIT)
    .map((id) => references.get(id) ?? id.slice(0, 12));
  const remainder = Math.max(0, ids.length - PREVIEW_LIMIT);

  function onConfirm() {
    startTransition(async () => {
      const result = await bulkMoveOffMarket(ids);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      onComplete(result.skipped.map((s) => s.id));
      const okN = result.succeeded.length;
      const skippedN = result.skipped.length;
      if (okN === 0) {
        toast.warning(`No rows moved off-market (${skippedN} skipped).`);
      } else if (skippedN === 0) {
        toast.success(
          `Moved ${okN} off-market.`,
        );
      } else {
        toast.warning(`Moved ${okN} off-market; ${skippedN} skipped.`);
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-action="off_market"
          disabled={ids.length === 0}
        >
          <ArrowDownToLine size={12} strokeWidth={1.8} />
          Move off-market
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Move {ids.length} {ids.length === 1 ? "property" : "properties"} off-market?
          </DialogTitle>
          <DialogDescription>
            Listings disappear from the public marketplace (/buy, /rent) and
            their detail URLs return a soft &quot;sold&quot; state. The rows
            stay in the catalogue and can be re-published later.
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-2 flex flex-col gap-1 text-[13px]">
          {previewRefs.map((ref) => (
            <li key={ref} className="mono text-bz-ink-2">
              {ref}
            </li>
          ))}
          {remainder > 0 ? (
            <li className="text-[12px] text-bz-muted">+{remainder} more</li>
          ) : null}
        </ul>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending}>
            <ArrowDownToLine size={12} strokeWidth={1.8} />
            {pending ? "Moving…" : "Move off-market"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
