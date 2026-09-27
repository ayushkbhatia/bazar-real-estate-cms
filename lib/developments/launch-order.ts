/**
 * The order /off-plan/launches shows its projects in.
 *
 * Two inputs: the published projects, newest first (`listPublishedDevelopments`
 * order), and the "Lead with" list from the All launches master page. The list
 * is curation over a catalogue that keeps moving, so it can only ever ADD an
 * order on top of the automatic one — never freeze it:
 *
 *  - a picked project leads, in the order it was picked;
 *  - everything else follows in the order it arrived, so a project published
 *    tomorrow appears without anyone adding it;
 *  - a project is only dropped by being picked and switched off.
 *
 * The same rules `applyOffplanAreaOrder` gives the map's area list, for the
 * same reason. A pick whose project is unpublished, renamed or deleted resolves
 * to nothing and is skipped rather than rendered as a card linking nowhere.
 */

/**
 * One row of the "Lead with" list. Values arrive from the CMS as loose JSON,
 * hence the `unknown`s.
 */
export type LaunchPick = { slug?: unknown; enabled?: unknown };

export function orderLaunches<T extends { slug: string }>(
  projects: readonly T[],
  picks: readonly LaunchPick[],
): T[] {
  const hidden = new Set<string>();
  const pinned: string[] = [];
  for (const pick of picks) {
    const slug = typeof pick.slug === "string" ? pick.slug.trim() : "";
    if (!slug) continue;
    if (pick.enabled === false) hidden.add(slug);
    else if (!pinned.includes(slug)) pinned.push(slug);
  }
  // A slug listed twice, once off, stays off: the explicit hide wins over the
  // position, so a stale duplicate further up cannot undo a switched-off row.
  const bySlug = new Map(projects.map((p) => [p.slug, p]));
  const lead = pinned
    .filter((slug) => !hidden.has(slug))
    .flatMap((slug) => {
      const project = bySlug.get(slug);
      return project ? [project] : [];
    });
  const leadSlugs = new Set(lead.map((p) => p.slug));
  return [
    ...lead,
    ...projects.filter((p) => !leadSlugs.has(p.slug) && !hidden.has(p.slug)),
  ];
}

/** How many distinct communities the projects sit in; unplaced ones count none. */
export function communityCount(
  projects: readonly { area: { slug: string } | null }[],
): number {
  return new Set(projects.flatMap((p) => (p.area ? [p.area.slug] : []))).size;
}
