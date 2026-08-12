/**
 * Home "Where to live" section (server). Fetches area pins + listing dots
 * and hands them to the client orchestrator as serialisable props — no
 * cookies/headers/searchParams here, so the home page stays static / ISR.
 *
 * Both emirates are fetched so the Abu Dhabi / Dubai toggle is wired now;
 * Dubai returns no pins until its areas are seeded (the map then shows a
 * "coming soon" state), and lights up with zero code change once they are.
 */

import { listAreaPins, listAreaListingDots } from "@/lib/queries/area-map";
import { AreaMapHome } from "./area-map/area-map-home";

export async function AreaMapSection({
  eyebrow,
  heading,
  body,
}: {
  /** Master-page copy. `null`/omitted → the component's own defaults. */
  eyebrow?: string | null;
  heading?: string | null;
  body?: string | null;
} = {}) {
  const [abuDhabi, dubai, dots] = await Promise.all([
    listAreaPins("abu-dhabi"),
    listAreaPins("dubai"),
    listAreaListingDots(),
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
      body={body}
    />
  );
}
