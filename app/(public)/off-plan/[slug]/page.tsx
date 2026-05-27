/**
 * /off-plan/[slug]
 *
 * Functional alias for /developments/[slug] — both URLs surface the same
 * record from public.developments. The megamenu's "New launches" tile
 * links here (e.g. /off-plan/solaya-by-aldar) so the URL must resolve;
 * the underlying page is identical to the development detail view because
 * "off-plan" is the development's lifecycle state, not a separate entity.
 *
 * Re-exporting the page module is the lowest-risk way to satisfy both
 * URLs: future iterations can replace this file with a bespoke off-plan
 * layout (different hero treatment, lead-gating, comp tables) without
 * touching the /developments/[slug] route.
 */
// Next.js requires route-segment config (revalidate, dynamic, etc.) to be
// statically declared in each route file — not re-exported. Mirror the
// 60s revalidate from the developments page here, and pass through the
// component + metadata via re-export.
export const revalidate = 60;

export {
  default,
  generateMetadata,
} from "../../developments/[slug]/page";
