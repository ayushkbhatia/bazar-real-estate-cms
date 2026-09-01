/**
 * "<mode> by area" section (server) for a master landing page — /rent today,
 * /commercial too. Mirrors the home page's area map (same interactive
 * MapLibre component, `AreaMapHome`) but scopes everything the section
 * asserts to one listing mode: the dots *and* the per-area counts.
 *
 * Scoping the counts is the point. Area pins are still drawn for every area
 * with published inventory of any kind — the map doubles as the way to browse
 * the emirate's communities — but the number on a pin/chip is that area's
 * count *in this mode*, and areas with none show no number at all. Before
 * this, /commercial pinned "Yas Island 14" off the emirate-wide published
 * count while every one of the fourteen was an off-plan home.
 *
 * No cookies / headers / searchParams here, so the host page stays static/ISR.
 */

import { getTranslations } from "next-intl/server";
import {
  listAreaPins,
  listAreaListingDots,
  type ListingMode,
  type ListingSegment,
} from "@/lib/queries/area-map";
import { AreaMapHome } from "../area-map/area-map-home";

export async function RentAreaMap({
  eyebrow = "Rental areas",
  heading = "Rent by area. Start with the map.",
  body = null,
  mode = "rent",
  segment,
  allHref = "/rent/search",
}: {
  /** Section eyebrow — editable from the master page. */
  eyebrow?: string;
  /** Section heading. */
  heading?: string;
  /** Optional paragraph under the heading; nothing renders when blank. */
  body?: string | null;
  /**
   * Listing mode the dots *and* the area counts are scoped to. `null` means
   * every mode — which is what a section scoped by `segment` wants, since a
   * commercial unit is for sale or to let and both belong on /commercial.
   */
  mode?: ListingMode | null;
  /**
   * Segment the dots and counts are scoped to, composing with `mode`.
   *
   * /commercial passes `segment` and NOT `mode`: commercial stopped being a
   * transaction in 0121, so scoping this section to `mode = 'commercial'`
   * would count only the listings still carrying the retired value and show
   * zero beside a rail that had just rendered the segment's inventory.
   */
  segment?: ListingSegment;
  /**
   * "All …" link target, pointing at this mode's search.
   *
   * The LABEL is no longer a parameter with an English default. It followed
   * `mode` in every caller, so the only thing passing it bought was two
   * hard-coded English strings ("All rentals" here, "All commercial" on
   * /commercial) that `AreaMapHome`'s own catalogue fallback was then unable
   * to replace — the link read English on `/ar/rent` and `/ar/commercial`
   * while everything around it was Arabic.
   */
  allHref?: string;
} = {}) {
  const t = await getTranslations("common");
  const [abuDhabi, dubai, dots] = await Promise.all([
    listAreaPins("abu-dhabi", { mode: mode ?? undefined, segment }),
    listAreaPins("dubai", { mode: mode ?? undefined, segment }),
    listAreaListingDots({ mode: mode ?? undefined, segment }),
  ]);

  const areas = [...abuDhabi, ...dubai];
  // Nothing to map (e.g. Supabase unconfigured and seeds empty) → render
  // nothing rather than an empty frame.
  if (areas.length === 0) return null;

  return (
    <AreaMapHome
      areas={areas}
      dots={dots}
      eyebrow={eyebrow}
      heading={heading}
      body={body ?? undefined}
      allHref={allHref}
      allLabel={t(mode === "commercial" ? "allCommercial" : "allRentals")}
    />
  );
}
