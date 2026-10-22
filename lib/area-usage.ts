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
 * filter, breadcrumb and map. Migration 0167 refuses the delete in the
 * database too; this is what lets the CMS say so — and say which records —
 * before anyone presses the button.
 *
 * `menuLinks` only warns. A megamenu item, featured tile or footer link to
 * `/areas/<slug>` would 404 afterwards, but it is the editor's to fix and not
 * a reason the catalogue can't be tidied.
 */
export type AreaUsage = {
  properties: AreaUsageGroup;
  developments: AreaUsageGroup;
  children: AreaUsageGroup;
  menuLinks: number;
};

export const EMPTY_AREA_USAGE: AreaUsage = {
  properties: { count: 0, sample: [] },
  developments: { count: 0, sample: [] },
  children: { count: 0, sample: [] },
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

/** "3 listings, 1 project and 2 areas inside it" — or null when there are none. */
export function describeAreaBlockers(usage: AreaUsage): string | null {
  const parts = [
    plural(usage.properties.count, "listing", "listings"),
    plural(usage.developments.count, "project", "projects"),
    usage.children.count > 0
      ? `${plural(usage.children.count, "area", "areas")} inside it`
      : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function plural(n: number, one: string, many: string): string | null {
  return n > 0 ? `${n} ${n === 1 ? one : many}` : null;
}
