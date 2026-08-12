import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { legacyQueryRedirect } from "@/lib/filters/search-redirect";
import { isNonLocalisedPath } from "@/lib/i18n/non-localised";
import {
  internalPath,
  localeFromPathname,
  stripLocalePrefix,
  withLocalePrefix,
} from "@/lib/i18n/routing";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";

/**
 * The order of these branches is the whole design — see docs/I18N.md.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. API routes, auth callbacks, and the three externally-referenced route
  //    handlers never take a locale segment. The matcher does NOT protect
  //    them: it only excludes paths containing a dot, and `/api/concierge`
  //    has none. Without this branch the rewrite below turns every API call
  //    into a 404. See lib/i18n/non-localised.ts.
  if (isNonLocalisedPath(pathname)) {
    return updateSession(request);
  }

  // 2. The CMS is English-only, permanently (ADR-0007). Redirecting rather
  //    than rewriting is what makes every future [dir="rtl"] rule provably
  //    inert inside /admin.
  if (pathname === "/ar/admin" || pathname.startsWith("/ar/admin/")) {
    return NextResponse.redirect(
      new URL(pathname.replace(/^\/ar/, ""), request.url),
    );
  }

  // 3. The default locale is served unprefixed, so `/en/buy` must not also
  //    answer. Left reachable it is a second URL serving byte-identical
  //    content — duplicate content against `/buy`, and a crawler that finds
  //    it has no canonical telling it which one counts. 308 rather than 307:
  //    this is a permanent statement about URL shape, not a temporary
  //    redirect, and it keeps the method on non-GET requests.
  if (
    pathname === `/${DEFAULT_LOCALE}` ||
    pathname.startsWith(`/${DEFAULT_LOCALE}/`)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = stripLocalePrefix(pathname);
    return NextResponse.redirect(url, 308);
  }

  // 4. Legacy `?filter=` and `?category=` deep-links are resolved here rather
  //    than inside the page components. Reading `searchParams` in a Server
  //    Component forces the whole route to render dynamically, which discarded
  //    the `revalidate` on /buy, /rent, /off-plan and /insights and took them
  //    out of the CDN entirely. See lib/filters/search-redirect.ts.
  //
  //    Matched against the *unprefixed* path, then re-prefixed, so the rule
  //    keeps working for `/ar/buy?type=apartment` once Arabic is served.
  const locale = localeFromPathname(pathname) ?? DEFAULT_LOCALE;
  const target = legacyQueryRedirect(
    stripLocalePrefix(pathname),
    request.nextUrl.searchParams,
  );
  if (target) {
    return NextResponse.redirect(
      new URL(withLocalePrefix(target, locale), request.url),
    );
  }

  // 5. Render through the locale segment. English is served on unprefixed
  //    URLs but rendered by `/en/*`, so this rewrite is what connects the two
  //    — and it hits the prerendered artifact rather than re-rendering
  //    (measured in the P1 spike: byte-identical to the on-disk .html, with
  //    x-nextjs-cache: HIT). A rewrite, never a redirect: the visitor's URL
  //    must not change.
  //
  //    The factory form matters. `updateSession` re-mints its response inside
  //    the Supabase cookie callback, so passing a ready-made rewrite would
  //    lose it on token refresh.
  const rewriteTo = internalPath(pathname);
  if (rewriteTo === pathname) {
    return updateSession(request);
  }

  return updateSession(request, (req) => {
    const url = req.nextUrl.clone();
    url.pathname = rewriteTo;
    return NextResponse.rewrite(url, { request: req });
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, robots.txt, sitemap.xml
     * - images, fonts, public assets (\\.[\\w]+$)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.).*)",
  ],
};
