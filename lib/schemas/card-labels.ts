import { z } from "zod";

import {
  CARD_LABEL_KINDS,
  CARD_LABEL_SETTINGS_DEFAULTS,
  type CardLabelSettings,
} from "@/lib/card-labels";

/**
 * Validation for `site_settings.card_labels` (migration 0123).
 *
 * The vocabulary itself — the shipped labels, the fold to a locale, and the
 * rule for which of them one listing wears — lives in `lib/card-labels.ts`,
 * which has no zod dependency so client components and the edge can import it.
 * This file is only the storage boundary.
 *
 * `max(28)` on the text is the card's constraint rather than the database's: a
 * chip is a 22px pill over a photograph, and a label long enough to wrap has
 * already stopped being a label. The admin form counts down to it.
 */
export const cardLabelSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(60)
    // Written into `properties.flags` and read back by string compare, so keep
    // it to the characters that survive a round trip through jsonb untouched.
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, digits and underscores."),
  text: z.string().trim().min(1, "Give the label some words.").max(28),
  text_ar: z.string().trim().max(28).default(""),
  kind: z.enum(CARD_LABEL_KINDS),
  enabled: z.boolean().default(true),
  builtIn: z.boolean().optional(),
});

export const cardLabelSettingsSchema = z.object({
  labels: z
    .array(cardLabelSchema)
    // A cap, not a design opinion: the screen is a list and the vocabulary is
    // read on every card render, so an accidental paste of a thousand rows
    // should be refused at the boundary rather than shipped to the browser.
    .max(40)
    .default([])
    .superRefine((labels, ctx) => {
      const seen = new Set<string>();
      labels.forEach((l, i) => {
        if (seen.has(l.id))
          ctx.addIssue({
            code: "custom",
            path: [i, "id"],
            message: `Two labels share the id "${l.id}".`,
          });
        seen.add(l.id);
      });
    }),
});

/**
 * Parse a stored bag, total.
 *
 * Anything unparseable resolves to "no vocabulary", which `resolveCardLabels`
 * then fills with the two built-ins. A card is not the place to surface a
 * validation error: the failure a client would notice is a listing that
 * quietly stopped saying "Exclusive".
 */
export function parseCardLabels(raw: unknown): CardLabelSettings {
  const parsed = cardLabelSettingsSchema.safeParse(raw ?? {});
  return parsed.success
    ? (parsed.data as CardLabelSettings)
    : CARD_LABEL_SETTINGS_DEFAULTS;
}
