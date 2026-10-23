/** One record that sits in an area, enough to name it and open its editor. */
export type AreaUsageItem = { id: string; label: string; href: string };

export type AreaUsageGroup = {
  count: number;
  /** The first few, alphabetically — `count` is the real total. */
  sample: AreaUsageItem[];
};

/**
 * Everything that would be left pointing at nothing if an area were deleted.
 *
 * `properties`, `developments` and `children` BLOCK a delete: each places a
 * record in the area, and losing that link takes the record out of every area
 * filter, breadcrumb and map. Only what is live counts — a published listing,
 * a published project — plus any area inside it. Migrations 0167 and 0170
 * refuse the delete in the database too; this is what lets the CMS say so —
 * and say which records — before anyone presses the button.
 *
 * `unpublished` only warns. Drafts, listings in review, off-market, archived
 * or soft-deleted ones and unpublished projects are on no public page, so
 * they don't hold the area; the delete detaches them (0170) and they need an
 * area again before they go live.
 *
 * `menuLinks` only warns. A megamenu item, featured tile or footer link to
 * `/areas/<slug>` would 404 afterwards, but it is the editor's to fix and not
 * a reason the catalogue can't be tidied.
 */
export type AreaUsage = {
  properties: AreaUsageGroup;
  developments: AreaUsageGroup;
  children: AreaUsageGroup;
  unpublished: {
    properties: AreaUsageGroup;
    developments: AreaUsageGroup;
  };
  menuLinks: number;
};

export const EMPTY_AREA_USAGE: AreaUsage = {
  properties: { count: 0, sample: [] },
  developments: { count: 0, sample: [] },
  children: { count: 0, sample: [] },
  unpublished: {
    properties: { count: 0, sample: [] },
    developments: { count: 0, sample: [] },
  },
  menuLinks: 0,
};

/** True when nothing still places a record in the area. */
export function areaIsDeletable(usage: AreaUsage): boolean {
  return (
    usage.properties.count +
      usage.developments.count +
      usage.children.count ===
    0
  );
}

/**
 * "3 published listings, 1 published project and 2 areas inside it" — or null
 * when there are none. Worded as 0170's trigger words its refusal.
 */
export function describeAreaBlockers(usage: AreaUsage): string | null {
  const parts = [
    plural(usage.properties.count, "published listing", "published listings"),
    plural(usage.developments.count, "published project", "published projects"),
    usage.children.count > 0
      ? `${plural(usage.children.count, "area", "areas")} inside it`
      : null,
  ].filter((p): p is string => p !== null);
  return joinParts(parts);
}

/** "2 unpublished listings and 1 unpublished project" — or null when there are none. */
export function describeUnpublished(usage: AreaUsage): string | null {
  return joinParts(
    [
      plural(
        usage.unpublished.properties.count,
        "unpublished listing",
        "unpublished listings",
      ),
      plural(
        usage.unpublished.developments.count,
        "unpublished project",
        "unpublished projects",
      ),
    ].filter((p): p is string => p !== null),
  );
}

function joinParts(parts: string[]): string | null {
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function plural(n: number, one: string, many: string): string | null {
  return n > 0 ? `${n} ${n === 1 ? one : many}` : null;
}
