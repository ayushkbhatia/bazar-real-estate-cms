"use client";

import { useEffect, useState } from "react";
import { Scale, Check } from "lucide-react";
import {
  COMPARE_STORAGE_KEY,
  SHORTLIST_CAP,
  loadCompareIds,
  saveCompareIds,
} from "@/lib/compare-store";

/**
 * Sprint 4b: shortlist button rendered on every listing card. Stores the
 * saved set in localStorage so the visitor can build it up across pages,
 * then works through it in the shortlist drawer — where they pick which
 * ones go to /tools/compare?ids=… side-by-side.
 *
 * Bounded by `SHORTLIST_CAP`, not `COMPARE_CAP`: this button saves, it
 * doesn't fill compare slots. It used to enforce the compare limit of 4,
 * which made a fifth save silently evict the first.
 *
 * No server state — Sprint 8 adds a `comparisons` table; Sprint 9 syncs
 * the localStorage set into it for cross-device persistence.
 */
export function CompareButton({ propertyId }: { propertyId: string }) {
  const [active, setActive] = useState(false);
  const [count, setCount] = useState(0);

  // Subscribe to localStorage changes. The compare set lives in browser
  // storage (Sprint 8 adds a `comparisons` table for cross-device sync).
  // We deliberately don't call setState inside the effect body — the
  // initial hydration runs via the storage event we dispatch from
  // saveCompareIds().
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== COMPARE_STORAGE_KEY) return;
      const next = loadCompareIds();
      setActive(next.includes(propertyId));
      setCount(next.length);
    }
    // Hydrate once on mount by dispatching a fake event (no-op if no
    // existing ids).
    if (typeof window !== "undefined") {
      const existing = loadCompareIds();
      if (existing.length > 0) {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: COMPARE_STORAGE_KEY,
            newValue: JSON.stringify(existing),
          }),
        );
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [propertyId]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ids = loadCompareIds();
    let next: string[];
    if (ids.includes(propertyId)) {
      next = ids.filter((id) => id !== propertyId);
    } else {
      if (ids.length >= SHORTLIST_CAP) {
        // Replace the oldest to respect cap.
        next = [...ids.slice(1), propertyId];
      } else {
        next = [...ids, propertyId];
      }
    }
    saveCompareIds(next);
    setActive(next.includes(propertyId));
    setCount(next.length);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={active ? "Remove from shortlist" : "Save to shortlist"}
      title={
        active
          ? `Remove from shortlist (${count}/${SHORTLIST_CAP})`
          : `Save to shortlist (${count}/${SHORTLIST_CAP})`
      }
      className={
        active
          ? "w-8 h-8 rounded-full bg-bz-accent-soft border border-bz-accent text-bz-accent flex items-center justify-center transition-colors"
          : "w-8 h-8 rounded-full bg-white/92 text-bz-ink-2 hover:text-bz-ink flex items-center justify-center transition-colors"
      }
    >
      {active ? (
        <Check size={15} strokeWidth={2} />
      ) : (
        <Scale size={15} strokeWidth={1.7} />
      )}
    </button>
  );
}
