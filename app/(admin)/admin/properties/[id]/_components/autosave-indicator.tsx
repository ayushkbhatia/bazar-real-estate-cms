"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff, Check } from "lucide-react";

type State = "idle" | "saving" | "saved" | "error";

/**
 * Sprint 7c (backfilled): autosave indicator pill in the property
 * editor topbar. Driven by a `state` prop the form sets when a debounced
 * server action fires.
 */
export function AutosaveIndicator({
  state,
  lastSavedAtMs,
}: {
  state: State;
  /** ms timestamp of the last successful save. Server-passed to avoid render-time Date.now(). */
  lastSavedAtMs?: number;
}) {
  // Local clock for "saved N min ago" copy. Ticks every 30s.
  const [now, setNow] = useState(() => lastSavedAtMs ?? 0);
  useEffect(() => {
    if (!lastSavedAtMs) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [lastSavedAtMs]);

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
  if (state === "saved" && lastSavedAtMs) {
    // `now` is the React state we tick every 30s — keeps Date.now() out
    // of the render body so the React Compiler doesn't flag it.
    const baseline = now > 0 ? now : lastSavedAtMs;
    const ago = Math.max(0, Math.floor((baseline - lastSavedAtMs) / 60_000));
    const label = ago < 1 ? "just now" : `${ago} min ago`;
    return (
      <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded text-[11.5px] text-bz-accent bg-bz-accent-soft">
        <Check size={12} strokeWidth={1.8} />
        Saved {label}
        <span className="hidden">{now}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded text-[11.5px] text-bz-muted bg-bz-surface">
      <Cloud size={12} strokeWidth={1.7} />
      Autosave on (30s)
    </span>
  );
}
