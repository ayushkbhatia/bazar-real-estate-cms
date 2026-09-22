/**
 * Whether one staff row is on the public site, and if not, why — plus the
 * warning shown before a change takes it off.
 *
 * No imports: this is read by a client component (the users table's row menu)
 * as well as by server ones, so it must not drag a Supabase client into the
 * browser bundle. The counts it formats are gathered server-side in
 * `lib/queries/advisor-assignments.ts`.
 *
 * The rule belongs to Postgres: `staff_public_agents` (0036) hands a row to
 * `anon` only while `role = 'agent' and status = 'active'`. This is that
 * predicate written once for the admin UI, so the two tabs that between them
 * decide an advisor's visibility can both say the same thing about it.
 */

export const STAFF_ROLE_LABEL: Record<string, string> = {
  agent: "Advisor",
  admin: "Admin",
  support: "Support",
  marketing: "Marketing",
  editor: "Editor",
};

/** Null when the row publishes; otherwise the reason it doesn't. */
export function notPublishedReason(row: {
  role: string;
  status: string;
}): string | null {
  if (row.status !== "active")
    return row.status === "invited"
      ? "Hasn't accepted their invite yet"
      : "Suspended in Users & roles";
  if (row.role !== "agent")
    return `Role is ${STAFF_ROLE_LABEL[row.role] ?? row.role} — only Advisors publish`;
  return null;
}

export type AdvisorAssignmentCounts = {
  /** Published listings whose `assigned_agent_id` is this user. */
  properties: number;
  /** Published projects whose `lead_advisor_id` is this user. */
  developments: number;
};

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
