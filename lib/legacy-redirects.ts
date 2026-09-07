import type { NextConfig } from "next";

/**
 * One entry of `next.config.ts`'s `redirects()`, derived from the config type
 * rather than deep-imported from `next/dist` — that path is internal and has
 * moved between majors.
 */
type Redirect = Awaited<
  ReturnType<NonNullable<NextConfig["redirects"]>>
>[number];

/**
 * The WordPress site this one replaced, mapped onto the routes that replaced
 * it.
 *
 * ## Why this exists
 *
 * `site:bazarrealestate.ae` still returns the old site. Its URLs 307 to the
 * www host — the apex redirect added when the domain moved — and then 404,
 * because nothing ever mapped the WordPress URL space onto the Next one. A
 * 404 at the end of a redirect chain drops the URL from the index instead of
 * passing its ranking to whatever replaced it, so every path that ever ranked
 * has been bleeding out rather than transferring.
 *
 * ## What is evidence and what is inference
 *
 * Two paths are CONFIRMED indexed, by their titles in a live `site:` query:
 *
 *   - `/listings/`                     → "Listings – bazar"
 *   - `/rlisting_status/residential/`  → "Residential – bazar"
 *
 * plus the homepage and `/?lang=ar` (a Polylang/WPML parameter), both of which
 * the Wayback Machine holds captures of. The archive is otherwise useless
 * here: every capture of this host is the origin's bot-check interstitial, not
 * the page, so there is no crawlable inventory to work from.
 *
 * Everything else below is INFERRED from the theme. `rlisting_status` is the
 * Resido real-estate theme's taxonomy, and its URL space is fixed: listings at
 * `/rlisting/<slug>`, taxonomies at `/rlisting_type`, `/rlisting_city`,
 * `/rlisting_feature`, `/rlisting_label`, agents at `/agent/<slug>`, and the
 * WordPress defaults (`/category`, `/tag`, `/author`, `/blog`) underneath.
 * Every family here is one of those.
 *
 * A rule for a path the old site never served is inert — it costs a line in
 * this file and nothing at runtime — so the map is deliberately wider than the
 * evidence. The authoritative list is Search Console's "Pages → Not found
 * (404)" report, which the client has and this repo does not; anything it
 * names that is not covered below belongs here.
 *
 * ## What each rule is allowed to target
 *
 * A redirect is only worth ranking if it lands on a page that answers the same
 * question. Where an equivalent exists — the listings index → `/buy`, the
 * commercial taxonomy → `/commercial` — this transfers. Where one does not,
 * the destination is the nearest surviving CATEGORY, never a guess at a
 * specific record: an individual `/rlisting/<slug>` from the WordPress site
 * has no counterpart in the current catalogue, and inventing one would send a
 * visitor to a property that is not the one they clicked. Google is likely to
 * treat those category-level hops as soft 404s and pass nothing, which is the
 * honest outcome; the redirect still earns its place by putting a human who
 * follows an old link somewhere useful instead of on an error page.
 *
 * Every destination is a route that exists and returns 200 for any input the
 * rule can produce — `legacy-redirects.test.ts` is what keeps that true, along
 * with the rule that no source may shadow a live route.
 *
 * ## What is deliberately NOT here
 *
 * WordPress infrastructure — `/wp-admin`, `/wp-login.php`, `/xmlrpc.php`,
 * `/wp-json/*`, `/wp-content/*`, `/wp-includes/*`. Those 404 today and should
 * keep 404ing: they are the single largest source of bot probing on any ex-WP
 * domain, and redirecting them to a real page turns every probe into a soft
 * 404 against that page and spends crawl budget on traffic that was never a
 * reader. The uploads directory is the one with real indexed URLs (Google
 * Images holds `/wp-content/uploads/2021/…`), and an old image file has no
 * new counterpart to point at, so 404 is also the correct answer there.
 */

/** Property types on the new search that a WordPress taxonomy term maps onto. */
const TYPE_TAXONOMY: Record<string, string> = {
  apartment: "apartment",
  apartments: "apartment",
  flat: "apartment",
  villa: "villa",
  villas: "villa",
  townhouse: "townhouse",
  townhouses: "townhouse",
  penthouse: "penthouse",
  penthouses: "penthouse",
  land: "land",
  plot: "land",
};

/**
 * `/rlisting_type/<term>` for the terms that name a property type the search
 * still has a filter for, so the redirect lands on the same slice of stock
 * rather than on the whole catalogue.
 *
 * Targets `/buy/search?type=…` directly rather than `/buy?type=…`. The latter
 * resolves — `legacyQueryRedirect` in proxy.ts moves it — but through a second
 * hop, and a chain of two redirects is worth less than one to a search engine
 * and slower to a reader.
 */
const typeRules: Redirect[] = Object.entries(TYPE_TAXONOMY).map(
  ([term, type]) => ({
    source: `/rlisting_type/${term}`,
    destination: `/buy/search?type=${type}`,
    permanent: true,
  }),
);

export const LEGACY_WORDPRESS_REDIRECTS: Redirect[] = [
  /*
   * The two confirmed ones first.
   *
   * `/listings` was the catalogue index and `/buy` is the catalogue index, so
   * this is the one mapping in the file that is a true equivalence rather than
   * a nearest-surviving-category hop.
   */
  { source: "/listings", destination: "/buy", permanent: true },
  { source: "/listings/:path*", destination: "/buy", permanent: true },

  // The status taxonomy. Specific terms before the catch-all: Next matches
  // this array in order, and `/rlisting_status/:term*` would otherwise
  // swallow the two below and send a commercial search to /buy.
  {
    source: "/rlisting_status/residential",
    destination: "/buy",
    permanent: true,
  },
  {
    source: "/rlisting_status/commercial",
    destination: "/commercial",
    permanent: true,
  },
  { source: "/rlisting_status/for-rent", destination: "/rent", permanent: true },
  { source: "/rlisting_status/rent", destination: "/rent", permanent: true },
  { source: "/rlisting_status/for-sale", destination: "/buy", permanent: true },
  { source: "/rlisting_status/sale", destination: "/buy", permanent: true },
  { source: "/rlisting_status/sell", destination: "/buy", permanent: true },
  {
    source: "/rlisting_status/off-plan",
    destination: "/off-plan",
    permanent: true,
  },
  { source: "/rlisting_status/:term*", destination: "/buy", permanent: true },

  // The type taxonomy — the mapped terms, then everything else.
  ...typeRules,
  {
    source: "/rlisting_type/office",
    destination: "/commercial",
    permanent: true,
  },
  {
    source: "/rlisting_type/retail",
    destination: "/commercial",
    permanent: true,
  },
  { source: "/rlisting_type/:term*", destination: "/buy", permanent: true },

  /*
   * The city taxonomy goes to the areas INDEX, not to `/areas/<term>`.
   *
   * The old site's cities were Abu Dhabi municipal districts — "Al Maqta'",
   * "Abu Dhabi Island", "Mohamed Bin Zayed City" are the ones its own listings
   * page named — and `areas` today holds 26 slugs, almost none of which
   * match. Passing the term through would turn most of these into a redirect
   * to a 404, which is strictly worse than the 404 they are now: it spends a
   * hop and still fails. The index resolves for every term.
   */
  { source: "/rlisting_city/:term*", destination: "/areas", permanent: true },
  { source: "/rlisting_feature/:term*", destination: "/buy", permanent: true },
  { source: "/rlisting_label/:term*", destination: "/buy", permanent: true },

  /*
   * An individual listing from the WordPress catalogue.
   *
   * No counterpart exists — that stock was sold or withdrawn years ago and the
   * slugs were never carried across — so this lands on the catalogue rather
   * than pretending to resolve to a specific property.
   */
  { source: "/rlisting/:slug*", destination: "/buy", permanent: true },
  { source: "/property/:slug*", destination: "/buy", permanent: true },
  { source: "/properties/:slug*", destination: "/buy", permanent: true },

  /*
   * `/agent/…` singular only.
   *
   * `/agents` and `/agents/<slug>` are live routes on this site — the advisor
   * directory and the advisor profile — so a rule on the plural would take
   * the real page down. WordPress used the singular for the post type.
   */
  { source: "/agent/:slug*", destination: "/agents", permanent: true },

  // The WordPress blog, which /insights replaced.
  { source: "/blog", destination: "/insights", permanent: true },
  { source: "/blog/:slug*", destination: "/insights", permanent: true },
  { source: "/category/:slug*", destination: "/insights", permanent: true },
  { source: "/tag/:slug*", destination: "/insights", permanent: true },
  { source: "/author/:slug*", destination: "/agents", permanent: true },
];

/**
 * The query parameter the WordPress site carried its language in.
 *
 * Handled in `proxy.ts` rather than as a rule above, for two reasons. It
 * appeared on every path, not just the homepage — Polylang appends it site-
 * wide — so a `has`-gated rule per source would mean duplicating the whole map.
 * And `redirects()` merges unmatched query parameters into the destination,
 * which turns `/?lang=ar` into `/ar?lang=ar`: a second URL for the same page,
 * carrying a parameter that means nothing here. The proxy strips it, the way
 * branch 2b already strips `?setlang=`.
 */
export const LEGACY_LANG_PARAM = "lang";
