import { z } from "zod";
import { LANDING_SLUG_RE, isReservedLandingSlug } from "@/lib/page-builder/types";

/**
 * Landing-page metadata.
 *
 * The slug rule is deliberately stricter than `pageCreateSchema`'s, which
 * permits '/' — see lib/schemas/page.ts:3. `/lp/[slug]` is a *single* dynamic
 * segment, so a slash there produces a `%2F` URL that nothing in the CMS links
 * to correctly. The same regex is the CHECK constraint in migration 0099, so
 * the two can't drift apart silently.
 */

const slugField = z
  .string()
  .trim()
  .min(3, "At least 3 characters.")
  .max(140, "Too long.")
  .regex(
    LANDING_SLUG_RE,
    "Lowercase letters, digits and hyphens only — no slashes or spaces.",
  )
  .refine((s) => !isReservedLandingSlug(s), {
    message: "That URL is reserved. Pick another.",
  });

export const landingCreateSchema = z.object({
  title: z.string().trim().min(3, "At least 3 characters.").max(160, "Too long."),
  slug: slugField,
  preset: z.string().trim().max(40).optional(),
});

export const landingMetaSchema = z.object({
  title: z.string().trim().min(3, "At least 3 characters.").max(160, "Too long."),
  /* Arabic twin. The landing title is the <title> fallback when seo.meta_title
   * is unset, so it reaches a visitor even though it reads like an internal
   * name. `.optional()` — updateLandingMeta writes a partial update. */
  title_ar: z.string().trim().max(240).nullable().optional(),
  slug: slugField,
  meta_title: z.string().trim().max(70, "Keep it under 70 characters.").optional(),
  meta_description: z
    .string()
    .trim()
    .max(180, "Keep it under 180 characters.")
    .optional(),
  noindex: z.boolean().optional(),
});

export type LandingCreateInput = z.infer<typeof landingCreateSchema>;
export type LandingMetaInput = z.infer<typeof landingMetaSchema>;

/** Trim, and turn submitted blanks into nulls the way the pages editor does. */
export function normaliseLandingMetaInput(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : v);
  const blankToUndefined = (v: unknown) =>
    typeof v === "string" && v.trim() === "" ? undefined : text(v);
  return {
    title: text(raw.title),
    slug: typeof raw.slug === "string" ? raw.slug.trim().toLowerCase() : raw.slug,
    meta_title: blankToUndefined(raw.meta_title),
    meta_description: blankToUndefined(raw.meta_description),
    noindex: raw.noindex === true || raw.noindex === "on",
  };
}

/** Turn a title into a slug candidate for the "new page" form. */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140)
    .replace(/-+$/g, "");
}
