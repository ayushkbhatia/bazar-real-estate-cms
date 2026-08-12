"use client";

import { useState, useTransition } from "react";
import { UserRoundCog } from "lucide-react";
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
import { bulkReassignProperties } from "./_bulk-actions";

export type AgentOption = {
  user_id: string;
  display_name: string;
  title: string | null;
};

const PREVIEW_LIMIT = 5;

type Props = {
  ids: string[];
  references: Map<string, string>;
  agents: AgentOption[];
  /** Called with ids that should remain selected after the action. We
   *  return the *skipped* ids only — succeeded ones can be dropped. */
  onComplete: (remainingIds: string[]) => void;
};

const NONE = "__none__";

export function BulkReassignDialog({
  ids,
  references,
  agents,
  onComplete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [agentId, setAgentId] = useState<string>("");

  const previewRefs = ids
    .slice(0, PREVIEW_LIMIT)
    .map((id) => references.get(id) ?? id.slice(0, 12));
  const remainder = Math.max(0, ids.length - PREVIEW_LIMIT);

  function onConfirm() {
    if (!agentId) {
      toast.error("Pick an agent (or 'No agent') before confirming.");
      return;
    }
    const assignedAgentId = agentId === NONE ? null : agentId;
    startTransition(async () => {
      const result = await bulkReassignProperties(ids, assignedAgentId);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      onComplete(result.skipped.map((s) => s.id));
      const okN = result.succeeded.length;
      const skippedN = result.skipped.length;
      if (okN === 0) {
        toast.warning(`No rows reassigned (${skippedN} skipped).`);
      } else if (skippedN === 0) {
        toast.success(
          `Reassigned ${okN} ${okN === 1 ? "property" : "properties"}.`,
        );
      } else {
        toast.warning(`Reassigned ${okN}; ${skippedN} skipped.`);
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
          data-action="reassign"
          disabled={ids.length === 0}
        >
          <UserRoundCog size={12} strokeWidth={1.8} />
          Reassign agent
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Reassign {ids.length} {ids.length === 1 ? "property" : "properties"}
          </DialogTitle>
          <DialogDescription>
            The selected listings will all be assigned to the chosen advisor.
            Pick &quot;No agent&quot; to clear the assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="text-[12px] text-bz-muted">Assign to</label>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="h-9 w-full rounded border border-bz-border bg-bz-bg px-2 text-[13px]"
            aria-label="Pick an agent"
          >
            <option value="" disabled>
              Pick an agent
            </option>
            <option value={NONE}>— No agent —</option>
            {agents.map((a) => (
              <option key={a.user_id} value={a.user_id}>
                {a.display_name}
                {a.title ? ` · ${a.title}` : ""}
              </option>
            ))}
          </select>

          <div>
            <div className="text-[12px] text-bz-muted uppercase tracking-wider mb-1">
              Affected
            </div>
            <ul className="flex flex-col gap-1 text-[13px]">
              {previewRefs.map((ref) => (
                <li key={ref} className="mono text-bz-ink-2">
                  {ref}
                </li>
              ))}
              {remainder > 0 ? (
                <li className="text-[12px] text-bz-muted">+{remainder} more</li>
              ) : null}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={pending || !agentId}
          >
            <UserRoundCog size={12} strokeWidth={1.8} />
            {pending ? "Reassigning…" : "Reassign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
