"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Eyebrow } from "@/components/brand/eyebrow";
import { CardLabelPicker } from "@/components/brand/card-label-picker";
import type { CardLabel } from "@/lib/card-labels";
import { setDevelopmentCardLabels } from "../_actions";

/**
 * "Card labels" on a development's CMS page.
 *
 * The same picker the property wizard and the property edit screen use — one
 * vocabulary, one control, so an operator who has learned it on a property
 * already knows it here.
 *
 * Saves on tick, like the images and facts cards beside it, and reverts the
 * chip if the write fails.
 */
export function DevelopmentCardLabelsCard({
  slug,
  vocabulary,
  initial,
}: {
  slug: string;
  vocabulary: CardLabel[];
  initial: string[];
}) {
  const [value, setValue] = useState<string[]>(initial);
  const [pending, start] = useTransition();

  function onChange(next: string[]) {
    const previous = value;
    setValue(next);
    start(async () => {
      const res = await setDevelopmentCardLabels(slug, next);
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
        Drawn over this development’s render wherever its card appears — on
        /developments, /off-plan, area pages and the developer profile. The
        tagline still shows beside them. Saves as you tick.
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
