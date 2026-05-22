"use client";

import { FileText } from "lucide-react";
import { toast } from "sonner";

/**
 * Sprint 5b (backfilled): PDF action button for the mortgage calculator.
 * The button surface is wired today; the real PDF render lands in
 * Sprint 12 via `@react-pdf/renderer`. Until then we toast a clear note.
 */
export function MortgagePdfAction({
  enabled = false,
}: {
  enabled?: boolean;
}) {
  function handle() {
    if (!enabled) {
      toast.info(
        "Branded PDF download lands in Sprint 12 (PDF renderer + cron).",
      );
      return;
    }
    // Sprint 12: navigate to the api/pdf/mortgage endpoint.
    window.location.href = "/api/pdf/mortgage";
  }

  return (
    <button
      type="button"
      onClick={handle}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[13px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
    >
      <FileText size={13} strokeWidth={1.7} />
      Download PDF
    </button>
  );
}
