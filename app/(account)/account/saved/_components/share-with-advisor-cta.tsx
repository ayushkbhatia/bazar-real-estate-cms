"use client";

import { useState } from "react";
import { Send, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * Sprint 6 (backfilled): "Share with advisor" CTA on /account/saved.
 * Bundles the current saved set into a message + sends to the
 * assigned advisor (Sprint 10 wires the lead-engine route). Today the
 * button copies a sharable URL so the user can paste into WhatsApp.
 */
export function ShareWithAdvisorCta({
  savedCount,
}: {
  savedCount: number;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (savedCount === 0) {
      toast.info("Save a few listings first.");
      return;
    }
    const text = `Hi Bazar — I've saved ${savedCount} properties. Could we book a call to review?`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Bazar saved list", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Message copied.");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-bz-ink text-bz-bg text-[13px] font-medium hover:bg-bz-ink-2 transition-colors"
    >
      {copied ? (
        <>
          <Check size={13} strokeWidth={2} />
          Copied
        </>
      ) : (
        <>
          <Send size={13} strokeWidth={1.7} />
          Share with advisor
        </>
      )}
    </button>
  );
}
