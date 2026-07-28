"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Send,
  ArrowDownToLine,
} from "lucide-react";
import { toast } from "sonner";
import {
  evaluatePublishability,
  type PublishabilityInput,
} from "@/lib/publishability";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { publishProperty, unpublishProperty } from "./_actions";

/** Everything the pre-flight gate needs. Fed from the server-rendered
 *  property row, so it re-reads on every `router.refresh()`. */
export type PublishInput = Omit<PublishabilityInput, "now">;

type Status =
  | "draft"
  | "in_review"
  | "published"
  | "off_market"
  | "archived";

type Props = {
  propertyId: string;
  status: Status;
  input: PublishInput;
};

const STATUS_LABELS: Record<Status, string> = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
  off_market: "Off-market",
  archived: "Archived",
};

const STATUS_STYLES: Record<Status, string> = {
  draft: "bg-bz-surface-2 text-bz-ink-2",
  in_review: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  published: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  off_market: "bg-bz-surface-3 text-bz-muted",
  archived: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
};

export function PublishCard({ propertyId, status, input }: Props) {
  const router = useRouter();
  const [publishing, startPublishing] = useTransition();

  const { checks, ok: publishable } = useMemo(
    () => evaluatePublishability(input),
    [input],
  );

  const permitCheckFailing = checks.some(
    (c) => !c.passed && c.label.toLowerCase().includes("permit"),
  );
  const developerCheckFailing = checks.some(
    (c) => !c.passed && c.label.toLowerCase().includes("developer"),
  );

  function onPublish() {
    startPublishing(async () => {
      const result = await publishProperty(propertyId);
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
      } else if (result.status === "blocked") {
        toast.error(
          `${result.message} — ${result.blockers.length} check(s) failing.`,
        );
      } else {
        toast.error(result.message);
      }
    });
  }

  function onUnpublish() {
    startPublishing(async () => {
      const result = await unpublishProperty(propertyId);
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-medium">Publish</h3>
        <span
          className={cn(
            "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
            STATUS_STYLES[status],
          )}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <section>
        <div className="text-[12px] text-bz-muted uppercase tracking-wider mb-2">
          Pre-flight
        </div>
        <ul className="flex flex-col gap-1">
          {checks.map((check) => (
            <li
              key={check.label}
              className={cn(
                "flex items-center gap-2 text-[13px]",
                check.passed ? "text-bz-ink" : "text-bz-muted",
              )}
            >
              {check.passed ? (
                <CheckCircle2
                  size={14}
                  strokeWidth={1.8}
                  className="text-[oklch(0.55_0.12_145)]"
                />
              ) : (
                <Circle
                  size={14}
                  strokeWidth={1.8}
                  className="text-bz-muted-2"
                />
              )}
              {check.label}
            </li>
          ))}
        </ul>
        {developerCheckFailing ? (
          <p className="mt-2 text-[11.5px] text-bz-muted">
            Pick a developer in the{" "}
            <span className="text-bz-ink-2">Overview</span> tab — it saves as
            soon as you choose one.
          </p>
        ) : null}
        {permitCheckFailing ? (
          <p className="mt-2 text-[11.5px] text-bz-muted">
            Set the listing permit number and a future expiry date in the{" "}
            <span className="text-bz-ink-2">Details</span> tab, then Save.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2.5 pt-1 border-t border-bz-border">
        {status === "published" ? (
          <Button
            type="button"
            variant="outline"
            disabled={publishing}
            onClick={onUnpublish}
          >
            <ArrowDownToLine size={14} strokeWidth={1.8} />
            {publishing ? "Working…" : "Move off-market"}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              disabled={!publishable || publishing}
              onClick={onPublish}
              title={
                publishable
                  ? "Publish to the public marketplace"
                  : "Resolve the pre-flight checks first"
              }
            >
              <Send size={14} strokeWidth={1.8} />
              {publishing ? "Publishing…" : "Publish"}
            </Button>
            {!publishable ? (
              <p className="flex items-start gap-1.5 text-[12px] text-bz-muted">
                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                Resolve every pre-flight check above before publishing.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
