import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/schemas/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MortgageTeamRole = "head" | "adviser";

/**
 * The signed-in member's mortgage role (decision D9), or null.
 *
 * Asked of the database (`mortgage_role()`, 0138) rather than read off the
 * staff row: the policies use the same function, so the nav and the data can't
 * disagree about who is on the team. Never throws — the admin layout asks on
 * every page, and a missing function (a deployment ahead of its migration) or
 * a blip must cost the nav item, not the CMS.
 */
export const getMortgageRole = cache(async (): Promise<MortgageTeamRole | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("mortgage_role");
    if (error) return null;
    return (data as MortgageTeamRole | null) ?? null;
  } catch {
    return null;
  }
});

/** What the CMS nav needs: the caller's role and the count of new requests, or null off the team. */
export async function getMortgageNav(): Promise<{ role: MortgageTeamRole; newCount: number } | null> {
  const role = await getMortgageRole();
  if (!role) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { count, error } = await supabase
      .from("mortgage_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    return { role, newCount: error ? 0 : (count ?? 0) };
  } catch {
    return { role, newCount: 0 };
  }
}

/**
 * The gate for every /admin/mortgages page and action: an active member of
 * staff with a mortgage role. Everyone else — admins included (D10) — gets the
 * same 404 as a page that doesn't exist.
 */
export async function requireMortgageRole() {
  const { user, staff, supabase } = await requireRole(STAFF_ROLES);
  const role = await getMortgageRole();
  if (!role) notFound();
  return { user, staff, supabase, role };
}
