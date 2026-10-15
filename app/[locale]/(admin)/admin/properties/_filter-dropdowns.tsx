"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { PROPERTY_TYPES } from "@/lib/schemas/property";

/** "hotel_apartment" → "Hotel apartment". */
export function propertyTypeLabel(type: string): string {
  const words = type.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The Type filter above the properties table. URL-state driven (`?type=`), so
 * a filtered list deep-links, and it keeps whatever status tab is open: the
 * two narrow the same list.
 */
export function PropertyTypeFilter() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const value = sp.get("type") ?? "";

  function setType(next: string) {
    const params = new URLSearchParams(sp.toString());
    if (next) params.set("type", next);
    else params.delete("type");
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `?${query}` : "?");
    });
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-[11.5px] text-bz-muted">
      Type
      <select
        value={value}
        onChange={(e) => setType(e.target.value)}
        disabled={pending}
        data-testid="property-type-filter"
        className="h-8 px-2.5 rounded border border-bz-border bg-bz-bg text-[13px] text-bz-ink outline-none focus:border-bz-accent"
      >
        <option value="">All types</option>
        {PROPERTY_TYPES.map((t) => (
          <option key={t} value={t}>
            {propertyTypeLabel(t)}
          </option>
        ))}
      </select>
    </label>
  );
}
