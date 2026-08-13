import { z } from "zod";
import { uuidLike } from "@/lib/uuid";

/**
 * Unit types and the floor plans under them — `developments > unit types >
 * floor plans`.
 *
 * These live in their own tables rather than in the page's section document
 * (the way named features and FAQs do) for two reasons: a floor plan points at
 * a `media_assets` row, and a foreign key is a better guarantee than a jsonb
 * string; and the same records will be wanted by search and by the concierge,
 * neither of which should have to parse a page document to find them.
 *
 * See `supabase/migrations/0079_development_unit_types.sql` for why this is a
 * separate table from `development_units` (that one is sales inventory).
 */

/** Most layout rows the page shows for one unit type. Design constraint. */
export const MAX_PLANS_SHOWN = 4;
/** How many can be *stored*, so an editor can stage next quarter's release. */
export const MAX_PLANS_PER_TYPE = 8;
export const MAX_UNIT_TYPES = 10;

/**
 * Not a product limit. Bedroom and bathroom counts are deliberately uncapped —
 * a villa floor can carry more baths than anyone provisions for up front, and
 * an editor blocked by a guessed ceiling has no way around it. This is the
 * `int4` ceiling of the columns behind them, so a mistyped 99999999999 fails
 * in the editor with a readable message instead of a raw Postgres 22003 from
 * the insert.
 */
const INT4_MAX = 2_147_483_647;

export const floorPlanSchema = z.object({
  /** Null for a row that hasn't been saved yet. */
  id: uuidLike().nullable(),
  label: z.string().min(1, "Give the layout a name").max(80),
  label_ar: z.string().max(120).nullable(),
  description: z.string().max(600).nullable(),
  description_ar: z.string().max(900).nullable(),
  beds: z.number().int().min(0).max(INT4_MAX).nullable(),
  baths: z.number().int().min(0).max(INT4_MAX).nullable(),
  area_ft2: z.number().int().min(0).max(1_000_000).nullable(),
  /** Media asset id — the plan drawing, picked from the media library. */
  media_id: uuidLike().nullable(),
  enabled: z.boolean(),
});

export type FloorPlanInput = z.infer<typeof floorPlanSchema>;

export const unitTypeSchema = z.object({
  id: uuidLike().nullable(),
  label: z.string().min(1, "Name the unit type").max(60),
  /* Arabic twins are required-with-null. Both row builders in _unit-actions.ts
   * name every column explicitly and re-write the whole row on update, so a
   * twin missing from the payload is a twin overwritten — the same shape as
   * the megamenu, not the partial-update tables. Caps are 1.5x the English. */
  label_ar: z.string().max(90).nullable(),
  beds: z.number().int().min(0).max(INT4_MAX).nullable(),
  blurb: z.string().max(600).nullable(),
  blurb_ar: z.string().max(900).nullable(),
  size_from_ft2: z.number().int().min(0).max(1_000_000).nullable(),
  size_to_ft2: z.number().int().min(0).max(1_000_000).nullable(),
  price_from_aed: z.number().min(0).max(9_999_999_999).nullable(),
  enabled: z.boolean(),
  plans: z.array(floorPlanSchema).max(MAX_PLANS_PER_TYPE),
});

export type UnitTypeInput = z.infer<typeof unitTypeSchema>;

export const unitPlansSchema = z
  .object({ unit_types: z.array(unitTypeSchema).max(MAX_UNIT_TYPES) })
  .superRefine((value, ctx) => {
    // The database has a unique index on (development_id, lower(label)); catch
    // it here so the editor can point at the offending row instead of showing
    // a raw 23505.
    const seen = new Set<string>();
    value.unit_types.forEach((t, i) => {
      const key = t.label.trim().toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["unit_types", i, "label"],
          message: `"${t.label.trim()}" is already used by another unit type.`,
        });
      }
      seen.add(key);

      if (
        t.size_from_ft2 != null &&
        t.size_to_ft2 != null &&
        t.size_from_ft2 > t.size_to_ft2
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["unit_types", i, "size_to_ft2"],
          message: "The upper size is below the lower one.",
        });
      }
    });
  });

export type UnitPlansInput = z.infer<typeof unitPlansSchema>;

// ── blanks ───────────────────────────────────────────────────────────────

export function blankPlan(index: number): FloorPlanInput {
  return {
    id: null,
    label: `Layout ${String.fromCharCode(65 + index)}`,
    label_ar: null,
    description: null,
    description_ar: null,
    beds: null,
    baths: null,
    area_ft2: null,
    media_id: null,
    enabled: true,
  };
}

export function blankUnitType(label = "", beds: number | null = null): UnitTypeInput {
  return {
    id: null,
    label,
    label_ar: null,
    beds,
    blurb: null,
    blurb_ar: null,
    size_from_ft2: null,
    size_to_ft2: null,
    price_from_aed: null,
    enabled: true,
    plans: [blankPlan(0)],
  };
}

/** Label for a bedroom count. 0 is a studio; the rest read as written. */
export function unitTypeLabel(beds: number): string {
  return beds === 0 ? "Studio" : `${beds} Bedroom`;
}

/**
 * One-click shortcuts for the "add a unit type" menu — the counts almost every
 * project sells. Not a limit: the menu's "Something else" chip adds a type with
 * a free-text label, and the bedroom field on the type takes any number.
 */
export const UNIT_TYPE_CHOICES: { beds: number; label: string }[] = [
  0, 1, 2, 3, 4, 5, 6, 7,
].map((beds) => ({ beds, label: unitTypeLabel(beds) }));

// ── deriving a starting set ──────────────────────────────────────────────

/**
 * Read a development's `bedrooms_text` into the unit types it implies.
 *
 * The stored strings are hand-typed and inconsistent — "1–4 bed", "1 - 3",
 * "Studios, 1 - 4", and one "1313" that is plainly a typo. So:
 *
 *  - only *standalone* single digits count, which is what keeps "1313" from
 *    reading as a 1-bed and a 3-bed. The guard is the lookarounds, not the
 *    digit range, so widening the range past what the brief provisioned for
 *    costs nothing;
 *  - "studio" anywhere adds a studio type;
 *  - nothing parseable falls back to 1-3 Bedroom — the commonest shape here,
 *    offered as a starting point rather than a claim.
 *
 * Mirrored in SQL by `supabase/migrations/0081_backfill_unit_types.sql`, which
 * seeds the same set once for the projects that predate the feature. This is
 * the copy that stays live: it backs both the CMS's "add the suggested unit
 * types" button and the public page's fallback for a project with no records.
 */
export function deriveUnitTypeSeeds(bedroomsText: string | null): {
  beds: number;
  label: string;
}[] {
  const text = bedroomsText ?? "";
  const numbers = [...text.matchAll(/(?:^|[^0-9])([1-9])(?![0-9])/g)].map((m) =>
    Number(m[1]),
  );

  const beds: number[] = [];
  if (/studio/i.test(text)) beds.push(0);

  const lo = numbers.length ? Math.min(...numbers) : 1;
  const hi = numbers.length ? Math.max(...numbers) : 3;
  for (let n = lo; n <= hi; n += 1) beds.push(n);

  return beds.map((n) => ({ beds: n, label: unitTypeLabel(n) }));
}

/** Placeholder copy for a seeded type — the same words the SQL backfill uses. */
export function placeholderBlurb(beds: number | null): string {
  const noun =
    beds === 0
      ? "studios"
      : beds != null
        ? `${beds}-bedroom homes`
        : "these homes";
  return `Placeholder copy — say what sets the ${noun} apart: aspect, ceiling height, terrace depth, who they suit.`;
}

export const PLACEHOLDER_PLAN_DESCRIPTION =
  "Placeholder layout — upload the plan drawing and describe how it differs from the others in this unit type.";

/** The starting set the CMS button writes and the public page falls back to. */
export function seedUnitTypes(bedroomsText: string | null): UnitTypeInput[] {
  return deriveUnitTypeSeeds(bedroomsText).map((t) => ({
    ...blankUnitType(t.label, t.beds),
    blurb: placeholderBlurb(t.beds),
    blurb_ar: null,
    plans: [0, 1].map((i) => ({
      ...blankPlan(i),
      beds: t.beds,
      description: PLACEHOLDER_PLAN_DESCRIPTION,
    })),
  }));
}
