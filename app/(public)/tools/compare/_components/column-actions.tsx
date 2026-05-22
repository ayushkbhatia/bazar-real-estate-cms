"use client";

import { Send, Calendar } from "lucide-react";
import { toast } from "sonner";

/**
 * Sprint 5b (backfilled): per-column action buttons (Book viewing, Send
 * brief) on the compare page. Sprint 9 wires actions to the viewing /
 * enquiry server actions.
 */
export function ColumnActions({
  propertyReference,
  propertyTitle,
}: {
  propertyReference: string;
  propertyTitle: string;
}) {
  function bookViewing() {
    toast.info(
      `Viewing request queued for ${propertyReference}. Sprint 9 routes it to an advisor.`,
    );
  }

  function sendBrief() {
    toast.info(
      `Brief queued for ${propertyTitle}. Sprint 9 wires send.`,
    );
  }

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      <button
        type="button"
        onClick={bookViewing}
        className="inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-bz-ink text-bz-bg text-[12px] hover:bg-bz-ink-2 transition-colors"
      >
        <Calendar size={12} strokeWidth={1.7} />
        Book viewing
      </button>
      <button
        type="button"
        onClick={sendBrief}
        className="inline-flex items-center justify-center gap-1.5 h-8 rounded-md border border-bz-border bg-bz-bg text-bz-ink-2 text-[12px] hover:border-bz-border-strong transition-colors"
      >
        <Send size={12} strokeWidth={1.7} />
        Send brief
      </button>
    </div>
  );
}
