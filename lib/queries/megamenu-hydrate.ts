import { cache } from "react";
import { getPublishedMegamenu } from "./megamenu";
import { listPublishedProperties } from "./properties";
import { propertyUrl } from "./property-utils";
import type { Megamenu, MegamenuFeaturedTile } from "@/lib/schemas/megamenu";

/**
 * App-level hydration on top of the CMS megamenu.
 *
 * The public "Rent" tab's featured tiles are dynamic: rather than the static
 * rows seeded in the DB, they surface the two most-recent published rent
 * listings (mirroring the client's "Featured Rentals — dynamically listed
 * properties for rent 2x" brief).
 *
 * This lives in app-level query code, NOT in the brand renderer: the megamenu
 * components (public-mega-nav / megamenu-panel / megamenu-tile, desktop and
 * mobile) render whatever `featured[]` they receive, so injecting live tiles
 * here keeps those components untouched.
 *
 * Falls back to the DB-seeded tiles when Supabase is unconfigured or no rent
 * listings resolve.
 *
 * Mounted in the public layout, so this runs for every public request.
 * `cache()` collapses it to one round-trip per render (matching its neighbour
 * `listFloatingCtas`), and the two queries are issued together rather than in
 * sequence — the featured-rent tiles don't depend on the menu, so waiting for
 * one before starting the other only added latency to every page in the site.
 */
export const getPublishedMegamenuHydrated = cache(async (): Promise<Megamenu> => {
  const [menu, rent] = await Promise.all([
    getPublishedMegamenu(),
    listPublishedProperties({ mode: "rent", limit: 2 }),
  ]);

  const rentTab = menu.tabs.find((t) => t.slug === "rent");
  if (!rentTab) return menu;

  const { rows } = rent;
  if (rows.length === 0) return menu; // keep the seeded fallback tiles

  const tiles: MegamenuFeaturedTile[] = rows.slice(0, 2).map((row, i) => ({
    id: `rent-featured-${row.id}`,
    position: i,
    variant: i === 0 ? "dark" : "light",
    badge_label: "For rent",
    badge_kind: "dot",
    headline: row.title,
    href: propertyUrl(row),
    media_asset_id: null,
    cta_label: `AED ${Number(row.price_aed).toLocaleString("en-US")}/yr`,
  }));

  rentTab.featured = tiles;
  return menu;
});
