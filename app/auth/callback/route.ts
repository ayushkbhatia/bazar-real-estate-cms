/**
 * Sprint 11 — Supabase email/recovery callback.
 *
 * Supabase auth emails (signup confirm, magic link, recovery) redirect
 * to NEXT_PUBLIC_SITE_URL + /auth/callback?code=…&type=…. This handler
 * exchanges the PKCE code for a session via the server client, then
 * routes the user based on `type` query:
 *   - 'recovery' → /reset-password (action picks up active session)
 *   - 'magiclink' / 'signup' → /account/saved
 *   - anything else → /sign-in?auth_error=1
 *
 * If the env isn't configured, fall back to a friendly /sign-in redirect
 * so the route never 5xxs.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type"); // recovery | magiclink | signup
  const next = url.searchParams.get("next");

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(new URL("/sign-in?auth_error=1", url.origin));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/sign-in?auth_error=1", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback]", error);
    return NextResponse.redirect(new URL("/sign-in?auth_error=1", url.origin));
  }

  // Recovery flow: send to /reset-password where the form action calls
  // supabase.auth.updateUser({ password }).
  if (type === "recovery") {
    return NextResponse.redirect(
      new URL(next ?? "/reset-password", url.origin),
    );
  }

  return NextResponse.redirect(
    new URL(next ?? "/account/saved", url.origin),
  );
}
