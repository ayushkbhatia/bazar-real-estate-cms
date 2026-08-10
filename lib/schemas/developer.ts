import { z } from "zod";
import { slugify } from "@/lib/slug";

/**
 * Who may extend or edit the developer catalogue.
 *
 * The RLS policy behind `developers` (`developers_staff_write`, migration
 * 0001) is `for all to authenticated using (public.is_staff())`, which any
 * active staff member satisfies — including agent and support. This list is
 * the only thing narrowing that, so it lives here rather than beside the
 * actions: a screen that merely *offers* the control needs to check it too.
 * `requireRole` answers a refusal with a 404, which reads as a broken page
 * rather than a permission boundary.
 */
export const DEVELOPER_EDIT_ROLES = ["admin", "editor", "marketing"] as const;

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The one field the quick-add controls collect. */
export const developerCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the developer a name.")
    .max(120, "That name is too long — 120 characters max."),
});
export type DeveloperCreateInput = z.infer<typeof developerCreateSchema>;

/** The record editor — everything on the row a human sets. */
export const developerEditSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the developer a name.")
    .max(120, "That name is too long — 120 characters max."),
  slug: z
    .string()
    .min(2, "Slug is too short")
    .max(120, "Slug is too long")
    .regex(slugRegex, "Lowercase letters, numbers and hyphens only"),
  description: z.string().max(2000).nullable().optional(),
  founded_year: z
    .number()
    .int()
    .min(1800, "That year is too early to be real.")
    .max(2100, "That year is in the future.")
    .nullable()
    .optional(),
});
export type DeveloperEditInput = z.infer<typeof developerEditSchema>;

/** Blank inputs become null; the year arrives from a number input as a string. */
export function normaliseDeveloperInput(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  for (const key of ["description"] as const) {
    const v = out[key];
    if (v === "" || v === undefined) out[key] = null;
  }
  const year = out.founded_year;
  if (year === "" || year === undefined || year === null) {
    out.founded_year = null;
  } else if (typeof year === "string") {
    const n = Number(year);
    out.founded_year = Number.isFinite(n) ? n : null;
  }
  for (const key of ["name", "slug"] as const) {
    const v = out[key];
    if (typeof v === "string") out[key] = v.trim();
  }
  return out;
}

/**
 * Normalised key for "is this the same developer?".
 *
 * `developers.name` has no unique constraint — only `slug` does — so two rows
 * called "Aldar" and "aldar  properties " would both insert happily and then
 * fight over which one editors pick. Comparing on the slugified name means
 * case, spacing and punctuation differences all collapse to one key, matching
 * what the unique index would have caught anyway.
 */
export function developerNameKey(name: string): string {
  return slugify(name);
}
