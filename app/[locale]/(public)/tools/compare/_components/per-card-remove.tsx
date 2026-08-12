"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

/**
 * Sprint 5b (backfilled): × button on each compare column card.
 * Removes the column from the `?ids=` querystring and pushes the new URL.
 *
 * Coexists with the existing toolbar dropdown — the card-level × is the
 * design-preferred affordance and lives at top-right of each column.
 */
export function PerCardRemove({
  propertyId,
}: {
  propertyId: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ids = (sp.getAll("ids") ?? []).concat(
      (sp.get("ids") ?? "").split(",").filter(Boolean),
    );
    const cleaned = Array.from(new Set(ids)).filter((id) => id !== propertyId);
    const next = new URLSearchParams();
    if (cleaned.length > 0) next.set("ids", cleaned.join(","));
    const diff = sp.get("diff");
    if (diff) next.set("diff", diff);
    const qs = next.toString();
    router.push(qs ? `?${qs}` : window.location.pathname);
  }

  return (
    <button
      type="button"
      onClick={remove}
      aria-label="Remove from comparison"
      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/85 text-bz-ink-2 hover:bg-white hover:text-bz-ink flex items-center justify-center transition-colors z-10"
    >
      <X size={13} strokeWidth={1.8} />
    </button>
  );
}
