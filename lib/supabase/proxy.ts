import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";

const PUBLIC_PATHS = [
  "/",
  "/buy",
  "/rent",
  "/off-plan",
  "/commercial",
  "/about",
  "/services",
  "/insights",
  "/contact",
  "/agents",
  "/areas",
  "/developments",
  "/developers",
  "/p",
  "/tools",
  "/concierge",
  "/legal",
  // Staff sign-in lives under /admin but must stay reachable while signed out.
  "/admin/login",
  // Staff password recovery — reached with no session by definition.
  "/forgot-password",
  "/auth",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Supabase's SSR cookies are all `sb-<project-ref>-auth-token`, chunked as
 * `.0`/`.1` when large. No cookie with this prefix means there is no session
 * to read or refresh.
 */
function hasSupabaseSession(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
}

/**
 * How the response is minted. Defaults to passing the request straight
 * through, which is what every caller wanted before locale routing existed.
 *
 * It has to be a factory rather than a ready-made response, because `setAll`
 * below re-creates the response *after* mutating the request cookies — so a
 * caller that wants a rewrite has to be able to express it twice. Pass a
 * plain response and a token refresh silently drops the rewrite: the visitor
 * lands on `/buy` with `[locale]` resolved to `"buy"`, i.e. the home page,
 * and only while signed in. Nothing in the e2e suite covers that path
 * (`hasSupabaseSession` short-circuits anonymous visitors before the client
 * is ever constructed, and every spec is anonymous), so it would ship.
 */
type ResponseFactory = (request: NextRequest) => NextResponse;

const passThrough: ResponseFactory = (request) => NextResponse.next({ request });

export async function updateSession(
  request: NextRequest,
  makeResponse: ResponseFactory = passThrough,
) {
  let supabaseResponse = makeResponse(request);

  // If Supabase isn't configured yet, skip auth handling entirely.
  if (!isSupabaseConfigured) return supabaseResponse;

  const { pathname } = request.nextUrl;
  // Gate /admin behind auth. /account is gone with customer accounts.
  const isAdmin = pathname.startsWith("/admin");

  // Anonymous visitor — no session cookie to refresh and no user to look up.
  // `auth.getUser()` is a network round-trip to Supabase Auth, and this proxy
  // runs on every non-static path, so calling it for a signed-out visitor on
  // /buy added a hop to the critical path of the whole public marketplace for
  // an answer that is knowable from the request: null. Staff still get the
  // full refresh path below, because they carry the cookie.
  if (!hasSupabaseSession(request)) {
    if (isAdmin && !isPublicPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Re-mint through the same factory, so a rewrite survives a token
          // refresh. This callback only fires when Supabase rotates the
          // session, which is why the bug it guards against is invisible in
          // testing and shows up as an occasional wrong page in production.
          supabaseResponse = makeResponse(request);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isAdmin && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    // Staff get their own door (/admin/login); customers keep the marketplace
    // sign-in. Either way we round-trip the original path via ?redirect.
    // Customer accounts are gone, so /account no longer exists and the staff
    // door is the only sign-in surface.
    url.pathname = "/admin/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
