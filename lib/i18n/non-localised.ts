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
 *
 * `/staff-invite` is absent for a subtler reason: it is a *page*, and a page
 * outside `[locale]` would have no root layout to render into now that the
 * root layout is the locale one. It lives under the segment and is simply
 * never linked in Arabic — English-only content and no-locale-segment are
 * different things, and only the second belongs in this list.
 */
export const NON_LOCALISED = new RegExp(
  [
    "^/api(/|$)",
    "^/auth(/|$)",
    "^/sso(/|$)",
    "^/sold(/|$)",
    "^/contact-qr/vcard$",
    // Root metadata routes. sitemap.xml and robots.txt carry a dot and are
    // already excluded by the matcher; opengraph-image is not.
    "^/opengraph-image",
    "^/_next(/|$)",
  ].join("|"),
);

export function isNonLocalisedPath(pathname: string): boolean {
  return NON_LOCALISED.test(pathname);
}
