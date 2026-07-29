import {
  AMENITY_CATEGORIES,
  AMENITY_CATEGORY_LABELS,
  DEFAULT_AMENITIES,
  type AmenityTaxonomyEntry,
} from "@/lib/schemas/amenity-taxonomy";

/**
 * One shared view of the amenity taxonomy, for the three surfaces that used to
 * keep their own hard-coded lists: the property editor's picker, the public
 * property page's "Features & amenities" grid, and the search facet.
 *
 * ── On what gets stored ──────────────────────────────────────────────────
 * `properties.amenities` is a `text[]` of amenity **labels** ("Beach access"),
 * not codes. Every listing in the catalogue is written that way, the search
 * facet matches on it via `contains`, and the public page prints it directly.
 *
 * The design handoff asks for codes — right call for translation and for
 * stable ids — but the taxonomy currently covers 13 of the 42 distinct values
 * in use, so switching storage today would strand the other 84 mentions
 * ("Private garden", "Tennis court", "Marina access"…). Until the taxonomy
 * covers the real vocabulary, the picker writes labels drawn *only* from the
 * taxonomy: agents still can't invent amenities, and the three surfaces still
 * share one source. Moving to codes is then a data backfill plus a change of
 * `valueOf` below, with no UI work.
 */

export type AmenityOption = {
  code: string;
  label: string;
  category: AmenityTaxonomyEntry["category"];
};

export type AmenityGroup = {
  category: AmenityTaxonomyEntry["category"];
  label: string;
  items: AmenityOption[];
};

/** What a selected amenity is persisted as. Swap to `entry.code` on migration. */
export function valueOf(entry: AmenityOption | AmenityTaxonomyEntry): string {
  return entry.label;
}

export function toOptions(
  taxonomy: AmenityTaxonomyEntry[] = DEFAULT_AMENITIES,
): AmenityOption[] {
  return taxonomy
    .filter((t) => t.active !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((t) => ({ code: t.code, label: t.label, category: t.category }));
}

/** Grouped for the picker and the facet — taxonomy order within each group. */
export function groupAmenities(options: AmenityOption[]): AmenityGroup[] {
  return AMENITY_CATEGORIES.map((category) => ({
    category,
    label: AMENITY_CATEGORY_LABELS[category],
    items: options.filter((o) => o.category === category),
  })).filter((g) => g.items.length > 0);
}

/**
 * Split what's stored on a listing into the values the taxonomy knows about
 * and the ones it doesn't.
 *
 * Legacy free-text values are *kept*, not dropped. The handoff says unknown
 * entries should be discarded on write, but 84 of the mentions in the live
 * catalogue are unknown — silently deleting an agent's "Private garden"
 * because it predates the taxonomy is worse than showing it and letting them
 * decide. They render in their own row, marked, with a remove button.
 */
export function splitAmenities(
  stored: string[],
  options: AmenityOption[],
): { known: string[]; unknown: string[] } {
  const byValue = new Map(options.map((o) => [normalise(o.label), o]));
  const byCode = new Map(options.map((o) => [o.code, o]));

  const known: string[] = [];
  const unknown: string[] = [];
  for (const raw of stored) {
    // Codes are accepted on read so a part-migrated row still resolves.
    const hit = byValue.get(normalise(raw)) ?? byCode.get(raw);
    if (hit) known.push(valueOf(hit));
    else if (raw.trim() !== "") unknown.push(raw);
  }
  return { known: dedupe(known), unknown: dedupe(unknown) };
}

/**
 * Stored order follows the taxonomy, not the order things were clicked —
 * it keeps record diffs and audit history readable. Unknown values keep
 * their original order and sit at the end.
 */
export function orderAmenities(
  stored: string[],
  options: AmenityOption[],
): string[] {
  const { known, unknown } = splitAmenities(stored, options);
  const selected = new Set(known);
  const ordered = options.map(valueOf).filter((v) => selected.has(v));
  return [...ordered, ...unknown];
}

/** Display label for a stored value — falls back to the value itself. */
export function amenityLabel(
  value: string,
  options: AmenityOption[],
): string {
  const hit =
    options.find((o) => normalise(o.label) === normalise(value)) ??
    options.find((o) => o.code === value);
  return hit ? hit.label : value;
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
