"use client";

import { useState, useTransition } from "react";
import { Archive, Mail, Save, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  archiveValuationRequest,
  claimValuationRequest,
  saveAdvisorDraft,
  sendValuationReport,
} from "../_actions";

type Props = {
  id: string;
  status: "pending" | "in_review" | "sent" | "archived";
  advisorDisplayName: string | null;
  initialAdvisorEstimateAed: number | null;
  initialAdvisorNotes: string;
  sentAt: string | null;
};

export function ValuationReviewForm({
  id,
  status,
  advisorDisplayName,
  initialAdvisorEstimateAed,
  initialAdvisorNotes,
  sentAt,
}: Props) {
  const [estimate, setEstimate] = useState<string>(
    initialAdvisorEstimateAed?.toString() ?? "",
  );
  const [notes, setNotes] = useState<string>(initialAdvisorNotes);
  const [pending, startTransition] = useTransition();

  const advisorEstimateAedNum = (): number | null => {
    const cleaned = estimate.replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  const onClaim = () => {
    startTransition(async () => {
      const r = await claimValuationRequest({ id });
      if (r.status === "ok") toast.success("Claimed. You're the reviewer.");
      else toast.error(r.message);
    });
  };

  const onSave = () => {
    startTransition(async () => {
      const r = await saveAdvisorDraft({
        id,
        advisor_estimate_aed: advisorEstimateAedNum(),
        advisor_notes: notes.trim() || null,
      });
      if (r.status === "ok") toast.success("Draft saved.");
      else toast.error(r.message);
    });
  };

  const onSend = () => {
    const final = advisorEstimateAedNum();
    if (!final) {
      toast.error("Enter a final number before sending.");
      return;
    }
    startTransition(async () => {
      const r = await sendValuationReport({
        id,
        advisor_estimate_aed: final,
        advisor_notes: notes.trim() || null,
      });
      if (r.status === "ok") toast.success("Report sent.");
      else toast.error(r.message);
    });
  };

  const onArchive = () => {
    startTransition(async () => {
      const r = await archiveValuationRequest({ id });
      if (r.status === "ok") toast.success("Archived.");
      else toast.error(r.message);
    });
  };

  const isClosed = status === "sent" || status === "archived";

  return (
    <div>
      <Eyebrow>Advisor review</Eyebrow>
      <div className="flex items-center justify-between mt-1">
        <h2
          className="serif text-[22px]"
          style={{ letterSpacing: "-0.01em" }}
        >
          {status === "pending"
            ? "Claim & refine"
            : status === "in_review"
              ? "Refine & send"
              : status === "sent"
                ? "Sent"
                : "Archived"}
        </h2>
        <StatusPill status={status} />
      </div>

      {advisorDisplayName ? (
        <p className="text-[12.5px] text-bz-muted mt-1">
          Assigned to{" "}
          <span className="text-bz-ink-2">{advisorDisplayName}</span>
        </p>
      ) : null}

      {sentAt ? (
        <p className="text-[12.5px] text-bz-success mt-2">
          Report sent {new Date(sentAt).toLocaleString()}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-4">
        {status === "pending" ? (
          <Button
            onClick={onClaim}
            disabled={pending}
            data-testid="claim-button"
          >
            <UserCheck size={14} strokeWidth={1.6} />
            Claim & start review
          </Button>
        ) : null}

        <fieldset>
          <Label htmlFor="estimate">Final estimate · AED</Label>
          <Input
            id="estimate"
            inputMode="numeric"
            className="mt-1.5 mono"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            placeholder="e.g. 4,350,000"
            disabled={isClosed || pending}
            data-testid="advisor-estimate"
          />
        </fieldset>

        <fieldset>
          <Label htmlFor="notes">Notes for the owner (optional)</Label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            disabled={isClosed || pending}
            placeholder="Briefly explain how you priced it and what would change the number."
            className={cn(
              "mt-1.5 w-full border border-bz-border rounded p-2 text-[13.5px] bg-bz-surface focus:border-bz-ink-2 outline-none resize-y",
              isClosed && "opacity-60",
            )}
            data-testid="advisor-notes"
          />
        </fieldset>

        {!isClosed ? (
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={onSave}
              disabled={pending}
              data-testid="save-draft-button"
            >
              <Save size={14} strokeWidth={1.6} />
              Save draft
            </Button>
            <Button
              onClick={onSend}
              disabled={pending}
              data-testid="send-report-button"
            >
              <Mail size={14} strokeWidth={1.6} />
              Send report to owner
            </Button>
            <Button
              variant="ghost"
              onClick={onArchive}
              disabled={pending}
              className="text-bz-muted hover:text-bz-ink"
            >
              <Archive size={14} strokeWidth={1.6} />
              Archive
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Props["status"] }) {
  const styles: Record<Props["status"], string> = {
    pending: "bg-[oklch(0.96_0.05_240)] text-[oklch(0.45_0.1_240)]",
    in_review: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
    sent: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
    archived: "bg-bz-surface-2 text-bz-muted",
  };
  const labels: Record<Props["status"], string> = {
    pending: "Pending",
    in_review: "In review",
    sent: "Sent",
    archived: "Archived",
  };
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-[11px] uppercase tracking-wider",
        styles[status],
      )}
    >
      {labels[status]}
    </span>
  );
}
