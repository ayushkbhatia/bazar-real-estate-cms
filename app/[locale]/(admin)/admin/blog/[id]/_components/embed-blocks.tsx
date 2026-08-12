"use client";

import { BarChart3, Home, Quote } from "lucide-react";
import { toast } from "sonner";

/**
 * Sprint 7f (backfilled): chart / listing-card / pull-quote embed
 * buttons for the Tiptap toolbar. Sprint 9 wires the real insertion
 * (custom node types that render in the public article). Today the
 * buttons toast the upcoming behaviour.
 */
export function ArticleEmbedBlocks() {
  function insert(kind: string) {
    toast.info(
      `${kind} embed activates with Sprint 9 (custom Tiptap nodes + renderer).`,
    );
  }
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-bz-border bg-bz-bg px-1 py-0.5">
      <span className="text-[10.5px] uppercase tracking-wider text-bz-muted px-2">
        Insert
      </span>
      <button
        type="button"
        onClick={() => insert("Chart")}
        title="Insert chart"
        className="w-7 h-7 rounded text-bz-ink-2 hover:bg-bz-surface flex items-center justify-center"
      >
        <BarChart3 size={13} strokeWidth={1.7} />
      </button>
      <button
        type="button"
        onClick={() => insert("Listing card")}
        title="Insert listing card"
        className="w-7 h-7 rounded text-bz-ink-2 hover:bg-bz-surface flex items-center justify-center"
      >
        <Home size={13} strokeWidth={1.7} />
      </button>
      <button
        type="button"
        onClick={() => insert("Pull quote")}
        title="Insert pull quote"
        className="w-7 h-7 rounded text-bz-ink-2 hover:bg-bz-surface flex items-center justify-center"
      >
        <Quote size={13} strokeWidth={1.7} />
      </button>
    </div>
  );
}
