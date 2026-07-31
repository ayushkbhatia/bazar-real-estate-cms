import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { safeRelativePath } from "@/lib/auth-redirect";

/**
 * SSO callback handler.
 *
 * Sprint 2 ships this shell so the route resolves (was 404). Sprint 11
 * wires the real Supabase OAuth exchange — we currently rely on the
 * Supabase SDK's PKCE flow which posts to `/auth/v1/callback` at the
 * Supabase host directly. This route exists for providers that need a
 * controlled redirect target on the Bazar domain (Apple, custom IdPs).
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next =
    safeRelativePath(url.searchParams.get("next")) ?? "/account/saved";

  if (!isSupabaseConfigured || !code) {
    return NextResponse.redirect(new URL("/sign-in?sso_error=1", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error(`[sso/${provider}/callback]`, error);
    return NextResponse.redirect(
      new URL(`/sign-in?sso_error=1&provider=${provider}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
