import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

/**
 * Sprint 7e: 60-minute escalation banner on the enquiry detail page.
 *
 * Shows when an enquiry is unassigned OR has had no first response and was
 * created more than 60 minutes ago. Sprint 10 wires a cron that auto-
 * reassigns past the threshold — this banner makes the escalated state
 * visible to staff immediately.
 */
export function EscalationBanner({
  createdAt,
  firstResponseAt,
  assignedAgentId,
  status,
  nowMs,
}: {
  createdAt: string;
  firstResponseAt: string | null;
  assignedAgentId: string | null;
  status: string;
  /** Server-passed timestamp keeps Date.now() out of the render body. */
  nowMs: number;
}) {
  // Terminal statuses don't need escalation surfacing.
  if (status === "closed_won" || status === "closed_lost") return null;

  const ageMs = nowMs - new Date(createdAt).getTime();
  const ageMin = Math.floor(ageMs / 60_000);

  if (firstResponseAt && assignedAgentId) return null;
  if (ageMin < 60) return null;

  const overdueMin = ageMin - 60;
  const reason = !assignedAgentId
    ? "Unassigned"
    : !firstResponseAt
      ? "Awaiting first response"
      : "Action required";

  return (
    <div className="rounded-lg border border-bz-danger/40 bg-[oklch(0.97_0.03_28)] text-[oklch(0.4_0.15_28)] p-4 flex items-start gap-3">
      <AlertTriangle
        size={16}
        strokeWidth={2}
        className="mt-0.5 flex-shrink-0"
      />
      <div className="flex-1">
        <div className="text-[13px] font-medium flex items-center gap-2">
          {reason} · escalated
          <span className="inline-flex items-center gap-1 mono text-[11px] bg-[oklch(0.92_0.06_28)] px-1.5 py-0.5 rounded">
            <Clock size={10} strokeWidth={2} />
            +{overdueMin}m past 60-min SLA
          </span>
        </div>
        <p className="text-[12.5px] mt-1 leading-relaxed">
          {!assignedAgentId
            ? "Assign to an advisor immediately, or use the bulk-reassign tool on the inbox."
            : "Send a reply or a holding message — the lead has been waiting."}
          {" "}
          <Link
            href="/admin/settings/routing"
            className="underline underline-offset-2"
          >
            Routing rules
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
