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

import {
  listAreaPins,
  listAreaListingDots,
  type ListingMode,
} from "@/lib/queries/area-map";
import { AreaMapHome } from "../area-map/area-map-home";

export async function RentAreaMap({
  eyebrow = "Rental areas",
  heading = "Rent by area. Start with the map.",
  body = null,
  mode = "rent",
  allHref = "/rent/search",
  allLabel = "All rentals",
}: {
  /** Section eyebrow — editable from the master page. */
  eyebrow?: string;
  /** Section heading. */
  heading?: string;
  /** Optional paragraph under the heading; nothing renders when blank. */
  body?: string | null;
  /** Listing mode the dots *and* the area counts are scoped to. */
  mode?: ListingMode;
  /** "All …" link target + label, pointing at this mode's search. */
  allHref?: string;
  allLabel?: string;
} = {}) {
  const [abuDhabi, dubai, dots] = await Promise.all([
    listAreaPins("abu-dhabi", { mode }),
    listAreaPins("dubai", { mode }),
    listAreaListingDots({ mode }),
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
      allLabel={allLabel}
    />
  );
}
