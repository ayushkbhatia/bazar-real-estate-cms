/**
 * Inferred brief — what we believe the user wants. Built up over a chat
 * session from explicit messages plus tool outputs. Persisted as jsonb on
 * `concierge_sessions.brief`.
 *
 * Kept extremely permissive: every field is optional, and `chips[]` is the
 * source of truth for the right-rail UI. The structured fields enable the
 * scoring/search tools to query the catalogue.
 */
import { z } from "zod";

export const PROPERTY_MODE_KEYS = ["buy", "rent", "off_plan", "commercial"] as const;

export const briefChipSchema = z.object({
  /** Stable id so the UI can identify chips for removal. */
  id: z.string().min(1).max(60),
  /** Display text in the chip. */
  label: z.string().min(1).max(80),
  /** Which structured field this chip projects onto. */
  field: z.string().max(40).optional(),
});
export type BriefChip = z.infer<typeof briefChipSchema>;

export const conciergeBriefSchema = z.object({
  mode: z.enum(PROPERTY_MODE_KEYS).optional(),
  area_slugs: z.array(z.string().min(1)).max(20).optional(),
  property_types: z.array(z.string()).max(10).optional(),
  beds_min: z.number().int().min(0).max(50).optional(),
  beds_max: z.number().int().min(0).max(50).optional(),
  price_min: z.number().min(0).optional(),
  price_max: z.number().min(0).optional(),
  must_have_amenities: z.array(z.string()).max(30).optional(),
  flags: z
    .object({
      exclusive: z.boolean().optional(),
      vacant_on_transfer: z.boolean().optional(),
      mortgage_eligible: z.boolean().optional(),
    })
    .optional(),
  free_text_hints: z.array(z.string().max(200)).max(20).optional(),
  chips: z.array(briefChipSchema).max(40).default([]),
});

export type ConciergeBrief = z.infer<typeof conciergeBriefSchema>;

/** Deep-merge a partial brief from a tool/LLM update into the current one.
 *  Arrays union (no duplicates). Numbers/booleans/enums replace.   */
export function mergeBrief(
  current: ConciergeBrief | null | undefined,
  patch: Partial<ConciergeBrief>,
): ConciergeBrief {
  const base = current ?? { chips: [] };
  const next: ConciergeBrief = {
    ...base,
    ...patch,
  } as ConciergeBrief;

  // Union string arrays
  if (patch.area_slugs)
    next.area_slugs = unionStrings(base.area_slugs, patch.area_slugs);
  if (patch.property_types)
    next.property_types = unionStrings(base.property_types, patch.property_types);
  if (patch.must_have_amenities)
    next.must_have_amenities = unionStrings(
      base.must_have_amenities,
      patch.must_have_amenities,
    );
  if (patch.free_text_hints)
    next.free_text_hints = unionStrings(base.free_text_hints, patch.free_text_hints);

  // Chips: keep existing, dedupe new ones by id
  const existingChipIds = new Set((base.chips ?? []).map((c) => c.id));
  const newChips = (patch.chips ?? []).filter((c) => !existingChipIds.has(c.id));
  next.chips = [...(base.chips ?? []), ...newChips].slice(0, 40);

  return next;
}

/** Remove a chip from the brief (called when the user clicks the × on a chip). */
export function removeChip(brief: ConciergeBrief, chipId: string): ConciergeBrief {
  const remainingChips = (brief.chips ?? []).filter((c) => c.id !== chipId);
  const removed = (brief.chips ?? []).find((c) => c.id === chipId);
  if (!removed) return brief;

  // Best-effort projection back to the structured fields.
  const next: ConciergeBrief = { ...brief, chips: remainingChips };
  if (removed.field === "area_slugs" && next.area_slugs) {
    next.area_slugs = next.area_slugs.filter(
      (s) => !chipLabelMatchesSlug(removed.label, s),
    );
  }
  if (removed.field === "must_have_amenities" && next.must_have_amenities) {
    next.must_have_amenities = next.must_have_amenities.filter(
      (a) => a.toLowerCase() !== removed.label.toLowerCase(),
    );
  }
  if (removed.field === "beds_min" || removed.field === "beds_max") {
    delete next.beds_min;
    delete next.beds_max;
  }
  if (removed.field === "price_min" || removed.field === "price_max") {
    delete next.price_min;
    delete next.price_max;
  }
  return next;
}

function chipLabelMatchesSlug(label: string, slug: string): boolean {
  const labelNormal = label.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return labelNormal.includes(slug) || slug.includes(labelNormal);
}

function unionStrings(
  a: string[] | undefined,
  b: string[] | undefined,
): string[] {
  const out = new Set<string>();
  for (const v of a ?? []) out.add(v);
  for (const v of b ?? []) out.add(v);
  return Array.from(out);
}
