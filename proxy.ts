import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { legacyQueryRedirect } from "@/lib/filters/search-redirect";
import { isNonLocalisedPath } from "@/lib/i18n/non-localised";
import {
  SETLANG_PARAM,
  internalPath,
  localeFromPathname,
  stripLocalePrefix,
  withLocalePrefix,
} from "@/lib/i18n/routing";
import { DEFAULT_LOCALE, isEnabledLocale } from "@/lib/i18n/locales";
import {
  PREFS_COOKIE,
  PREFS_COOKIE_MAX_AGE,
  chosenLocale,
  decodePrefs,
  encodePrefs,
} from "@/lib/preferences/cookie";

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

  // 2b. An explicit language choice, carried in the URL as `?setlang=`.
  //
  //     The language switch is the only thing that writes this, and it is a
  //     query param rather than an onClick that sets `document.cookie` for one
  //     reason: without it the English half of the switch is a dead control.
  //     A visitor with a sticky `ar` preference who clicks "EN" asks for
  //     `/buy`, branch 2c redirects them straight back to `/ar/buy`, and the
  //     only way out is clearing cookies. Making the choice part of the
  //     request means the server sees it *before* it decides where to send
  //     them, and it keeps working with JavaScript disabled.
  //
  //     One redirect hop, on the switch only — the param is stripped here so
  //     it never reaches the page, is never shared, and never lands in an
  //     analytics URL or a canonical.
  const requestedLocale = request.nextUrl.searchParams.get(SETLANG_PARAM);
  if (isEnabledLocale(requestedLocale)) {
    const url = request.nextUrl.clone();
    url.searchParams.delete(SETLANG_PARAM);
    const response = NextResponse.redirect(url, 307);
    // Round-tripped through the codec so currency and area-unit survive: this
    // is the same `bz_prefs` cookie the preferences popover owns, and writing
    // a bare `l=ar` here would silently reset a visitor's USD/m² choices.
    const prefs = decodePrefs(request.cookies.get(PREFS_COOKIE)?.value);
    response.cookies.set(
      PREFS_COOKIE,
      encodePrefs({ ...prefs, locale: requestedLocale }),
      { path: "/", maxAge: PREFS_COOKIE_MAX_AGE, sameSite: "lax" },
    );
    return response;
  }

  // 2c. Keep a visitor who chose Arabic on the Arabic site.
  //
  //     Locale lives in the URL, and every internal href in this repo was
  //     written unprefixed and English. `components/i18n/link.tsx` fixes that
  //     for `<Link>`, which is the overwhelming majority — but not for a plain
  //     `<a>`, a `router.push`, a `redirect()` out of a Server Action, a form
  //     `action`, a bookmark, or a link someone was sent. Those all still land
  //     on an unprefixed URL, and without this branch each one is a silent
  //     drop back into English mid-session.
  //
  //     Three guards, each load-bearing:
  //
  //     - **Only when the visitor chose.** No `l=` in the cookie means no
  //       redirect, ever. Crawlers carry no cookies, so the indexed English
  //       URLs are untouched and `/ar` stays out of the index exactly as
  //       `robots.ts` intends. It also means this is inert for every visitor
  //       who never opens the switch.
  //     - **Only unprefixed paths.** The URL outranks the cookie. `/buy` with
  //       an `ar` preference redirects; `/ar/buy` with an `en` preference does
  //       not, because someone following an Arabic link asked for Arabic.
  //     - **Never `/admin`.** The CMS is English-only (ADR-0007) and branch 3
  //       below bounces `/ar/admin` back here — redirecting it would be an
  //       infinite loop, not a wrong page.
  //
  //     307, not 308: which URL a visitor gets depends on their cookie, and a
  //     permanent redirect would be cached by the browser and applied to every
  //     later request regardless of what they choose next.
  const preferred = chosenLocale(request.cookies.get(PREFS_COOKIE)?.value);
  if (
    preferred &&
    preferred !== DEFAULT_LOCALE &&
    localeFromPathname(pathname) === null &&
    pathname !== "/admin" &&
    !pathname.startsWith("/admin/") &&
    (request.method === "GET" || request.method === "HEAD")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = withLocalePrefix(pathname, preferred);
    return NextResponse.redirect(url, 307);
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
