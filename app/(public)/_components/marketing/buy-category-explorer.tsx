"use client";

/**
 * Interactive category coupling for the /buy landing. The hero chips
 * (Apartment · Villa · Penthouse · Commercial) and the "Featured properties
 * for sale" grid sit in two separate sections, so a small React context
 * threads the active category between them: clicking a chip re-renders the
 * featured grid with that type's listings, all DB-linked and pre-fetched on
 * the server (no client round-trip). Everything else on the page stays a
 * server component — only these three leaves are client.
 */

import { createContext, useContext, useState } from "react";
import type { ListingCardProps } from "@/components/brand/listing-card";
import { FeaturedListings } from "./featured-listings";

export type BuyCategory = { key: string; label: string };

type Ctx = { active: string; setActive: (k: string) => void };
const BuyCategoryCtx = createContext<Ctx | null>(null);

export function BuyCategoryProvider({
  categories,
  children,
}: {
  categories: BuyCategory[];
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(categories[0]?.key ?? "");
  return (
    <BuyCategoryCtx.Provider value={{ active, setActive }}>
      {children}
    </BuyCategoryCtx.Provider>
  );
}

function useBuyCategory(): Ctx {
  const ctx = useContext(BuyCategoryCtx);
  if (!ctx)
    throw new Error("useBuyCategory must be used within BuyCategoryProvider");
  return ctx;
}

/** Clickable category chips shown in the hero (replaces the static pills). */
export function HeroCategoryChips({
  categories,
}: {
  categories: BuyCategory[];
}) {
  const { active, setActive } = useBuyCategory();
  return (
    <div
      className="flex flex-wrap gap-2 mt-7"
      role="group"
      aria-label="Property type"
    >
      {categories.map((c) => {
        const on = c.key === active;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={on}
            onClick={() => setActive(c.key)}
            className={
              "inline-flex items-center h-9 px-4 rounded-full border text-[13px] transition-colors " +
              (on
                ? "bg-bz-navy text-bz-bg border-bz-navy"
                : "bg-bz-surface text-bz-ink-2 border-bz-border hover:border-bz-teal")
            }
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/** Featured grid that swaps its listings with the active category. */
export function CategoryFeatured({
  byCategory,
  fallback,
  title,
  ctaLabel,
  ctaHref,
  ctaHrefByCategory,
}: {
  byCategory: Record<string, ListingCardProps[]>;
  fallback: ListingCardProps[];
  title: string;
  ctaLabel: string;
  ctaHref: string;
  ctaHrefByCategory?: Record<string, string>;
}) {
  const { active } = useBuyCategory();
  const bucket = byCategory[active];
  const hasBucket = !!(bucket && bucket.length > 0);
  const items = hasBucket ? bucket : fallback;
  // When the active category has no listings we show the general fallback
  // row, so the CTA must point at the general search — not the empty
  // category filter that would land on a zero-results page.
  const href = hasBucket ? ctaHrefByCategory?.[active] ?? ctaHref : ctaHref;
  return (
    <FeaturedListings
      eyebrow="Handpicked"
      title={title}
      ctaLabel={ctaLabel}
      ctaHref={href}
      items={items}
    />
  );
}
