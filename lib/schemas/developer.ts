import { z } from "zod";
import { slugify } from "@/lib/slug";

export const developerCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the developer a name.")
    .max(120, "That name is too long — 120 characters max."),
});
export type DeveloperCreateInput = z.infer<typeof developerCreateSchema>;

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
