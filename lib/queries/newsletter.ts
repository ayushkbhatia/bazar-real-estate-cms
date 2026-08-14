import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured, env } from "@/lib/env";
import type { Database } from "@/db/types";

export type NewsletterStatus = Database["public"]["Enums"]["newsletter_status"];

export type NewsletterRow = {
  id: string;
  email: string;
  status: NewsletterStatus;
  source: string | null;
  account_id: string | null;
  confirmation_token: string | null;
  subscribed_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
};

/** For staff-facing pages. */
export async function listNewsletterSubscribers(opts: {
  status?: NewsletterStatus;
  limit?: number;
}): Promise<NewsletterRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("newsletter_subscribers")
    .select(
      "id, email, status, source, account_id, confirmation_token, subscribed_at, confirmed_at, unsubscribed_at",
    )
    .order("subscribed_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) {
    console.error("[listNewsletterSubscribers]", error);
    return [];
  }
  return (data ?? []) as NewsletterRow[];
}

/** Lookup the signed-in user's subscription, if any. */
export async function getMyNewsletterSubscription(): Promise<NewsletterRow | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  // Request-cached: the caller almost always resolved the same user already.
  const user = await getCurrentUser();
  if (!user) return null;

  // Try account_id match first; then fall back to email match.
  const { data: byAccount } = await supabase
    .from("newsletter_subscribers")
    .select(
      "id, email, status, source, account_id, confirmation_token, subscribed_at, confirmed_at, unsubscribed_at",
    )
    .eq("account_id", user.id)
    .maybeSingle();
  if (byAccount) return byAccount as NewsletterRow;

  const email = user.email?.toLowerCase();
  if (!email) return null;
  const { data: byEmail } = await supabase
    .from("newsletter_subscribers")
    .select(
      "id, email, status, source, account_id, confirmation_token, subscribed_at, confirmed_at, unsubscribed_at",
    )
    .eq("email", email)
    .maybeSingle();
  return (byEmail as NewsletterRow | null) ?? null;
}

/** Public client lookup by confirmation_token (public read for ANY status).
 *  Used by the confirm + unsubscribe routes which run as anon — those routes
 *  only update via service-role on the server action side. */
export async function getSubscriberByToken(
  token: string,
): Promise<NewsletterRow | null> {
  if (!isSupabaseConfigured || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  // We need to bypass RLS to lookup by token — token IS the bearer auth.
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data } = await admin
    .from("newsletter_subscribers")
    .select(
      "id, email, status, source, account_id, confirmation_token, subscribed_at, confirmed_at, unsubscribed_at",
    )
    .eq("confirmation_token", token)
    .maybeSingle();
  return (data as NewsletterRow | null) ?? null;
}

/** Service-role helper for status mutations from confirm/unsubscribe. */
export async function adminSupabase() {
  if (!isSupabaseConfigured || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Public lookup by email (used to detect existing subscribers on signup). */
export async function getSubscriberByEmail(
  email: string,
): Promise<NewsletterRow | null> {
  if (!isSupabaseConfigured) return null;
  const admin = await adminSupabase();
  if (!admin) return null;
  const { data } = await admin
    .from("newsletter_subscribers")
    .select(
      "id, email, status, source, account_id, confirmation_token, subscribed_at, confirmed_at, unsubscribed_at",
    )
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return (data as NewsletterRow | null) ?? null;
}

/** Public client — used by the public signup server action. We allow anon
 *  INSERT (status=pending) per the RLS policy. */
export function publicClient() {
  return createSupabasePublicClient();
}
