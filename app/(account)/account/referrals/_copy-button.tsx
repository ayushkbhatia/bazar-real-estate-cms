"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({
  text,
  label = "Copy link",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browser — fall through silently.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-bz-ink text-bz-bg text-[13px] font-medium hover:bg-bz-ink-2 transition-colors"
    >
      {copied ? (
        <>
          <Check size={13} strokeWidth={2} />
          Copied
        </>
      ) : (
        <>
          <Copy size={13} strokeWidth={1.8} />
          {label}
        </>
      )}
    </button>
  );
}
