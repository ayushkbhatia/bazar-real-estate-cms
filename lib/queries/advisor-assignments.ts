/**
 * How much of the public site one staff member is currently the face of.
 *
 * Two admin tabs write the same `staff` row. **Agents & team** owns the
 * content of an advisor block — name, title, BRN, bio, photo, contact
 * details. **Users & roles** owns `role` and `status`, and the
 * `staff_public_agents` policy (0036) hands a row to `anon` only while
 * `role = 'agent' and status = 'active'`. So a role change or a suspension
 * made on the second tab silently unpublishes work done on the first, and
 * takes the advisor off every listing and project they are assigned to.
 *
 * Nothing in the UI said so. This is the number that lets it.
 *
 * Server-only — it opens a Supabase client. The predicate and the warning
 * wording live in `lib/staff-publishing.ts`, which the users table's row menu
 * imports from the browser.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { AdvisorAssignmentCounts } from "@/lib/staff-publishing";

export type AssignmentsByUser = Record<string, AdvisorAssignmentCounts>;

/**
 * Assignment counts for every staff member at once — two aggregate reads, not
 * one per row, because the users table renders the whole roster.
 *
 * Counts only what the public can see: an unpublished listing loses nothing
 * when its advisor is suspended, so warning about it would be noise.
 */
export async function countAdvisorAssignments(): Promise<AssignmentsByUser> {
  if (!isSupabaseConfigured) return {};
  const out: AssignmentsByUser = {};
  const bump = (
    id: string | null,
    key: keyof AdvisorAssignmentCounts,
  ): void => {
    if (!id) return;
    out[id] ??= { properties: 0, developments: 0 };
    out[id][key] += 1;
  };

  try {
    const supabase = await createSupabaseServerClient();
    const [properties, developments] = await Promise.all([
      supabase
        .from("properties")
        .select("assigned_agent_id")
        .eq("status", "published")
        .not("assigned_agent_id", "is", null),
      supabase
        .from("developments")
        .select("lead_advisor_id")
        .not("published_at", "is", null)
        .not("lead_advisor_id", "is", null),
    ]);
    for (const r of properties.data ?? []) bump(r.assigned_agent_id, "properties");
    for (const r of developments.data ?? []) bump(r.lead_advisor_id, "developments");
  } catch (error) {
    // A count we could not take must not block the page that shows the
    // roster; the warning simply doesn't name a number.
    console.error("[countAdvisorAssignments]", error);
  }
  return out;
}
