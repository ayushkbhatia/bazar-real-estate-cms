/**
 * Supabase email/recovery callback.
 *
 * Supabase auth emails redirect to NEXT_PUBLIC_SITE_URL + /auth/callback.
 * This handler exchanges the PKCE code for a session, then decides where to
 * drop the user.
 *
 * Customer accounts are gone, so there is no /account to land on and no
 * customer auth pages to error back to: everything now routes to the staff
 * door or the marketplace home. The route is kept because Supabase can still
 * issue a link for a staff auth user.
 *
 * If the env isn't configured, fall back to a friendly /sign-in redirect
 * so the route never 5xxs.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { safeRelativePath } from "@/lib/auth-redirect";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type"); // recovery | magiclink | signup
  // Same-origin paths only. Supabase hands `next` straight through from the
  // link it was given, so an attacker who can trigger an auth email for a
  // victim would otherwise choose where that victim lands after sign-in.
  const next = safeRelativePath(url.searchParams.get("next"));

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(new URL("/admin/login?auth_error=1", url.origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/admin/login?auth_error=1", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback]", error);
    return NextResponse.redirect(new URL("/admin/login?auth_error=1", url.origin));
  }

  // Recovery used to land on /reset-password. That page went with the
  // customer auth pages; staff recover their password through an
  // admin-issued link (/staff-invite), so the session is exchanged here and
  // the user is dropped at the staff door already signed in.
  if (type === "recovery") {
    return NextResponse.redirect(
      new URL(next ?? "/admin/login", url.origin),
    );
  }

  return NextResponse.redirect(
    new URL(next ?? "/", url.origin),
  );
}
