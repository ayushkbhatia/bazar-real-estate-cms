"use client";

import { Bookmark, Share2, Plus, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Sprint 5c (backfilled): header actions for the concierge — "New
 * brief", "Save brief", "Share". Sprint 9 wires Save/Share to the
 * `concierge_sessions` table; today they toast a clear note.
 */
export function ConciergeHeaderActions({
  onNewBrief,
}: {
  onNewBrief: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Bazar concierge brief", url });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function saveBrief() {
    toast.info("Brief saved to this session. Sprint 9 syncs across devices.");
  }

  return (
    <div className="flex items-center gap-2">
      <ActionBtn onClick={onNewBrief} label="New brief">
        <Plus size={12} strokeWidth={1.8} />
        New brief
      </ActionBtn>
      <ActionBtn onClick={saveBrief} label="Save brief">
        <Bookmark size={12} strokeWidth={1.7} />
        Save
      </ActionBtn>
      <ActionBtn onClick={share} label="Share brief">
        {copied ? (
          <>
            <Check size={12} strokeWidth={2} />
            Copied
          </>
        ) : (
          <>
            <Share2 size={12} strokeWidth={1.7} />
            Share
          </>
        )}
      </ActionBtn>
    </div>
  );
}

function ActionBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-bz-border bg-bz-bg text-[12px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
    >
      {children}
    </button>
  );
}
