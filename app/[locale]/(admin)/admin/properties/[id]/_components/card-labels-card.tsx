"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Eyebrow } from "@/components/brand/eyebrow";
import { CardLabelPicker } from "@/components/brand/card-label-picker";
import type { CardLabel } from "@/lib/card-labels";
import { setPropertyCardLabels } from "../_actions";

/**
 * "Card labels" on the property edit screen.
 *
 * Saves on its own rather than as part of the form submit, exactly like
 * `FloorPlanCard` and `LocationPicker` beside it, and for the same shape of
 * reason: the value is a key inside the `flags` jsonb rather than a column, so
 * folding it into `PropertyEditInput` would put a presentation choice into the
 * schema that the wizard, the importer and the public query all validate
 * against.
 *
 * Optimistic, with a revert. A chip that flickers back after a failed save is
 * the honest answer — the alternative is a spinner on a control whose whole
 * job is to be a glance.
 */
export function CardLabelsCard({
  propertyId,
  vocabulary,
  initial,
}: {
  propertyId: string;
  vocabulary: CardLabel[];
  initial: string[];
}) {
  const [value, setValue] = useState<string[]>(initial);
  const [pending, start] = useTransition();

  function onChange(next: string[]) {
    const previous = value;
    setValue(next);
    start(async () => {
      const res = await setPropertyCardLabels(propertyId, next);
      if (res.status === "error") {
        setValue(previous);
        toast.error(res.message);
      }
    });
  }

  return (
    <div className="rounded-md border border-bz-border bg-bz-surface p-4">
      <Eyebrow>Card labels</Eyebrow>
      <p className="mt-2 mb-3 text-[12px] text-bz-muted leading-snug">
        Drawn over this listing’s photograph wherever its card appears. Saves as
        you tick. Edit the vocabulary under Settings → Card labels.
      </p>
      <CardLabelPicker
        vocabulary={vocabulary}
        value={value}
        onChange={onChange}
        disabled={pending}
      />
    </div>
  );
}
