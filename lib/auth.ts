import "server-only";
import { cache } from "react";
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
 * The signed-in user for this request, or null.
 *
 * `supabase.auth.getUser()` is a network round-trip to Supabase Auth, and an
 * admin request asks the same question repeatedly: the proxy, the layout's
 * role gate, the page's own gate, and any query helper that resolves the
 * caller all wanted it independently. On /admin/settings that was five hops
 * before the page ran its own query, three of them identical.
 *
 * `cache()` collapses them to one per request. It is React's per-request
 * memoisation, not a data cache — nothing crosses a request boundary, which
 * is the only correct shape here. Never reach for `unstable_cache` or
 * `"use cache"` on this: those are cross-request and keyed on arguments, and
 * cookies are not part of the key, so one signed-in user's identity would be
 * served to another.
 *
 * Deliberately not guarded by `isSupabaseConfigured` — `createSupabaseServerClient`
 * throws in that case, which is the existing behaviour of every caller here.
 * The guards live in the query helpers that genuinely tolerate a
 * half-configured local environment.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The current user's staff row, whatever its status, or null.
 *
 * Status is deliberately *not* filtered here. Three callers want three
 * different things from this row: `requireRole` and `getStaffRole` require
 * `active`, while `currentStaffRow` needs the row as stored — presence
 * identity and the "can this person create an area?" checks read a suspended
 * member's row and must keep seeing it. Filtering centrally would silently
 * change those.
 */
export const getCurrentStaffRow = cache(async (): Promise<StaffRow | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("staff")
    .select("user_id, display_name, role, status, photo_url, title")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as StaffRow | null) ?? null;
});

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
  // Uncached on purpose: it throws a redirect, so memoising it would cache
  // control flow rather than data. The expensive half — the `getUser()` hop —
  // is cached underneath. Building the client is local work, no round-trip.
  const user = await getCurrentUser();
  // /sign-in is gone with customer accounts; the staff door is the only one.
  if (!user) redirect("/admin/login");
  const supabase = await createSupabaseServerClient();
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
  const staff = await getCurrentStaffRow();
  if (!staff) notFound();
  if (staff.status !== "active") notFound();
  if (!allowedRoles.includes(staff.role)) notFound();
  return { user, staff, supabase };
}

/**
 * The signed-in staff member's role, or null.
 *
 * Unlike `requireRole` this never throws — it is for screens that are already
 * gated and now need to decide what a given role may *do* on them, such as
 * whether to offer a publish button. Rendering a control the action will
 * refuse is worse than not rendering it: `requireRole` answers with a 404,
 * which reads as a broken page rather than a permission boundary.
 */
export async function getStaffRole(): Promise<StaffRole | null> {
  const staff = await getCurrentStaffRow();
  if (!staff || staff.status !== "active") return null;
  return staff.role;
}
