/**
 * What /admin/forms/search-bar is allowed to save.
 *
 * The editor sends the whole bar — the copy overrides plus the ordered tab
 * list — in one payload, for the same reason the forms editor does: order is a
 * property of the list, and a per-tab save would need a second reorder call
 * that could land out of step with the first.
 */

import { z } from "zod";
import { PROPERTY_TYPES } from "@/lib/schemas/property";
import {
  SEARCH_BAR_COPY_KEYS,
  copyArKey,
  copyArMax,
  type SearchBarCopyKey,
} from "@/lib/search-bar/copy-keys";

export const MAX_SEARCH_BAR_TABS = 6;
export const MAX_SEARCH_BAR_TYPES = 12;

/** Hyphens allowed: the off-plan tab has answered to "off-plan" since it shipped. */
export const TAB_KEY_RE = /^[a-z][a-z0-9_-]*$/;

/**
 * A site-relative path, and only that.
 *
 * The value is pushed onto the router on submit, so an editor pasting
 * `https://…` would turn the home page's main control into an off-site
 * redirect. Mirrored by a check constraint in 0111 — the schema is the
 * message, the constraint is the guarantee.
 */
export const TAB_ROUTE_RE = /^\/[A-Za-z0-9/_-]*$/;

const rangeSchema = z.object({
  max: z.number().int().positive("A slider's ceiling has to be above zero"),
  step: z.number().int().positive("A slider's step has to be above zero"),
});

const typeSchema = z.object({
  /*
   * Constrained to the enum, not free text. The value is written into `?type=`
   * and re-parsed by `parseFilters`, which drops anything it does not
   * recognise — so an invented value is not an error the editor sees, it is a
   * dropdown entry that silently returns the unfiltered list.
   */
  value: z.enum(PROPERTY_TYPES),
  label: z.string().trim().min(1, "A property type needs a label").max(60),
  /* 90 = 1.5x the English cap. Required-with-null rather than optional: the
   * save replaces the tab rows outright, so a twin the payload omits is
   * destroyed rather than left alone. */
  label_ar: z.string().trim().max(90).nullable(),
});

export const searchBarTabSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "A tab needs a key")
    .max(40)
    .regex(TAB_KEY_RE, "Use lowercase letters, numbers, hyphens and underscores"),
  label: z.string().trim().min(1, "A tab needs a label").max(40),
  label_ar: z.string().trim().max(60).nullable(),
  route: z
    .string()
    .trim()
    .min(1, "A tab needs a route")
    .max(120)
    .regex(TAB_ROUTE_RE, "Use a path on this site, like /buy"),
  placeholder: z.string().trim().min(1, "The search box needs a placeholder").max(120),
  placeholder_ar: z.string().trim().max(180).nullable(),
  types: z.array(typeSchema).max(MAX_SEARCH_BAR_TYPES),
  beds: z.boolean(),
  size: rangeSchema.nullable(),
  price: rangeSchema,
  enabled: z.boolean(),
});

export type SearchBarTabSaveInput = z.infer<typeof searchBarTabSchema>;

/** `{submit_label, submit_label_ar, …}` — built from the key list, never typed out. */
const copyShape = Object.fromEntries(
  SEARCH_BAR_COPY_KEYS.flatMap(({ key, max }) => [
    [key, z.string().trim().max(max).nullable()],
    [copyArKey(key as SearchBarCopyKey), z.string().trim().max(copyArMax(max)).nullable()],
  ]),
) as Record<string, z.ZodTypeAny>;

export const searchBarSaveSchema = z.object({
  key: z.string().trim().min(1),
  copy: z.object(copyShape),
  tabs: z
    .array(searchBarTabSchema)
    .min(1, "The search bar needs at least one tab")
    .max(MAX_SEARCH_BAR_TABS)
    .superRefine((tabs, ctx) => {
      const seen = new Set<string>();
      tabs.forEach((tab, index) => {
        if (seen.has(tab.key)) {
          ctx.addIssue({
            code: "custom",
            path: [index, "key"],
            message: `Two tabs answer to "${tab.key}" — keys have to be unique`,
          });
        }
        seen.add(tab.key);
      });
      if (!tabs.some((tab) => tab.enabled)) {
        ctx.addIssue({
          code: "custom",
          path: [0, "enabled"],
          message: "At least one tab has to stay on — a search bar with none is broken",
        });
      }
    }),
});

export type SearchBarSaveInput = z.infer<typeof searchBarSaveSchema>;

/** A new tab, ready for the editor to fill in. */
export function blankTab(): SearchBarTabSaveInput {
  return {
    key: "",
    label: "",
    label_ar: null,
    route: "/buy",
    placeholder: "Area, building, community or emirate",
    placeholder_ar: null,
    types: [],
    beds: true,
    size: null,
    price: { max: 50_000_000, step: 250_000 },
    enabled: true,
  };
}
