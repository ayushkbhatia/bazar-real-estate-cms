import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/types";

export type ActiveAdmin = { userId: string; email: string | null };

/**
 * Every active admin (staff role `admin`, status `active`) and the address
 * they sign in with. Read when it is needed, so an admin added or suspended in
 * /admin/users is included or dropped from the next send without anyone
 * touching a list.
 *
 * Takes a service-role client: the email lives in `auth.users`, which only
 * `auth.admin.getUserById` reaches. That is a round trip per admin, made in
 * parallel; the team is a handful of people.
 */
export async function activeAdmins(admin: SupabaseClient<Database>): Promise<ActiveAdmin[]> {
  const { data: staff, error } = await admin
    .from("staff")
    .select("user_id")
    .eq("status", "active")
    .eq("role", "admin");
  if (error || !staff) return [];
  return Promise.all(
    staff.map(async (row) => {
      const { data } = await admin.auth.admin.getUserById(row.user_id);
      return { userId: row.user_id, email: data?.user?.email ?? null };
    }),
  );
}
