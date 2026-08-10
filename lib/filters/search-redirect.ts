import { FILTER_PARAM_KEYS } from "./property-keys";

/**
 * Legacy-querystring redirects, evaluated in `proxy.ts`.
 *
 * These used to live inside the page components, which is what made them
 * expensive: reading `searchParams` in a Server Component — even just to await
 * it and find nothing — opts the whole route into dynamic rendering, silently
 * discarding its `revalidate` export. /buy, /rent, /off-plan and /insights
 * were therefore re-rendered from scratch on every request, CDN cache disabled,
 * for a redirect that fires on well under 1% of visits.
 *
 * Running the same check in the proxy costs one `URLSearchParams` lookup per
 * request and leaves the pages statically cacheable. Same URLs, same
 * destinations, same 307 semantics as the `redirect()` calls they replace.
 */

/**
 * Keys that mean "the visitor is running a search", not just landing on the
 * marketing page. `view` is the grid/list/map toggle — not a filter parser,
 * but equally a signal that the URL came from the old search UI.
 * Non-filter params (utm_*, ref, etc.) are ignored so campaign links still
 * land on the marketing page.
 */
const SEARCH_KEYS = new Set<string>([...FILTER_PARAM_KEYS, "view"]);

/** Landing routes whose `…/search` sub-route absorbs old filter deep-links. */
export const SEARCH_LANDING_BASES = ["/buy", "/rent", "/off-plan"] as const;

/**
 * `/buy?type=apartment` → `/buy/search?type=apartment`, keeping old deep-links
 * alive after the search relocation. Returns null when nothing looks like a
 * search, which is the overwhelmingly common case.
 */
export function searchRedirectTarget(
  base: string,
  params: URLSearchParams,
): string | null {
  let matched = false;
  for (const key of params.keys()) {
    if (SEARCH_KEYS.has(key)) {
      matched = true;
      break;
    }
  }
  if (!matched) return null;

  const qs = params.toString();
  return `${base}/search${qs ? `?${qs}` : ""}`;
}

/**
 * `/insights?category=off_plan_watch` → `/insights/category/off-plan-watch`.
 *
 * The category archive already exists as its own statically-generated route
 * with its own metadata and `generateStaticParams`, so the querystring form was
 * a second URL serving identical content — a canonical-duplication problem as
 * well as the thing keeping /insights out of the CDN. The archive route is now
 * the only surface; this keeps existing links and bookmarks working.
 */
export function insightsCategoryRedirect(
  pathname: string,
  params: URLSearchParams,
): string | null {
  if (pathname !== "/insights") return null;
  const category = params.get("category");
  if (!category) return null;
  // Mirrors `categoryToUrlSlug` in lib/schemas/article. Inlined rather than
  // imported because that module pulls zod, and this one is in the middleware
  // bundle that loads on every request. `search-redirect.test.ts` asserts the
  // two agree.
  return `/insights/category/${category.replace(/_/g, "-")}`;
}

/**
 * The single entry point the proxy calls: returns a path to redirect to, or
 * null to let the request through untouched.
 */
export function legacyQueryRedirect(
  pathname: string,
  params: URLSearchParams,
): string | null {
  const base = SEARCH_LANDING_BASES.find((b) => b === pathname);
  if (base) return searchRedirectTarget(base, params);
  return insightsCategoryRedirect(pathname, params);
}
