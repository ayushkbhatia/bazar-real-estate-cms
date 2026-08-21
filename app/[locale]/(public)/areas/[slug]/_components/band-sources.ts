/**
 * Where each seed-fed band gets its content: the CMS first, the seed behind it.
 *
 * The four bands below — schools, amenities, the commute chips and the dining
 * picks — drew straight from `lib/seeds/areas.ts` until now, which meant their
 * content was English editorial in a code file with no field behind it. Each
 * one gained a list in `AREA_SECTIONS`, and these functions are the join: an
 * empty list means "nothing stored", which falls back to the seed, exactly as
 * a blank text field on any other band does.
 *
 * Empty rather than absent is the test on purpose. `resolveSections` gives a
 * section its declared default (`[]`) when the document has never been saved,
 * so "no rows" and "never edited" arrive identically — and both should show
 * the shipped content rather than an empty column.
 *
 * They live here rather than in `page.tsx` because the fallback rule is the
 * part worth pinning, and a route module is an awkward place to test.
 */
import { list, type SectionValues } from "@/lib/master-pages";
import type { AreaProfile } from "@/lib/queries/area-profile";
import type { CommuteChip, DiningPick } from "./lifestyle-dossier";

/** A row is live unless it was switched off, and needs a name. */
function rows<T extends { enabled?: boolean }>(
  values: SectionValues,
  key: string,
  named: (row: T) => string | undefined,
): T[] {
  return list<T>(values, key).filter(
    (r) => r.enabled !== false && (named(r) ?? "").trim() !== "",
  );
}

/**
 * The schools and amenities columns, CMS over seed.
 *
 * Both used to read `profile.schools` / `profile.amenities` directly, which
 * are seed-only — English editorial in a code file with no field behind it.
 * The seed stays as the fallback, and `localiseSeed` has already folded it to
 * Arabic by the time it arrives here.
 */
export function liveSchools(
  values: SectionValues,
  fallback: AreaProfile["schools"],
): AreaProfile["schools"] {
  const found = rows<{
    enabled?: boolean;
    name?: string;
    curriculum?: string;
    rating?: string;
    distance?: string;
  }>(values, "schools", (r) => r.name);
  if (found.length === 0) return fallback;
  return found.map((r) => ({
    name: r.name!,
    curriculum: r.curriculum?.trim() || null,
    // Typed as text so the editor can leave it blank; only a real number
    // reaches the "1.2 km" line.
    distance_km: Number.isFinite(Number(r.distance)) && r.distance?.trim()
      ? Number(r.distance)
      : null,
    rating: r.rating?.trim() || null,
  }));
}

export function liveAmenities(values: SectionValues, fallback: string[]): string[] {
  const found = rows<{ enabled?: boolean; name?: string }>(
    values,
    "amenities",
    (r) => r.name,
  );
  return found.length > 0 ? found.map((r) => r.name!) : fallback;
}

/** The dossier's commute chips, CMS over seed. */
export function liveChips(values: SectionValues): CommuteChip[] | null {
  const found = rows<{
    enabled?: boolean;
    label?: string;
    minutes?: string;
    mode?: string;
  }>(values, "chips", (r) => r.label);
  if (found.length === 0) return null;
  return found.map((r) => ({
    label: r.label!,
    minutes: Number(r.minutes) || 0,
    mode: r.mode === "metro" || r.mode === "walk" ? r.mode : "car",
  }));
}

/** The dossier's dining picks, CMS over seed. */
export function liveDining(values: SectionValues): DiningPick[] | null {
  const found = rows<{
    enabled?: boolean;
    name?: string;
    kind?: string;
    note?: string;
  }>(values, "dining", (r) => r.name);
  if (found.length === 0) return null;
  return found.map((r) => ({
    name: r.name!,
    kind: r.kind ?? "",
    note: r.note ?? "",
  }));
}
