"use client";

import { useState } from "react";
import { Share2, Send, Check } from "lucide-react";
import { SaveButton } from "@/components/brand/save-button";
import { CompareButton } from "@/components/brand/compare-button";

/**
 * Sprint 4c: Save / Share / Add-to-compare / Send-to-advisor action row
 * pinned above the gallery on the property detail page.
 */
export function PropertyActionRow({
  propertyId,
  reference,
  title,
  initialSaved,
  isAuthed,
}: {
  propertyId: string;
  reference: string;
  title: string;
  initialSaved: boolean;
  isAuthed: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
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

  function sendToAdvisor() {
    document
      .getElementById("send-brief")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="px-12 pt-6 flex items-center justify-between gap-4 flex-wrap">
      <div className="mono text-[11px] uppercase tracking-wider text-bz-muted">
        REF · <span className="text-bz-ink">{reference}</span>
      </div>
      <div className="flex items-center gap-2">
        <SaveButton
          propertyId={propertyId}
          initialSaved={initialSaved}
          isAuthed={isAuthed}
          // SaveButton renders absolutely-positioned by default; wrap to
          // make it sit inline here.
          className="relative top-auto right-auto"
        />
        <CompareButton propertyId={propertyId} />
        <button
          type="button"
          onClick={share}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-bz-border bg-bz-bg text-[12.5px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
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
        <button
          type="button"
          onClick={sendToAdvisor}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-bz-ink text-bz-bg text-[12.5px] hover:bg-bz-ink-2 transition-colors"
        >
          <Send size={13} strokeWidth={1.7} />
          Send to advisor
        </button>
      </div>
    </div>
  );
}
