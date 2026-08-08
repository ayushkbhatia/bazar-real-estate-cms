"use client";

import { useState } from "react";
import Image from "next/image";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import type { UnitTypeCard } from "@/lib/queries/development-unit-plans";
import { FloorplanGate } from "./floorplan-gate";

/**
 * Units and their layouts — the row of unit-type buttons above the map.
 *
 * One button per unit type the project sells ("Studio", "1 Bedroom", … up to
 * seven); pressing one swaps the cards below for that type's layouts, at most
 * four. Both come from `development_unit_types` and `floor_plans`, so the whole
 * section is editable in the CMS.
 *
 * Client-side because switching types shouldn't cost a request — the whole set
 * is small enough to ship with the page, and a buyer comparing a 2-bed against
 * a 3-bed will press these several times in a row.
 */
export function UnitFloorPlans({
  types,
  developmentName,
  developmentSlug,
  gated,
  heading,
  intro,
  eyebrow,
}: {
  types: UnitTypeCard[];
  developmentName: string;
  developmentSlug: string;
  /** `development.meta.floorplan_gated` — blurs plans behind a lead form. */
  gated: boolean;
  heading: string | null;
  intro: string | null;
  eyebrow: string | null;
}) {
  const [activeId, setActiveId] = useState(types[0]?.id ?? null);
  if (types.length === 0) return null;

  const active = types.find((t) => t.id === activeId) ?? types[0]!;

  return (
    <div className="px-4 md:px-12 py-16">
      <Eyebrow>{eyebrow ?? "Units"}</Eyebrow>
      <h2
        className="serif text-[30px] md:text-[36px] mt-2 leading-tight"
        style={{ letterSpacing: "-0.02em" }}
      >
        {heading ?? "Unit types & layouts"}
      </h2>
      <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
        {intro ??
          `Pick a unit type to see the layouts ${developmentName} offers it in.`}
      </p>

      {/* Scrolls rather than wraps on narrow screens: seven unit types stacked
          into three rows pushes the cards below the fold on a phone. */}
      <div
        role="tablist"
        aria-label="Unit types"
        className="mt-7 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {types.map((t) => {
          const selected = t.id === active.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`unit-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`unit-panel-${t.id}`}
              onClick={() => setActiveId(t.id)}
              className={`shrink-0 h-[38px] px-4 rounded-full text-[13px] border transition-colors ${
                selected
                  ? "bg-bz-navy text-bz-bg border-bz-navy font-medium"
                  : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-ink-2"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`unit-panel-${active.id}`}
        aria-labelledby={`unit-tab-${active.id}`}
        className="mt-7"
      >
        {active.blurb || summaryLine(active) ? (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-6">
            {active.blurb ? (
              <p className="text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[62ch]">
                {active.blurb}
              </p>
            ) : null}
            {summaryLine(active) ? (
              <span className="mono text-[12px] text-bz-muted">
                {summaryLine(active)}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Up to four, so the row stays one line on a desktop and the grid
            never orphans a single card on its own row at 2-up. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {active.plans.map((plan) =>
            gated ? (
              <FloorplanGate
                key={plan.id}
                developmentName={developmentName}
                developmentSlug={developmentSlug}
                plan={{
                  id: plan.id,
                  label: plan.label,
                  area_ft2: plan.area_ft2,
                  // The gate builds its own URL from the storage key so it can
                  // blur the real drawing behind the lock.
                  media: plan.image_key
                    ? {
                        storage_key: plan.image_key,
                        filename: plan.label,
                        alt_text: plan.image_alt,
                      }
                    : null,
                }}
              />
            ) : (
              <article
                key={plan.id}
                className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col"
              >
                <div className="relative aspect-square rounded overflow-hidden bg-bz-surface-2">
                  {plan.image_url ? (
                    <Image
                      src={plan.image_url}
                      alt={plan.image_alt ?? `${plan.label} — ${active.label}`}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="object-contain"
                    />
                  ) : (
                    <PlaceholderImage
                      label={slugish(plan.label)}
                      className="absolute inset-0 w-full h-full"
                    />
                  )}
                </div>
                <div className="mt-3">
                  <div className="text-[14px] font-medium">{plan.label}</div>
                  <div className="text-[11.5px] text-bz-ink-2 mono mt-0.5">
                    {planStats(plan)}
                  </div>
                </div>
                {plan.description ? (
                  <p className="mt-2 text-[12.5px] text-bz-ink-2 leading-[1.55]">
                    {plan.description}
                  </p>
                ) : null}
              </article>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

/** "1,240 – 1,480 ft² · from AED 2,400,000", dropping whatever isn't set. */
function summaryLine(type: UnitTypeCard): string | null {
  const parts: string[] = [];
  const { size_from_ft2: from, size_to_ft2: to } = type;
  if (from != null && to != null && from !== to) {
    parts.push(`${from.toLocaleString()} – ${to.toLocaleString()} ft²`);
  } else if (from != null || to != null) {
    parts.push(`${(from ?? to)!.toLocaleString()} ft²`);
  }
  if (type.price_from_aed != null) {
    parts.push(`from AED ${type.price_from_aed.toLocaleString()}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function planStats(plan: {
  beds: number | null;
  baths: number | null;
  area_ft2: number | null;
}): string {
  const parts: string[] = [];
  if (plan.beds != null) parts.push(plan.beds === 0 ? "Studio" : `${plan.beds} bed`);
  if (plan.baths != null) parts.push(`${plan.baths} bath`);
  if (plan.area_ft2 != null) parts.push(`${plan.area_ft2.toLocaleString()} ft²`);
  return parts.length ? parts.join(" · ") : "—";
}

function slugish(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
