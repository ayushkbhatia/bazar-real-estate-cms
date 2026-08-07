import { z } from "zod";
import { uuidLikeOrEmpty } from "@/lib/uuid";

/**
 * Area records — the catalogue rows behind `/areas/<slug>` guides.
 *
 * Mirrors `lib/schemas/development.ts`: one schema for the create wizard, a
 * wider one for the record editor, and a normaliser that turns form strings
 * into what Postgres wants.
 */

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const uuidOrEmpty = uuidLikeOrEmpty();

export const AREA_KINDS = [
  "emirate",
  "area",
  "sub_community",
  "building",
] as const;
export type AreaKind = (typeof AREA_KINDS)[number];

/**
 * Who may create or edit an area. Lives here rather than beside the actions
 * so screens that merely *offer* the control (the property wizard) can check
 * it too — `requireRole` answers a refusal with a 404, which reads as a broken
 * page rather than a permission boundary.
 */
export const AREA_EDIT_ROLES = ["admin", "editor", "marketing"] as const;

export const AREA_KIND_LABELS: Record<AreaKind, string> = {
  emirate: "Emirate",
  area: "Area",
  sub_community: "Sub-community",
  building: "Building",
};

/** Fields the "Add area" wizard collects. */
export const areaCreateSchema = z.object({
  name: z.string().min(2, "Name is too short").max(120, "Name is too long"),
  slug: z
    .string()
    .min(2, "Slug is too short")
    .max(120, "Slug is too long")
    .regex(slugRegex, "Lowercase letters, numbers and hyphens only"),
  kind: z.enum(AREA_KINDS),
  parent_id: uuidOrEmpty,
});

export type AreaCreateInput = z.infer<typeof areaCreateSchema>;

/** The record editor — everything on the row that a human sets. */
export const areaEditSchema = areaCreateSchema.extend({
  description: z.string().max(2000).nullable().optional(),
  meta_title: z.string().max(70).nullable().optional(),
  meta_description: z.string().max(180).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

export type AreaEditInput = z.infer<typeof areaEditSchema>;

const NULLABLE_TEXT = [
  "description",
  "meta_title",
  "meta_description",
  "parent_id",
] as const;

const NULLABLE_NUMBER = ["lat", "lng"] as const;

/** Blank inputs become null; numeric strings become numbers. */
export function normaliseAreaInput(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  for (const k of NULLABLE_TEXT) {
    const v = out[k];
    if (v === "" || v === undefined) out[k] = null;
  }
  for (const k of NULLABLE_NUMBER) {
    const v = out[k];
    if (v === "" || v === undefined || v === null) {
      out[k] = null;
    } else if (typeof v === "string") {
      const n = Number(v);
      out[k] = Number.isNaN(n) ? null : n;
    }
  }
  for (const k of ["name", "slug"] as const) {
    const v = out[k];
    if (typeof v === "string") out[k] = v.trim();
  }
  return out;
}

/**
 * An area can't be its own parent, and a parent has to sit above it in the
 * hierarchy — a building under a sub-community, not the reverse. Enforced here
 * rather than in the database so the editor can explain it.
 */
const RANK: Record<AreaKind, number> = {
  emirate: 0,
  area: 1,
  sub_community: 2,
  building: 3,
};

export function parentError(opts: {
  id?: string | null;
  kind: AreaKind;
  parentId: string | null;
  parentKind: AreaKind | null;
}): string | null {
  if (!opts.parentId) return null;
  if (opts.id && opts.parentId === opts.id)
    return "An area can't be its own parent.";
  if (!opts.parentKind) return null;
  if (RANK[opts.parentKind] >= RANK[opts.kind])
    return `A ${AREA_KIND_LABELS[opts.kind].toLowerCase()} must sit under something broader than a ${AREA_KIND_LABELS[opts.parentKind].toLowerCase()}.`;
  return null;
}
