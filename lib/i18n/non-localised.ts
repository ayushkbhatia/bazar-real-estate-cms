/**
 * Paths that must never carry a locale segment.
 *
 * The proxy matcher excludes static assets with `.*\.` — i.e. anything with a
 * dot in it. `/api/concierge` has no dot, so **every API route is matched by
 * the proxy**. The moment a locale rewrite lands there unguarded, `/api/health`
 * becomes `/en/api/health`, which no route serves: a total API outage, and the
 * kind that looks like a deploy problem rather than a routing one.
 *
 * Three of these are route handlers that deliberately stay at the app root when
 * the rest of the tree moves under `[locale]` in P1, because their URLs are
 * externally referenced and cannot be re-issued:
 *
 *   /sso/<provider>/callback   a redirect URI registered with an IdP
 *   /contact-qr/vcard          the payload behind a *printed* QR card
 *   /sold/<ref>                the shared-listing permalink
 *
 * Note `/contact-qr/vcard` is here while `/contact-qr` — the page — is not.
 * The page is localised; the vCard it links to is not.
 *
 * `/admin` is deliberately absent. The CMS lives under `[locale]` and renders
 * as English; it is `/ar/admin` that gets redirected away, in the proxy.
 */
export const NON_LOCALISED = new RegExp(
  [
    "^/api(/|$)",
    "^/auth(/|$)",
    "^/sso(/|$)",
    "^/sold(/|$)",
    "^/contact-qr/vcard$",
    "^/staff-invite(/|$)",
    // Root metadata routes. sitemap.xml and robots.txt carry a dot and are
    // already excluded by the matcher; opengraph-image is not.
    "^/opengraph-image",
    "^/_next(/|$)",
  ].join("|"),
);

export function isNonLocalisedPath(pathname: string): boolean {
  return NON_LOCALISED.test(pathname);
}
