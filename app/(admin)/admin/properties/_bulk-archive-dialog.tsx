"use client";

import { useState, useTransition } from "react";
import { Archive, AlertTriangle } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { bulkArchiveProperties } from "./_bulk-actions";

const PREVIEW_LIMIT = 5;
const CONFIRM_PHRASE = "ARCHIVE";

type Props = {
  ids: string[];
  references: Map<string, string>;
  onComplete: (remainingIds: string[]) => void;
};

export function BulkArchiveDialog({ ids, references, onComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [phrase, setPhrase] = useState("");

  const previewRefs = ids
    .slice(0, PREVIEW_LIMIT)
    .map((id) => references.get(id) ?? id.slice(0, 12));
  const remainder = Math.max(0, ids.length - PREVIEW_LIMIT);
  const phraseOk = phrase.trim().toUpperCase() === CONFIRM_PHRASE;

  function close() {
    setOpen(false);
    // Reset confirmation phrase after the dialog has had time to fade.
    setTimeout(() => setPhrase(""), 200);
  }

  function onConfirm() {
    if (!phraseOk) return;
    startTransition(async () => {
      const result = await bulkArchiveProperties(ids);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      onComplete(result.skipped.map((s) => s.id));
      const okN = result.succeeded.length;
      const skippedN = result.skipped.length;
      if (okN === 0) {
        toast.warning(`No rows archived (${skippedN} skipped).`);
      } else if (skippedN === 0) {
        toast.success(`Archived ${okN}.`);
      } else {
        toast.warning(`Archived ${okN}; ${skippedN} skipped.`);
      }
      close();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTimeout(() => setPhrase(""), 200);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-action="archive"
          disabled={ids.length === 0}
          className="text-[oklch(0.45_0.13_28)] hover:text-[oklch(0.4_0.15_28)]"
        >
          <Archive size={12} strokeWidth={1.8} />
          Archive
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              size={16}
              strokeWidth={1.8}
              className="text-[oklch(0.55_0.15_28)]"
            />
            Archive {ids.length} {ids.length === 1 ? "property" : "properties"}
          </DialogTitle>
          <DialogDescription>
            Archiving sets <span className="mono">status=archived</span> and{" "}
            <span className="mono">deleted_at=now()</span>. The rows drop out
            of the catalogue and every future bulk action. They can only be
            recovered by a database operation.
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
        <div className="mt-2">
          <label className="text-[12px] text-bz-muted">
            Type <span className="mono font-medium text-bz-ink">ARCHIVE</span>{" "}
            to confirm
          </label>
          <Input
            type="text"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="ARCHIVE"
            className="mt-1 mono"
            aria-label="Type ARCHIVE to confirm"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={pending || !phraseOk}
            className="bg-[oklch(0.55_0.15_28)] hover:bg-[oklch(0.5_0.16_28)] text-white"
          >
            <Archive size={12} strokeWidth={1.8} />
            {pending ? "Archiving…" : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
