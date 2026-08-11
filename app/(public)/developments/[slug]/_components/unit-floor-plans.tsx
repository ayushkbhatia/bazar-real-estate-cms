"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import type { PlanCard, UnitTypeCard } from "@/lib/queries/development-unit-plans";
import { FloorplanGate } from "./floorplan-gate";
import {
  CARD_SIZES,
  FIT_SIZES,
  FloorPlanLightbox,
  type LightboxPlan,
} from "./floor-plan-lightbox";
import {
  formatArea,
  formatAreaRange,
  usePreferences,
} from "@/lib/preferences";
import type { AreaUnit } from "@/lib/preferences";

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
 *
 * That was true of the *data* but not of the bytes. Rendering only the active
 * type meant every other type's plans were absent from the DOM, so the first
 * press of a tab started the image requests from nothing — and a floor plan is
 * the worst asset to start cold: the originals are 400–800 KB PNGs, and an
 * optimizer miss has to fetch one from Supabase Storage (3.4 s measured) and
 * re-encode before a byte reaches the browser. The same variant on a warm CDN
 * hit takes 66 ms. All of that cost was landing on the click.
 *
 * So every type is now mounted and the tabs toggle `hidden`, which makes the
 * switch a style change on already-decoded images. Two details make that work:
 *
 * - A `display: none` image with `loading="lazy"` never intersects anything and
 *   so is *never* fetched — the mount alone buys nothing. It has to be
 *   `loading="eager"`, which a hidden image does honour.
 * - Eager on eleven plans at page load would compete with the hero, so the
 *   switch is thrown by an observer 800px ahead of the section, at
 *   `fetchPriority="low"`, and not at all on a metered or 2g connection.
 */

/**
 * How many layouts to pull ahead, across all types.
 *
 * Seven types × four layouts is the ceiling the schema allows, and 28 plans at
 * phone widths (`100vw`, so 1200–1920px variants) is several megabytes nobody
 * asked for. Sixteen covers every project in the catalogue today and the first
 * four tabs of a hypothetical maximal one; anything past it keeps the old
 * load-on-press behaviour rather than a worse one.
 */
const WARM_BUDGET = 16;

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
  const [lightbox, setLightbox] = useState<{ typeId: string; index: number } | null>(
    null,
  );
  /**
   * Plans whose full-size variant has been asked for.
   *
   * The lightbox opens on the card's bytes, so this is not what makes it
   * appear — it is what makes it appear *sharp*. Pointing at a card is a
   * reliable half-second of warning before the click, and `q=100` at 96vw is
   * heavy enough (~250 KB) that it is worth spending only on cards someone has
   * actually reached for.
   */
  const [hiRes, setHiRes] = useState<readonly string[]>([]);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const warm = useWarmOnApproach(sectionRef);
  const { prefs } = usePreferences();

  const warmIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of types) {
      for (const p of t.plans) {
        if (ids.size >= WARM_BUDGET) return ids;
        if (p.image_url) ids.add(p.id);
      }
    }
    return ids;
  }, [types]);

  if (types.length === 0) return null;

  const active = types.find((t) => t.id === activeId) ?? types[0]!;
  const summary = summaryLine(active, prefs.area_unit);
  const openType = lightbox ? types.find((t) => t.id === lightbox.typeId) : null;
  const openPlans = openType ? lightboxPlans(openType, prefs.area_unit) : [];

  return (
    <div ref={sectionRef} className="px-4 md:px-12 py-16">
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

      {/* Every type stays mounted; the tabs toggle `hidden`. See the note at
          the top of the file for why that is the whole performance fix. */}
      {types.map((type) => {
        const selected = type.id === active.id;
        return (
          <div
            key={type.id}
            role="tabpanel"
            id={`unit-panel-${type.id}`}
            aria-labelledby={`unit-tab-${type.id}`}
            hidden={!selected}
            className={selected ? "mt-7" : "hidden"}
          >
            {selected && (type.blurb || summary) ? (
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-6">
                {type.blurb ? (
                  <p className="text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[62ch]">
                    {type.blurb}
                  </p>
                ) : null}
                {summary ? (
                  <span className="mono text-[12px] text-bz-muted">{summary}</span>
                ) : null}
              </div>
            ) : null}

            {/* Up to four, so the row stays one line on a desktop and the grid
                never orphans a single card on its own row at 2-up. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {type.plans.map((plan) => {
                if (gated) {
                  return (
                    <FloorplanGate
                      key={plan.id}
                      developmentName={developmentName}
                      developmentSlug={developmentSlug}
                      plan={{
                        id: plan.id,
                        label: plan.label,
                        area_ft2: plan.area_ft2,
                        // The gate builds its own URL from the storage key so
                        // it can blur the real drawing behind the lock.
                        media: plan.image_key
                          ? {
                              storage_key: plan.image_key,
                              filename: plan.label,
                              alt_text: plan.image_alt,
                            }
                          : null,
                      }}
                    />
                  );
                }
                const imageUrl = plan.image_url;
                const reach = () =>
                  imageUrl &&
                  setHiRes((h) => (h.includes(imageUrl) ? h : [...h, imageUrl]));
                return (
                  <article
                    key={plan.id}
                    className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col"
                  >
                    {imageUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            typeId: type.id,
                            index: openableIndex(type, plan.id),
                          })
                        }
                        onPointerEnter={reach}
                        onFocus={reach}
                        aria-label={`${plan.label} — open full screen`}
                        className="relative aspect-square rounded overflow-hidden bg-bz-surface-2 cursor-zoom-in"
                      >
                        <Image
                          src={imageUrl}
                          alt={plan.image_alt ?? `${plan.label} — ${type.label}`}
                          fill
                          sizes={CARD_SIZES}
                          loading={warm && warmIds.has(plan.id) ? "eager" : "lazy"}
                          fetchPriority={selected ? undefined : "low"}
                          className="object-contain"
                        />
                      </button>
                    ) : (
                      <div className="relative aspect-square rounded overflow-hidden bg-bz-surface-2">
                        <PlaceholderImage
                          label={slugish(plan.label)}
                          className="absolute inset-0 w-full h-full"
                        />
                      </div>
                    )}
                    <div className="mt-3">
                      <div className="text-[14px] font-medium">{plan.label}</div>
                      <div className="text-[11.5px] text-bz-ink-2 mono mt-0.5">
                        {planStats(plan, prefs.area_unit)}
                      </div>
                    </div>
                    {plan.description ? (
                      <p className="mt-2 text-[12.5px] text-bz-ink-2 leading-[1.55]">
                        {plan.description}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Full-size variants for cards someone has pointed at. `hidden` keeps
          them out of layout and the a11y tree; `loading="eager"` is what makes
          a hidden image fetch at all. */}
      <div hidden className="hidden">
        {hiRes.map((src) => (
          <div key={src} className="relative">
            <Image
              src={src}
              alt=""
              aria-hidden
              fill
              sizes={FIT_SIZES}
              quality={100}
              loading="eager"
              fetchPriority="low"
            />
          </div>
        ))}
      </div>

      {lightbox && openPlans.length > 0 ? (
        <FloorPlanLightbox
          plans={openPlans}
          index={Math.min(lightbox.index, openPlans.length - 1)}
          onIndexChange={(i) => setLightbox((l) => (l ? { ...l, index: i } : l))}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Flips once the section is within 800px of the viewport, which is the point
 * where a visitor is committed enough to be worth spending their bandwidth on.
 *
 * Skipped outright on a metered or 2g connection: pulling a dozen floor plans
 * ahead of a press is an optimisation on a fast link and a tax on a slow one.
 */
function useWarmOnApproach(ref: React.RefObject<HTMLElement | null>): boolean {
  const [warm, setWarm] = useState(false);

  useEffect(() => {
    if (warm) return;
    const conn = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (
      conn?.saveData ||
      conn?.effectiveType === "2g" ||
      conn?.effectiveType === "slow-2g"
    ) {
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setWarm(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setWarm(true);
          io.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, warm]);

  return warm;
}

/** Cards without an image aren't openable, so the lightbox indexes past them. */
function openableIndex(type: UnitTypeCard, planId: string): number {
  return type.plans.filter((p) => p.image_url).findIndex((p) => p.id === planId);
}

function lightboxPlans(type: UnitTypeCard, unit: AreaUnit): LightboxPlan[] {
  const out: LightboxPlan[] = [];
  for (const p of type.plans) {
    if (!p.image_url) continue;
    const meta = planStats(p, unit);
    out.push({
      id: p.id,
      src: p.image_url,
      alt: p.image_alt ?? `${p.label} — ${type.label}`,
      label: `${type.label} · ${p.label}`,
      meta: meta === "—" ? null : meta,
    });
  }
  return out;
}

/** "1,240 – 1,480 ft² · from AED 2,400,000", dropping whatever isn't set.
 *  Sizes render in the visitor's area unit; the price stays AED because the
 *  rest of this section quotes AED and mixing the two here reads as a typo. */
function summaryLine(type: UnitTypeCard, unit: AreaUnit): string | null {
  const parts: string[] = [];
  const size = formatAreaRange(type.size_from_ft2, type.size_to_ft2, unit);
  if (size) parts.push(size);
  if (type.price_from_aed != null) {
    parts.push(`from AED ${type.price_from_aed.toLocaleString()}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function planStats(
  plan: Pick<PlanCard, "beds" | "baths" | "area_ft2">,
  unit: AreaUnit,
): string {
  const parts: string[] = [];
  if (plan.beds != null) parts.push(plan.beds === 0 ? "Studio" : `${plan.beds} bed`);
  if (plan.baths != null) parts.push(`${plan.baths} bath`);
  if (plan.area_ft2 != null) parts.push(formatArea(plan.area_ft2, unit));
  return parts.length ? parts.join(" · ") : "—";
}

function slugish(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
