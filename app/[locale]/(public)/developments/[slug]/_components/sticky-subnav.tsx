"use client";

import { useState } from "react";
import { Heart, Share2, Check } from "lucide-react";

/**
 * Sprint 5a (backfilled): Save + Share controls for the development
 * sticky sub-nav. Drop on the right side of the existing anchor strip.
 */
export function StickySubnavActions({
  developmentName,
}: {
  developmentName: string;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: developmentName, url });
        return;
      } catch {
        /* fall through to clipboard */
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

  return (
    <div className="ms-auto flex items-center gap-2">
      <button
        type="button"
        onClick={() => setSaved((v) => !v)}
        aria-pressed={saved}
        className={
          saved
            ? "inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-bz-accent-soft border border-bz-accent text-bz-accent text-[12.5px]"
            : "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-bz-border text-bz-ink-2 text-[12.5px] hover:border-bz-border-strong"
        }
      >
        <Heart
          size={13}
          strokeWidth={1.7}
          fill={saved ? "currentColor" : "none"}
        />
        {saved ? "Saved" : "Save"}
      </button>
      <button
        type="button"
        onClick={share}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-bz-border text-bz-ink-2 text-[12.5px] hover:border-bz-border-strong transition-colors"
      >
        {copied ? (
          <>
            <Check size={13} strokeWidth={2} />
            Copied
          </>
        ) : (
          <>
            <Share2 size={13} strokeWidth={1.7} />
            Share
          </>
        )}
      </button>
    </div>
  );
}
