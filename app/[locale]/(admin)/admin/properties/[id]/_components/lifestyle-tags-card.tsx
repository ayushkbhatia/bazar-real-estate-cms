"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Eyebrow } from "@/components/brand/eyebrow";
import type { LifestyleTag } from "@/lib/lifestyle-tags";
import { LifestyleTagPicker } from "../../_lifestyle-tag-picker";
import { setPropertyLifestyleTags } from "../_actions";

/**
 * "Lifestyle tags" on the property edit screen — Waterfront, Family friendly,
 * Luxury, Gated, Branded residences. Saves as you tick, optimistic with a
 * revert, like `CardLabelsCard` above it.
 */
export function LifestyleTagsCard({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: LifestyleTag[];
}) {
  const [value, setValue] = useState<LifestyleTag[]>(initial);
  const [pending, start] = useTransition();

  function onChange(next: LifestyleTag[]) {
    const previous = value;
    setValue(next);
    start(async () => {
      const res = await setPropertyLifestyleTags(propertyId, next);
      if (res.status === "error") {
        setValue(previous);
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="rounded-md border border-bz-border bg-bz-surface p-4">
      <Eyebrow>Lifestyle tags</Eyebrow>
      <p className="mt-2 mb-3 text-[12px] text-bz-muted leading-snug">
        How this listing is classified for search. Not drawn on the card. Saves
        as you tick.
      </p>
      <LifestyleTagPicker value={value} onChange={onChange} disabled={pending} />
    </div>
  );
}
