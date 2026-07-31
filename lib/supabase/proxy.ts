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
  "/auth",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // If Supabase isn't configured yet, skip auth handling entirely.
  if (!isSupabaseConfigured) return supabaseResponse;

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
          supabaseResponse = NextResponse.next({ request });
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

  const { pathname } = request.nextUrl;

  // Gate /admin behind auth. /account is gone with customer accounts.
  const isAdmin = pathname.startsWith("/admin");

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
