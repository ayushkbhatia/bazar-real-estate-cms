import "server-only";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StaffRole, StaffStatus } from "@/lib/schemas/staff";
import type { Database } from "@/db/types";

/**
 * Staff row shape returned by `requireRole`. Narrower than
 * `lib/queries/staff.ts#StaffRow` — the auth helper doesn't join auth.users
 * metadata, so email / joined_at / last_sign_in_at aren't here.
 */
export type StaffRow = {
  user_id: string;
  display_name: string;
  role: StaffRole;
  status: StaffStatus;
  photo_url: string | null;
  title: string | null;
};

/**
 * Require a signed-in user.
 *
 * Resolves to `{ user, supabase }`. Throws a redirect to `/sign-in` when
 * the visitor is anonymous — the redirect is signalled via Next's
 * `redirect()` (which throws a `NEXT_REDIRECT` marker the framework
 * catches).
 *
 * `proxy.ts` already gates `/admin` and `/account` URLs, so this is
 * defence-in-depth for server actions and route handlers that the proxy
 * doesn't cover (POST hits, RPCs invoked from public pages, etc.).
 */
export async function requireSignedIn(): Promise<{
  user: User;
  supabase: SupabaseClient<Database>;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // /sign-in is gone with customer accounts; the staff door is the only one.
  if (!user) redirect("/admin/login");
  return { user, supabase };
}

/**
 * Require a signed-in staff member whose role is in `allowedRoles` and
 * whose status is `active`.
 *
 * On mismatch (no staff row, suspended/on-leave/onboarding, or role
 * outside the allow-list) we throw `notFound()` instead of redirecting —
 * so unauthorised callers see a 404 and can't tell whether the route
 * exists. Anonymous callers still hit the `requireSignedIn` redirect.
 */
export async function requireRole(
  allowedRoles: ReadonlyArray<StaffRole>,
): Promise<{
  user: User;
  staff: StaffRow;
  supabase: SupabaseClient<Database>;
}> {
  const { user, supabase } = await requireSignedIn();
  const { data, error } = await supabase
    .from("staff")
    .select("user_id, display_name, role, status, photo_url, title")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) notFound();
  if (data.status !== "active") notFound();
  if (!allowedRoles.includes(data.role as StaffRole)) notFound();
  return { user, staff: data as StaffRow, supabase };
}
