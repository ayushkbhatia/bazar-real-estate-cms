"use client";

import { Plus } from "lucide-react";

const KINDS = [
  { code: "hero", label: "Hero" },
  { code: "strip", label: "Strip" },
  { code: "split", label: "Split" },
  { code: "grid", label: "Grid" },
  { code: "banner", label: "Banner" },
  { code: "mosaic", label: "Mosaic" },
  { code: "embed", label: "Embed" },
] as const;

/**
 * Sprint 7g (backfilled): wide dashed "Add block" CTA at the bottom of
 * the pages editor block list. Replaces the older inline-add menu with
 * the spec's full-width affordance.
 */
export function BlockAddCta({
  onAdd,
}: {
  onAdd: (kind: string) => void;
}) {
  return (
    <div className="mt-3 rounded-lg border-2 border-dashed border-bz-border bg-bz-bg p-3">
      <div className="text-center text-[12.5px] text-bz-muted mb-2 inline-flex items-center gap-1.5 w-full justify-center">
        <Plus size={12} strokeWidth={1.7} />
        Add block
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.code}
            type="button"
            onClick={() => onAdd(k.code)}
            className="inline-flex items-center h-7 px-3 rounded-full bg-bz-bg border border-bz-border text-[11.5px] text-bz-ink-2 hover:border-bz-ink hover:text-bz-ink transition-colors"
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
