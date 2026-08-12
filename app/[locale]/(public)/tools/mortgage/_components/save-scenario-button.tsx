"use client";

import { useState } from "react";
import { Bookmark, Check } from "lucide-react";
import { toast } from "sonner";

type Scenario = {
  priceAed: number;
  downPaymentAed: number;
  termYears: number;
  annualRatePct: number;
  mortgageType: string;
  monthlyAed: number;
  savedAt: string;
};

const STORAGE_KEY = "bz:mortgage:scenarios";

/**
 * Sprint 5b (backfilled): save the current mortgage scenario locally.
 * Sprint 9 wires this into the `mortgage_inquiries` table so saved
 * scenarios persist across devices. localStorage today.
 */
export function SaveScenarioButton({
  scenario,
}: {
  scenario: Omit<Scenario, "savedAt">;
}) {
  const [saved, setSaved] = useState(false);

  function save() {
    if (typeof window === "undefined") return;
    try {
      const existing = JSON.parse(
        window.localStorage.getItem(STORAGE_KEY) ?? "[]",
      );
      const list = Array.isArray(existing) ? existing : [];
      const entry: Scenario = { ...scenario, savedAt: new Date().toISOString() };
      // Cap at 10 scenarios; newest first.
      const next = [entry, ...list].slice(0, 10);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      toast.success(
        "Scenario saved locally. Sprint 9 syncs across devices.",
      );
    } catch {
      toast.error("Couldn't save scenario.");
    }
  }

  return (
    <button
      type="button"
      onClick={save}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[13px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
    >
      {saved ? (
        <>
          <Check size={13} strokeWidth={2} />
          Saved
        </>
      ) : (
        <>
          <Bookmark size={13} strokeWidth={1.7} />
          Save scenario
        </>
      )}
    </button>
  );
}
