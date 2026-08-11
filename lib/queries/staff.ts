import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentStaffRow } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import type { StaffRole, StaffStatus } from "@/lib/schemas/staff";

export type StaffRow = {
  user_id: string;
  display_name: string;
  email: string | null;
  role: StaffRole;
  status: StaffStatus;
  photo_url: string | null;
  title: string | null;
  joined_at: string | null;
  last_sign_in_at: string | null;
};

export type PendingInvitation = {
  id: string;
  email: string;
  display_name: string;
  role: StaffRole;
  invited_by_name: string | null;
  expires_at: string;
  created_at: string;
};

/** All staff rows. Email is pulled from auth.users via a join. */
export async function listAllStaff(): Promise<StaffRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("staff")
    .select("user_id, display_name, role, status, photo_url, title, joined_at")
    .order("display_name", { ascending: true });
  if (error || !data) {
    if (error) console.error("[listAllStaff]", error);
    return [];
  }

  // Email + last_sign_in_at live in auth.users; fetch them via the service
  // role admin API (server-side only). We fall back to null when the
  // service role isn't available so the page still renders.
  const emails = await fetchAuthMetadata(data.map((r) => r.user_id));

  return data.map((r) => ({
    user_id: r.user_id,
    display_name: r.display_name,
    email: emails.get(r.user_id)?.email ?? null,
    role: r.role,
    status: r.status,
    photo_url: r.photo_url,
    title: r.title,
    joined_at: r.joined_at,
    last_sign_in_at: emails.get(r.user_id)?.last_sign_in_at ?? null,
  }));
}

/**
 * Outstanding invitations — anyone who still can't sign in.
 *
 * Filtered on `activated_at`, not `accepted_at`. The latter is stamped by the
 * accept trigger the moment an auth.users row exists for the address, which the
 * old Supabase-mailer invite did at invite time — so invitations disappeared
 * from this list while the invitee had no password and no way to get one. There
 * was then no way to re-send from the admin at all. `activated_at` is set only
 * once the person has set a password (migration 0064).
 *
 * Scoped to `purpose = 'invite'` (0065). Password-reset links for existing staff
 * ride on the same table, and listing one here would read as a colleague who
 * hasn't joined yet.
 */
export async function listPendingInvitations(): Promise<PendingInvitation[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("staff_invitations")
    .select(
      "id, email, display_name, role, expires_at, created_at, invited_by_staff:invited_by(display_name)",
    )
    .eq("purpose", "invite")
    .is("activated_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error || !data) {
    if (error) console.error("[listPendingInvitations]", error);
    return [];
  }
  return data.map((r) => {
    const raw = r as unknown as Record<string, unknown>;
    const invited = raw.invited_by_staff as
      | { display_name: string | null }
      | null;
    return {
      id: String(raw.id),
      email: String(raw.email),
      display_name: String(raw.display_name),
      role: raw.role as StaffRole,
      invited_by_name: invited?.display_name ?? null,
      expires_at: String(raw.expires_at),
      created_at: String(raw.created_at),
    };
  });
}

/** Count of staff per role (for the right-rail roles summary). */
export async function countStaffByRole(): Promise<Record<StaffRole, number>> {
  const fallback: Record<StaffRole, number> = {
    admin: 0,
    editor: 0,
    agent: 0,
    marketing: 0,
    support: 0,
  };
  if (!isSupabaseConfigured) return fallback;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("staff")
    .select("role")
    .eq("status", "active");
  if (error || !data) return fallback;
  for (const row of data) {
    fallback[row.role as StaffRole] += 1;
  }
  return fallback;
}

type AuthMeta = { email: string | null; last_sign_in_at: string | null };

async function fetchAuthMetadata(
  userIds: string[],
): Promise<Map<string, AuthMeta>> {
  const out = new Map<string, AuthMeta>();
  if (userIds.length === 0) return out;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    if (!admin) return out;
    // listUsers paginates at 1000/page — the staff table is tiny, so a
    // single page is fine. Filter client-side to the ids we care about.
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error || !data) return out;
    const wanted = new Set(userIds);
    for (const u of data.users) {
      if (wanted.has(u.id)) {
        out.set(u.id, {
          email: u.email ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
    }
  } catch (err) {
    console.warn("[fetchAuthMetadata]", (err as Error).message);
  }
  return out;
}

/**
 * Auth metadata for one staff member. Uses getUserById rather than paging
 * through listUsers, since the caller already knows the id.
 *
 * `last_sign_in_at` is what tells an admin whether this person has ever
 * actually got in — the question behind sending them a password link.
 */
export async function getStaffAuthMeta(
  userId: string,
): Promise<AuthMeta | null> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    if (!admin) return null;
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    return {
      email: data.user.email ?? null,
      last_sign_in_at: data.user.last_sign_in_at ?? null,
    };
  } catch (err) {
    console.warn("[getStaffAuthMeta]", (err as Error).message);
    return null;
  }
}

/**
 * True if the current session belongs to an admin.
 *
 * Reads the request-cached staff row rather than issuing its own
 * `getUser()` + `staff` select. Ten admin pages `await` this as a gate before
 * fetching anything, so on its own it added two serialised network hops ahead
 * of the real work on each of them — and the layout had already asked the
 * same question.
 */
export async function currentUserIsAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const staff = await getCurrentStaffRow();
  return staff?.role === "admin" && staff?.status === "active";
}

/**
 * Resolve the current user's staff row (null if not staff). Useful for
 * the topbar profile widget too.
 *
 * Returns the row whatever its status — unlike `currentUserIsAdmin` and
 * `getStaffRole`, which require `active`. Callers here use it for identity
 * and for the `canCreateArea` / `canCreateDeveloper` checks, which read a
 * suspended member's row and would change behaviour if it were filtered.
 */
export async function currentStaffRow() {
  if (!isSupabaseConfigured) return null;
  return getCurrentStaffRow();
}
