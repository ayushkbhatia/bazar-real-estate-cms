"use client";

import { useState, useTransition } from "react";
import { Send, CheckCircle2, AlertCircle, EyeOff } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  bulkPublishProperties,
  type BulkPublishOutcome,
} from "./_bulk-actions";

const PREVIEW_LIMIT = 5;

type Props = {
  ids: string[];
  /** Called with the ids that should remain selected after the action
   *  completes (blocked + skipped, never succeeded). */
  onComplete: (remainingIds: string[]) => void;
  references: Map<string, string>;
};

export function BulkPublishDialog({ ids, onComplete, references }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<BulkPublishOutcome | null>(null);

  const previewRefs = ids
    .slice(0, PREVIEW_LIMIT)
    .map((id) => references.get(id) ?? id.slice(0, 12));
  const remainder = Math.max(0, ids.length - PREVIEW_LIMIT);

  function reset() {
    setOutcome(null);
  }

  function close() {
    setOpen(false);
    // Defer the reset so the dialog can fade out before the body re-renders.
    setTimeout(reset, 200);
  }

  function onConfirm() {
    startTransition(async () => {
      const result = await bulkPublishProperties(ids);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      setOutcome(result.outcome);

      // Drop the succeeded ids from selection; keep blocked + skipped so the
      // user can fix and retry.
      const remaining = [
        ...result.outcome.blocked.map((b) => b.id),
        ...result.outcome.skipped.map((s) => s.id),
      ];
      onComplete(remaining);

      const okN = result.outcome.succeeded.length;
      const blockedN = result.outcome.blocked.length;
      const skippedN = result.outcome.skipped.length;
      if (okN === 0 && blockedN === 0 && skippedN === 0) {
        toast.info("Nothing to publish.");
      } else if (blockedN === 0 && skippedN === 0) {
        toast.success(`Published ${okN} ${okN === 1 ? "property" : "properties"}.`);
      } else {
        toast.warning(
          `Published ${okN}; ${blockedN} blocked, ${skippedN} skipped.`,
        );
      }
    });
  }

  const inResults = outcome !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTimeout(reset, 200);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-action="publish"
          disabled={ids.length === 0}
        >
          <Send size={12} strokeWidth={1.8} />
          Publish
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {inResults ? (
          <ResultsView outcome={outcome} onDone={close} />
        ) : (
          <ConfirmView
            count={ids.length}
            previewRefs={previewRefs}
            remainder={remainder}
            pending={pending}
            onConfirm={onConfirm}
            onCancel={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmView({
  count,
  previewRefs,
  remainder,
  pending,
  onConfirm,
  onCancel,
}: {
  count: number;
  previewRefs: string[];
  remainder: number;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Publish {count} {count === 1 ? "property" : "properties"}?
        </DialogTitle>
        <DialogDescription>
          Each row passes the same publish gate as the single-property flow
          (title + slug + price + listing permit). Rows that fail any check
          stay in selection — fix them and try again.
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
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm} disabled={pending}>
          <Send size={12} strokeWidth={1.8} />
          {pending ? "Publishing…" : "Publish"}
        </Button>
      </DialogFooter>
    </>
  );
}

function ResultsView({
  outcome,
  onDone,
}: {
  outcome: BulkPublishOutcome;
  onDone: () => void;
}) {
  const { succeeded, blocked, skipped } = outcome;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Publish result</DialogTitle>
        <DialogDescription>
          {succeeded.length} published · {blocked.length} blocked ·{" "}
          {skipped.length} skipped
        </DialogDescription>
      </DialogHeader>
      <div className="mt-2 flex flex-col gap-3 max-h-[40vh] overflow-y-auto">
        {succeeded.length > 0 ? (
          <ResultSection
            tone="success"
            icon={<CheckCircle2 size={13} strokeWidth={1.8} />}
            heading={`Published (${succeeded.length})`}
          >
            <p className="text-[12px] text-bz-muted">
              Live on the public marketplace now.
            </p>
          </ResultSection>
        ) : null}
        {blocked.length > 0 ? (
          <ResultSection
            tone="warn"
            icon={<AlertCircle size={13} strokeWidth={1.8} />}
            heading={`Blocked (${blocked.length})`}
          >
            <ul className="flex flex-col gap-1.5">
              {blocked.map((b) => (
                <li key={b.id} className="text-[12px]">
                  <div className="mono">{b.reference}</div>
                  <div className="text-bz-muted">
                    {b.blockers.slice(0, 2).join(" · ")}
                    {b.blockers.length > 2 ? ` · +${b.blockers.length - 2}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </ResultSection>
        ) : null}
        {skipped.length > 0 ? (
          <ResultSection
            tone="muted"
            icon={<EyeOff size={13} strokeWidth={1.8} />}
            heading={`Skipped (${skipped.length})`}
          >
            <p className="text-[12px] text-bz-muted">
              You don&apos;t have access to these rows.
            </p>
          </ResultSection>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" onClick={onDone}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}

function ResultSection({
  tone,
  icon,
  heading,
  children,
}: {
  tone: "success" | "warn" | "muted";
  icon: React.ReactNode;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4
        className={cn(
          "flex items-center gap-1.5 text-[12px] uppercase tracking-wider mb-1.5",
          tone === "success" && "text-[oklch(0.45_0.1_145)]",
          tone === "warn" && "text-[oklch(0.45_0.13_28)]",
          tone === "muted" && "text-bz-muted",
        )}
      >
        {icon}
        {heading}
      </h4>
      {children}
    </section>
  );
}
