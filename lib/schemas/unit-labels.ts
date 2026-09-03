import { z } from "zod";

import { ALL_LOCALES } from "@/lib/i18n/locales";
import { AREA_UNITS, CURRENCIES } from "@/lib/preferences/types";
import {
  UNIT_LABEL_SETTINGS_DEFAULTS,
  type UnitLabelSettings,
} from "@/lib/preferences/unit-labels";

/**
 * Validation for `site_settings.unit_labels` (migration 0122).
 *
 * The dictionary itself — the shipped words and the rule about which side of a
 * number the currency sits on — lives in `lib/preferences/unit-labels.ts`,
 * which has no zod dependency so it can be imported by client components and
 * by the edge. This file is only the storage boundary.
 *
 * Every field is optional and every value may be blank, because the bag is a
 * set of OVERRIDES rather than a copy of the dictionary. Two consequences
 * worth stating:
 *
 * - A bag written before a key existed still parses, so adding a currency or
 *   an area unit later needs no data migration.
 * - Clearing an input in the admin form stores `""`, and `resolveUnitLabels`
 *   reads a blank as "no override". So the form's clear button means "go back
 *   to the shipped word", not "render nothing beside the price" — which is the
 *   only sane reading, and the one an operator will assume.
 */

const overrideRecord = <T extends string>(keys: readonly T[]) =>
  z
    .object(
      Object.fromEntries(
        keys.map((k) => [k, z.string().trim().max(40).optional()]),
      ) as Record<T, z.ZodOptional<z.ZodString>>,
    )
    .partial()
    .optional();

export const unitLabelOverrideSchema = z.object({
  currency: overrideRecord(CURRENCIES),
  currencyLong: overrideRecord(CURRENCIES),
  area: overrideRecord(AREA_UNITS),
  areaLong: overrideRecord(AREA_UNITS),
});

export const unitLabelSettingsSchema = z
  .object(
    Object.fromEntries(
      ALL_LOCALES.map((l) => [l, unitLabelOverrideSchema.optional()]),
    ) as Record<
      (typeof ALL_LOCALES)[number],
      z.ZodOptional<typeof unitLabelOverrideSchema>
    >,
  )
  .partial();

/**
 * Parse a stored bag, total.
 *
 * Anything unparseable resolves to "no overrides", which renders the shipped
 * dictionary. A price is not the place to surface a validation error: the
 * failure a client would actually notice is a card with no currency on it.
 */
export function parseUnitLabels(raw: unknown): UnitLabelSettings {
  const parsed = unitLabelSettingsSchema.safeParse(raw ?? {});
  return parsed.success
    ? (parsed.data as UnitLabelSettings)
    : UNIT_LABEL_SETTINGS_DEFAULTS;
}
