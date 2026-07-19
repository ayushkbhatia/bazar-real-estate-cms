"use client";

import { useState } from "react";
import { Share2, Bookmark, Send, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * Sprint 5d (backfilled): share / save / send-to-advisor button row in
 * the article byline strip.
 */
export function ArticleActions({ title }: { title: string }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
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

  function send() {
    toast.info(
      "Send-to-advisor activates with the lead-engine workflow in Sprint 10.",
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Btn onClick={share} label="Share">
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
      </Btn>
      <Btn
        onClick={() => setSaved((v) => !v)}
        label={saved ? "Saved" : "Save"}
        pressed={saved}
      >
        <Bookmark
          size={12}
          strokeWidth={1.7}
          fill={saved ? "currentColor" : "none"}
        />
        {saved ? "Saved" : "Save"}
      </Btn>
      <Btn onClick={send} label="Send to advisor">
        <Send size={12} strokeWidth={1.7} />
        Send to advisor
      </Btn>
    </div>
  );
}

function Btn({
  onClick,
  label,
  pressed,
  children,
}: {
  onClick: () => void;
  label: string;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className={
        pressed
          ? "inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-bz-accent-soft border border-bz-accent text-bz-accent text-[12px]"
          : "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-bz-border bg-bz-bg text-[12px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
      }
    >
      {children}
    </button>
  );
}
