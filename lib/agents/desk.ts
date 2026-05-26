/**
 * T3-A: derive an advisor's desk from their title.
 *
 * Until the staff schema grows a first-class `desk` enum, we infer the
 * grouping from the title string. The four desks track Bazar's actual
 * org chart:
 *
 *   - leadership · Managing Director, partners
 *   - buy-side   · Senior Advisors representing buyers + general resale
 *   - off-plan   · Off-plan and investment desk
 *   - lettings   · Tenant + landlord desk
 *
 * Keep this pure (no DB / network) so the page can use it inside a
 * groupBy without a round-trip.
 */

export type Desk = "leadership" | "buy-side" | "off-plan" | "lettings";

export const DESK_LABEL: Record<Desk, string> = {
  leadership: "Leadership",
  "buy-side": "Buy-side advisors",
  "off-plan": "Off-plan & investment",
  lettings: "Lettings & tenant desk",
};

export const DESK_INTRO: Record<Desk, string> = {
  leadership:
    "Partners and managing directors. They take the briefs that don't fit any one desk.",
  "buy-side":
    "Senior advisors who represent buyers across freehold Abu Dhabi. One advisor, one brief, one negotiation.",
  "off-plan":
    "Yield-modelled off-plan selection and investment-thesis work for AED 2M+ acquisitions.",
  lettings:
    "Tenant representation, landlord asset management, and renewal cycles.",
};

/**
 * Display order on the team page — leadership first, then the three
 * advisory desks in the rough order a buyer encounters them.
 */
export const DESK_ORDER: Desk[] = [
  "leadership",
  "buy-side",
  "off-plan",
  "lettings",
];

const RX_LEADERSHIP = /managing director|partner|founder|principal/i;
const RX_OFFPLAN = /off-?plan|investment/i;
const RX_LETTINGS = /tenant|rental|landlord|letting/i;

export function deskForTitle(title: string | null | undefined): Desk {
  if (!title) return "buy-side";
  if (RX_LEADERSHIP.test(title)) return "leadership";
  if (RX_OFFPLAN.test(title)) return "off-plan";
  if (RX_LETTINGS.test(title)) return "lettings";
  return "buy-side";
}

/**
 * Group a list of advisors by their derived desk. Returns an array of
 * `[desk, advisors[]]` tuples in `DESK_ORDER`, skipping empty desks.
 */
export function groupByDesk<T extends { title: string | null }>(
  agents: T[],
): [Desk, T[]][] {
  const buckets = new Map<Desk, T[]>();
  for (const a of agents) {
    const d = deskForTitle(a.title);
    const bucket = buckets.get(d) ?? [];
    bucket.push(a);
    buckets.set(d, bucket);
  }
  return DESK_ORDER.filter((d) => (buckets.get(d) ?? []).length > 0).map(
    (d) => [d, buckets.get(d)!],
  );
}

/**
 * Pick the "advisor of the month" deterministically — same advisor for the
 * whole calendar month, rotating month-over-month through the active list.
 * Leadership is skipped (it's almost always Rashid; let the senior advisors
 * have the spotlight).
 */
export function advisorOfMonth<T extends { title: string | null }>(
  agents: T[],
  now: Date = new Date(),
): T | null {
  const eligible = agents.filter((a) => deskForTitle(a.title) !== "leadership");
  if (eligible.length === 0) return null;
  // Month number since epoch — stable across days within a month, increments
  // by 1 each month so the spotlight rotates predictably.
  const monthIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  return eligible[monthIndex % eligible.length] ?? null;
}
