"use client";

import { Eyebrow } from "@/components/brand/eyebrow";

const FLAGS = [
  { key: "feature_on_homepage", label: "Feature on homepage" },
  { key: "exclusive", label: "Exclusive" },
  { key: "vacant_on_transfer", label: "Vacant on transfer" },
  { key: "mortgage_eligible", label: "Mortgage eligible" },
  { key: "allow_virtual_tour", label: "Allow virtual tour" },
  { key: "show_on_property_finder", label: "Show on Property Finder" },
] as const;

type FlagKey = (typeof FLAGS)[number]["key"];

/**
 * Sprint 7c (backfilled): right-rail "Featured & flags" card on the
 * property edit form. Controlled checkboxes; the parent owns the value
 * and writes through to `properties.flags` jsonb.
 */
export function FeaturedFlagsCard({
  value,
  onChange,
}: {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  function toggle(key: FlagKey) {
    onChange({ ...value, [key]: !value[key] });
  }

  return (
    <div className="rounded-md border border-bz-border bg-bz-surface p-4">
      <Eyebrow>Featured & flags</Eyebrow>
      <div className="mt-3 flex flex-col gap-1.5">
        {FLAGS.map((f) => {
          const checked = Boolean(value[f.key]);
          return (
            <label
              key={f.key}
              className="flex items-center gap-2 cursor-pointer py-1"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(f.key)}
                className="rounded"
              />
              <span className="text-[13px] text-bz-ink">{f.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
