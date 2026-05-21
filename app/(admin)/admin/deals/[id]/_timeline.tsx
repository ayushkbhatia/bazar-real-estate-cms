"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  nextStage,
  type DealStage,
} from "@/lib/deals";
import { advanceDealStage } from "./_actions";

type StageStamps = Partial<Record<DealStage, string | null>>;

export type StageGatePreview = {
  next: DealStage | null;
  canAdvance: boolean;
  blockers: string[];
};

type Props = {
  dealId: string;
  stage: DealStage;
  stamps: StageStamps;
  /**
   * Server-side preview of whether the next stage can be reached. When
   * !canAdvance the Advance button surfaces the blocker before the
   * dialog opens, so the staff member knows what to fix.
   */
  gatePreview?: StageGatePreview;
};

function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function StageTimeline({
  dealId,
  stage,
  stamps,
  gatePreview,
}: Props) {
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTo, setConfirmTo] = useState<DealStage | null>(null);
  const [blockers, setBlockers] = useState<string[] | null>(
    gatePreview && gatePreview.blockers.length > 0
      ? gatePreview.blockers
      : null,
  );

  const currentIdx = DEAL_STAGES.indexOf(stage);
  const next = nextStage(stage);
  const previewBlockers =
    gatePreview && !gatePreview.canAdvance ? gatePreview.blockers : null;

  function tryAdvance(to: DealStage) {
    setBlockers(previewBlockers);
    setConfirmTo(to);
    setConfirmOpen(true);
  }

  function onConfirm() {
    if (!confirmTo) return;
    start(async () => {
      const r = await advanceDealStage({ dealId, to: confirmTo });
      if (r.status === "error") {
        setBlockers(r.blockers ?? null);
        toast.error(r.message);
        return;
      }
      toast.success(`Advanced to ${DEAL_STAGE_LABELS[r.stage]}.`);
      setConfirmOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {DEAL_STAGES.map((s, i) => {
          const past = i < currentIdx;
          const isCurrent = i === currentIdx;
          const stamp = stamps[s];
          return (
            <li key={s} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full border text-[10px] font-medium",
                  past
                    ? "bg-bz-accent text-bz-bg border-bz-accent"
                    : isCurrent
                      ? "bg-bz-ink text-bz-bg border-bz-ink"
                      : "bg-bz-surface text-bz-muted border-bz-border",
                )}
              >
                {past ? <Check size={11} strokeWidth={2.4} /> : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "text-[13.5px] font-medium",
                    isCurrent ? "text-bz-ink" : "text-bz-ink-2",
                  )}
                >
                  {DEAL_STAGE_LABELS[s]}
                </div>
                {stamp ? (
                  <div className="text-[11.5px] text-bz-muted">
                    {formatStamp(stamp)}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {next ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => tryAdvance(next)}
            className="self-start"
          >
            <ArrowRight size={13} strokeWidth={1.8} />
            Advance to {DEAL_STAGE_LABELS[next]}
          </Button>
          {previewBlockers && previewBlockers.length > 0 ? (
            <div className="rounded border border-[oklch(0.85_0.12_60)] bg-[oklch(0.97_0.04_60)] p-2.5">
              <div className="text-[11px] uppercase tracking-widest text-[oklch(0.4_0.15_60)] font-medium">
                Missing
              </div>
              <ul className="mt-1 text-[12px] text-[oklch(0.35_0.15_60)] list-disc pl-4 space-y-0.5">
                {previewBlockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-[12px] text-bz-muted px-1">
          Deal is closed.
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Advance to {confirmTo ? DEAL_STAGE_LABELS[confirmTo] : ""}?
            </DialogTitle>
            <DialogDescription>
              This stamps the new stage on the deal record and logs an
              audit entry. The buyer + lead agent will be emailed in G8.
            </DialogDescription>
          </DialogHeader>
          {blockers && blockers.length > 0 ? (
            <div className="rounded border border-[oklch(0.85_0.12_28)] bg-[oklch(0.97_0.04_28)] p-3">
              <div className="text-[12px] font-medium text-[oklch(0.4_0.15_28)] mb-1.5">
                Blocked
              </div>
              <ul className="text-[12.5px] text-[oklch(0.35_0.15_28)] list-disc pl-4 space-y-1">
                {blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onConfirm} disabled={pending}>
              {pending ? "Advancing…" : "Advance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
