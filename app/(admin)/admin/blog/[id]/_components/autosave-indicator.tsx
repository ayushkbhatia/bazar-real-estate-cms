"use client";

import { Cloud, CloudOff, Check } from "lucide-react";

/**
 * Sprint 7f (backfilled): autosave indicator pill for the blog editor.
 * Mirrors the property-edit autosave indicator pattern.
 */
export function BlogAutosaveIndicator({
  state,
}: {
  state: "idle" | "saving" | "saved" | "error";
}) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded text-[11.5px] text-bz-muted bg-bz-surface">
        <Cloud size={12} strokeWidth={1.7} className="animate-pulse" />
        Saving…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded text-[11.5px] text-bz-danger bg-red-50">
        <CloudOff size={12} strokeWidth={1.7} />
        Save failed
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded text-[11.5px] text-bz-accent bg-bz-accent-soft">
        <Check size={12} strokeWidth={1.8} />
        Draft saved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded text-[11.5px] text-bz-muted bg-bz-surface">
      <Cloud size={12} strokeWidth={1.7} />
      Autosave on (15s)
    </span>
  );
}
