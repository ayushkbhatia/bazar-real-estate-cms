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
 * covers the real vocabulary, the picker writes labels. Anything typed that
 * the taxonomy already knows resolves back to the taxonomy's own spelling (see
 * `addCustomAmenity`), so the three surfaces still share one source; a genuinely
 * new value is stored verbatim and rendered verbatim. Moving to codes is then a
 * data backfill plus a change of `valueOf` below, with no UI work.
 */

export type AmenityOption = {
  code: string;
  /**
   * The English label, and — because `valueOf` returns it — the value stored
   * on `properties.amenities` and carried in the `?amenities=` param. It is an
   * identity as much as a word, so it never folds to the request locale.
   */
  label: string;
  /** The words to SHOW on /ar. Null where the taxonomy has no Arabic yet. */
  label_ar: string | null;
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
  const seen = new Set<string>();
  return taxonomy
    .filter((t) => t.active !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((t) => ({
      code: t.code,
      label: t.label,
      label_ar: t.label_ar ?? null,
      category: t.category,
    }))
    // The taxonomy is admin-editable and holds distinct *codes*, so the same
    // label can exist twice ("playground" / "playgroundd"). We store labels,
    // so a duplicate label is one amenity wearing two hats: it renders as two
    // identical cards and — because `orderAmenities` walks the options — it
    // writes itself into the listing twice, spending two slots of the cap for
    // one visible selection. Lowest sort_order wins.
    .filter((o) => {
      const key = normalise(o.label);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
  const ordered = dedupeBy(
    options.map(valueOf).filter((v) => selected.has(v)),
    normalise,
  );
  return [...ordered, ...unknown];
}

/**
 * Ceilings for a stored amenity list. `propertyAmenitiesSchema` in
 * `lib/schemas/property.ts` imports these rather than restating them — the
 * client pre-checks with the constants and the server re-validates with the
 * schema, and they can no longer drift apart.
 *
 * The list cap is 100. It sits deliberately clear of any round number an
 * agent might be aiming for, so a stray extra entry can't reject a selection
 * the picker is reporting as under the limit — the failure mode from back when
 * the two sides were both pinned to 50.
 */
export const MAX_AMENITIES = 100;
export const MAX_AMENITY_LENGTH = 50;

/**
 * Tidy a stored list: collapse runs of whitespace, trim, drop blanks, and
 * de-duplicate case-insensitively (first spelling wins). Deliberately does
 * *not* truncate over-long entries — the schema should surface that as a
 * validation error rather than silently cutting an agent's text in half.
 */
export function normaliseAmenityList(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.replace(/\s+/g, " ").trim();
    if (value === "") continue;
    const key = normalise(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export type AddAmenityResult =
  | { ok: true; next: string[]; matched: AmenityOption | null }
  | {
      ok: false;
      reason: "empty" | "too_long" | "duplicate" | "limit";
      message: string;
    };

/**
 * Add a free-text amenity to a listing's stored list.
 *
 * The taxonomy stays the curated vocabulary — it drives the search facet and
 * the comparison table — but a lister needs to be able to describe a villa
 * with a "Rooftop cinema" without waiting on an admin. So: if what they typed
 * already exists in the taxonomy (by label or by code, case-insensitively) we
 * select that entry instead of storing a second spelling of it, and only a
 * genuinely new value is stored as free text.
 */
export function addCustomAmenity(
  stored: string[],
  raw: string,
  options: AmenityOption[],
): AddAmenityResult {
  const value = raw.replace(/\s+/g, " ").trim();
  if (value === "") {
    return { ok: false, reason: "empty", message: "Type an amenity name." };
  }
  if (value.length > MAX_AMENITY_LENGTH) {
    return {
      ok: false,
      reason: "too_long",
      message: `Keep it to ${MAX_AMENITY_LENGTH} characters or fewer.`,
    };
  }

  const matched =
    options.find((o) => normalise(o.label) === normalise(value)) ??
    options.find((o) => o.code === normalise(value).replace(/ /g, "_")) ??
    null;
  const candidate = matched ? valueOf(matched) : value;

  if (stored.some((s) => normalise(s) === normalise(candidate))) {
    return {
      ok: false,
      reason: "duplicate",
      message: `“${candidate}” is already on this listing.`,
    };
  }
  if (normaliseAmenityList(stored).length >= MAX_AMENITIES) {
    return {
      ok: false,
      reason: "limit",
      message: `Maximum ${MAX_AMENITIES} amenities.`,
    };
  }

  // orderAmenities re-sorts taxonomy values and keeps custom ones at the end.
  return {
    ok: true,
    next: orderAmenities([...stored, candidate], options),
    matched,
  };
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

/** Dedupe on a derived key, keeping the first spelling seen. */
function dedupeBy(values: string[], key: (v: string) => string): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const k = key(v);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
