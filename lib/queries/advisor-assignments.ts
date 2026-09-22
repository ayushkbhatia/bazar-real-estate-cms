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
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type AdvisorAssignmentCounts = {
  /** Published listings whose `assigned_agent_id` is this user. */
  properties: number;
  /** Published projects whose `lead_advisor_id` is this user. */
  developments: number;
};

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

/**
 * The sentence a confirmation dialog shows, or null when the change takes
 * nothing off the site.
 *
 * `nextRole`/`nextStatus` are what the row would become. Publishable means
 * exactly what the RLS policy means by it.
 */
export function unpublishWarning(opts: {
  displayName: string;
  currentRole: string;
  currentStatus: string;
  nextRole?: string;
  nextStatus?: string;
  counts: AdvisorAssignmentCounts | undefined;
}): string | null {
  const publishable = (role: string, status: string) =>
    role === "agent" && status === "active";
  const was = publishable(opts.currentRole, opts.currentStatus);
  const will = publishable(
    opts.nextRole ?? opts.currentRole,
    opts.nextStatus ?? opts.currentStatus,
  );
  if (!was || will) return null;

  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;

  const lines = [
    `${opts.displayName} will come off the public site.`,
    "",
    "Their /agents profile stops rendering, and they disappear from the advisor list.",
  ];
  if (!opts.counts) {
    // Undefined is "the count failed", not "the count is zero" — claiming
    // nothing is assigned is exactly the kind of confident wrong answer this
    // dialog exists to prevent.
    lines.push(
      "Couldn't check which listings and projects are assigned to them.",
    );
  } else {
    const { properties: p, developments: d } = opts.counts;
    if (p > 0)
      lines.push(
        `${plural(p, "published listing", "published listings")} will lose the advisor card entirely.`,
      );
    if (d > 0)
      lines.push(
        `${plural(d, "published project", "published projects")} will lose the lead-advisor band.`,
      );
    if (p === 0 && d === 0)
      lines.push("No listings or projects are assigned to them.");
  }
  lines.push("", "Their profile is kept and nothing is deleted. Continue?");
  return lines.join("\n");
}
