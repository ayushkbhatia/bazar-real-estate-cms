/**
 * The pure URL builder for the hero search bar.
 *
 * Kept out of the client component so the querystring logic is unit-testable
 * without pulling `next/navigation` into the node test env.
 *
 * Every field maps onto a key `parseFilters` (lib/filters/property.ts) already
 * understands — the target route pages scope by mode and apply the rest, so
 * the hero needs no bespoke backend.
 *
 * The tab list itself moved to `lib/search-bar/registry.ts` when the bar
 * became CMS-editable: what a tab *is* is now resolved at read time from the
 * registry plus whatever an editor stored, and this file only has to know how
 * to turn one into a URL.
 */

import type { SearchBarTab } from "@/lib/search-bar/types";

export { SEARCH_BAR_DEF, defaultSearchBar } from "@/lib/search-bar/registry";
export type { SearchBarTab } from "@/lib/search-bar/types";

export type Range = { min: number | null; max: number | null };

export type HeroSearchState = {
  q: string;
  type: string;
  beds: string;
  price: Range;
  size: Range;
};

/**
 * The four stored tab routes are the marketing LANDINGS (/buy, /rent,
 * /off-plan, /commercial), not the search. The proxy only forwards a landing
 * to its `…/search` route when the URL carries a filter, so a search with
 * nothing typed — the commonest one, and the default Off-Plan tab's — landed
 * on the marketing page instead of results. The hero always means "show me
 * results", so it goes straight to the search route, with the same mapping
 * `searchRedirectTarget` (lib/filters/search-redirect.ts) applies: Commercial
 * is a segment of the sale search since 0121. A route an editor has pointed
 * anywhere else is left alone.
 */
const SEARCH_ROUTES: Record<string, { path: string; segment?: string }> = {
  "/off-plan": { path: "/off-plan/search" },
  "/buy": { path: "/buy/search" },
  "/rent": { path: "/rent/search" },
  "/commercial": { path: "/buy/search", segment: "commercial" },
};

/**
 * Build the destination URL (route + querystring) for a hero search.
 * Only non-empty fields are emitted, and only the controls the tab
 * actually shows (beds / size) are considered.
 */
export function buildHeroSearchUrl(
  tab: SearchBarTab,
  state: HeroSearchState,
): string {
  const p = new URLSearchParams();
  if (state.q.trim()) p.set("q", state.q.trim());
  if (state.type) p.set("type", state.type);
  if (tab.beds && state.beds) p.set("beds", state.beds);
  if (state.price.min != null) p.set("price_min", String(state.price.min));
  if (state.price.max != null) p.set("price_max", String(state.price.max));
  if (tab.size) {
    if (state.size.min != null) p.set("ft2_min", String(state.size.min));
    if (state.size.max != null) p.set("ft2_max", String(state.size.max));
  }
  const target = SEARCH_ROUTES[tab.route.replace(/\/+$/, "")];
  if (target?.segment) p.set("segment", target.segment);
  const qs = p.toString();
  return `${target?.path ?? tab.route}${qs ? `?${qs}` : ""}`;
}
