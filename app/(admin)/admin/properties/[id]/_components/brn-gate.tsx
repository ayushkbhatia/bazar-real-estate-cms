import { Eyebrow } from "@/components/brand/eyebrow";
import { AlertTriangle, ShieldCheck } from "lucide-react";

/**
 * Sprint 7c (backfilled): BRN gate on the publish card. Blocks publish
 * if the assigned agent has no BRN on file OR if a Sprint 10 expiry
 * cron has flagged it as expired. Today the gate checks for presence;
 * Sprint 10 wires the expiry status via the `licenses` table.
 */
export function BrnGate({
  agentName,
  agentBrn,
  isAssigned,
  isExpired = false,
}: {
  agentName: string | null;
  agentBrn: string | null;
  isAssigned: boolean;
  isExpired?: boolean;
}) {
  if (!isAssigned) {
    return (
      <div className="rounded-md border border-bz-danger/40 bg-red-50 text-bz-danger px-4 py-3 text-[12.5px] flex items-start gap-2.5">
        <AlertTriangle size={14} strokeWidth={1.8} className="flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">No agent assigned</div>
          <div className="mt-0.5 opacity-80">
            Assign an active agent before publishing.
          </div>
        </div>
      </div>
    );
  }
  if (!agentBrn) {
    return (
      <div className="rounded-md border border-bz-danger/40 bg-red-50 text-bz-danger px-4 py-3 text-[12.5px] flex items-start gap-2.5">
        <AlertTriangle size={14} strokeWidth={1.8} className="flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">
            {agentName} has no BRN on file
          </div>
          <div className="mt-0.5 opacity-80">
            Add a BRN on the advisor profile before publishing. RERA
            requires a valid BRN on every listing.
          </div>
        </div>
      </div>
    );
  }
  if (isExpired) {
    return (
      <div className="rounded-md border border-bz-warning/40 bg-yellow-50 text-yellow-900 px-4 py-3 text-[12.5px] flex items-start gap-2.5">
        <AlertTriangle size={14} strokeWidth={1.8} className="flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">
            {agentName}&apos;s BRN expired
          </div>
          <div className="mt-0.5 opacity-80 mono">{agentBrn}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-bz-accent/30 bg-bz-accent-soft text-bz-accent px-4 py-3 text-[12.5px] flex items-start gap-2.5">
      <ShieldCheck size={14} strokeWidth={1.8} className="flex-shrink-0 mt-0.5" />
      <div>
        <Eyebrow className="text-bz-accent">Publish gate</Eyebrow>
        <div className="font-medium mt-1">
          {agentName}&apos;s BRN on file
        </div>
        <div className="mt-0.5 opacity-80 mono">{agentBrn}</div>
      </div>
    </div>
  );
}
