import { cache } from "react";
import { getPublishedMegamenu } from "./megamenu";
import { listPublishedProperties } from "./properties";
import { propertyUrl } from "./property-utils";
import { type Locale } from "@/lib/i18n/locales";
import type { Megamenu, MegamenuFeaturedTile } from "@/lib/schemas/megamenu";

/**
 * App-level hydration on top of the CMS megamenu.
 *
 * The public "Rent" tab's featured tiles are whatever an editor sets at
 * /admin/megamenu/rent, like every other tab's. Only when the tab has NO tiles
 * does it fall back to the two most-recent published rent listings (the
 * client's original "Featured Rentals — dynamically listed properties for rent
 * 2x" brief). Until Nov 2026 the live listings replaced the edited tiles
 * whenever any rent listing existed, so the editor's headline, image, link and
 * Arabic never reached the site.
 *
 * This lives in app-level query code, NOT in the brand renderer: the megamenu
 * components (public-mega-nav / megamenu-panel / megamenu-tile, desktop and
 * mobile) render whatever `featured[]` they receive, so injecting live tiles
 * here keeps those components untouched.
 *
 * Mounted in the public layout, so this runs for every public request.
 * `cache()` collapses it to one round-trip per render (matching its neighbour
 * `listFloatingCtas`). The listings are read only when the fallback is
 * needed, so a menu with edited tiles costs no extra query.
 */
export const getPublishedMegamenuHydrated = cache(
  async (locale?: Locale): Promise<Megamenu> => {
    const menu = await getPublishedMegamenu(locale);

    const rentTab = menu.tabs.find((t) => t.slug === "rent");
    if (!rentTab || rentTab.featured.length > 0) return menu;

    const { rows } = await listPublishedProperties({ mode: "rent", limit: 2 });
    if (rows.length === 0) return menu;

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
  },
);
