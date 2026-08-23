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
    /*
     * 32px circle, 44px box (WCAG 2.5.5). The paint moved to the inner
     * <span> so the box could grow without the circle growing with it — this
     * control sits on listing-card media on 6 routes and the art is fixed.
     *
     * `pointer-coarse:`, not a width breakpoint: the question is whether a
     * thumb is doing the tapping, so a touchscreen laptop gets the bigger box
     * and a narrow desktop window does not. Same test globals.css uses for the
     * primitive floor, deliberately.
     *
     * An ::after overlay with negative insets would give a thumb the same
     * 44px and cost no layout anywhere — but e2e/mobile-geometry.spec.ts
     * measures `getBoundingClientRect()` on the <button>, and that box does
     * not grow with an overflowing pseudo-element. `touchTargets` goes
     * blocking at the end of Phase 8, so a fix the gate cannot see leaves the
     * gate red on every route that renders a card.
     *
     * The growth is centred, so a call site that anchors this by its corner
     * has to pull the anchor in 6px on coarse pointers to keep the circle
     * where it was — listing-card.tsx's media overlay does exactly that. The
     * other two call sites (action-row.tsx, live-listings-rail.tsx) lay it out
     * in flow, where 44px is simply the row height on a phone.
     */
    <button
      type="button"
      onClick={toggle}
      aria-label={active ? "Remove from shortlist" : "Save to shortlist"}
      title={
        active
          ? `Remove from shortlist (${count}/${SHORTLIST_CAP})`
          : `Save to shortlist (${count}/${SHORTLIST_CAP})`
      }
      /* `rounded-full` on the outer box too, with nothing painted on it: the
         UA focus ring follows border-radius, and without it keyboard focus
         would draw a square around a circle that used to get a round one. */
      className="size-8 pointer-coarse:size-11 rounded-full flex items-center justify-center"
    >
      <span
        className={
          active
            ? "size-8 rounded-full bg-bz-accent-soft border border-bz-accent text-bz-accent flex items-center justify-center transition-colors"
            : "size-8 rounded-full bg-white/92 text-bz-ink-2 hover:text-bz-ink flex items-center justify-center transition-colors"
        }
      >
        {active ? (
          <Check size={15} strokeWidth={2} />
        ) : (
          <Scale size={15} strokeWidth={1.7} />
        )}
      </span>
    </button>
  );
}
