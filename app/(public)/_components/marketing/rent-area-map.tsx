/**
 * /rent "Rent by area" section (server). Mirrors the home page's area map
 * — same interactive MapLibre component (`AreaMapHome`) — but scopes the
 * listing dots to rental inventory (`mode: "rent"`) and re-points the copy
 * + "All rentals" link at the rent search.
 *
 * Area pins stay unfiltered so the map always populates with the emirate's
 * communities to browse; the dots are the actual rentals. No cookies /
 * headers / searchParams here, so /rent stays static / ISR.
 */

import { listAreaPins, listAreaListingDots } from "@/lib/queries/area-map";
import { AreaMapHome } from "../area-map/area-map-home";

export async function RentAreaMap() {
  const [abuDhabi, dubai, dots] = await Promise.all([
    listAreaPins("abu-dhabi"),
    listAreaPins("dubai"),
    listAreaListingDots({ mode: "rent" }),
  ]);

  const areas = [...abuDhabi, ...dubai];
  // Nothing to map (e.g. Supabase unconfigured and seeds empty) → render
  // nothing rather than an empty frame.
  if (areas.length === 0) return null;

  return (
    <AreaMapHome
      areas={areas}
      dots={dots}
      eyebrow="Rental areas"
      heading="Rent by area. Start with the map."
      allHref="/rent/search"
      allLabel="All rentals"
    />
  );
}
