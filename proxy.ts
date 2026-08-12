import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { legacyQueryRedirect } from "@/lib/filters/search-redirect";
import { isNonLocalisedPath } from "@/lib/i18n/non-localised";

export async function proxy(request: NextRequest) {
  // API routes, auth callbacks and the three externally-referenced route
  // handlers never take a locale segment. This branch is a no-op today — it
  // reaches the same `updateSession` the function ends with — and exists so
  // that when the locale rewrite lands below it in P1, it cannot swallow
  // `/api/**`. The matcher does not protect them: it only excludes paths
  // containing a dot, and `/api/concierge` has none. See lib/i18n/non-localised.
  if (isNonLocalisedPath(request.nextUrl.pathname)) {
    return updateSession(request);
  }

  // Legacy `?filter=` and `?category=` deep-links are resolved here rather
  // than inside the page components. Reading `searchParams` in a Server
  // Component forces the whole route to render dynamically, which discarded
  // the `revalidate` on /buy, /rent, /off-plan and /insights and took them out
  // of the CDN entirely. See lib/filters/search-redirect.ts.
  const target = legacyQueryRedirect(
    request.nextUrl.pathname,
    request.nextUrl.searchParams,
  );
  if (target) {
    return NextResponse.redirect(new URL(target, request.url));
  }

  return updateSession(request);
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
