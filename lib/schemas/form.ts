/**
 * What /admin/forms is allowed to save.
 *
 * The editor sends the whole form — copy plus the ordered field list — in one
 * payload, because order is a property of the list and a per-field save would
 * need a second reorder call that could land out of step with the first. Same
 * reasoning as the floating-CTA rail.
 */

import { z } from "zod";
import {
  FORM_FIELD_MAPPINGS,
  FORM_FIELD_TYPES,
  hasOptions,
  type FormFieldType,
} from "@/lib/forms/types";
import { FORM_OPTION_SOURCES } from "@/lib/forms/types";

export const MAX_FORM_FIELDS = 30;
export const MAX_FIELD_OPTIONS = 24;

/** Field keys are used as input names and submission keys, so: slug shape. */
export const FIELD_KEY_RE = /^[a-z][a-z0-9_]*$/;

const optionSchema = z.object({
  label: z.string().trim().min(1, "An option needs a label").max(80),
  value: z.string().trim().max(80),
  intent: z.string().trim().max(20).nullable().optional(),
});

export const formFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "A field needs a key")
    .max(40)
    .regex(FIELD_KEY_RE, "Use lowercase letters, numbers and underscores"),
  label: z.string().trim().min(1, "A field needs a label").max(80),
  type: z.enum(FORM_FIELD_TYPES),
  mapping: z.enum(FORM_FIELD_MAPPINGS),
  placeholder: z.string().trim().max(120).nullable().optional(),
  help: z.string().trim().max(240).nullable().optional(),
  required: z.boolean(),
  enabled: z.boolean(),
  width: z.enum(["full", "half"]),
  options: z.array(optionSchema).max(MAX_FIELD_OPTIONS).optional(),
  optionSource: z.enum(FORM_OPTION_SOURCES).nullable().optional(),
  rows: z.number().int().min(2).max(12).nullable().optional(),
  min: z.number().int().nullable().optional(),
  max: z.number().int().nullable().optional(),
  locked: z.boolean().optional(),
});

export type FormFieldSaveInput = z.infer<typeof formFieldSchema>;

export const formCopySchema = z.object({
  title: z.string().trim().max(160).nullable(),
  subtitle: z.string().trim().max(400).nullable(),
  submit_label: z.string().trim().min(1, "The button needs a label").max(60),
  pending_label: z.string().trim().min(1, "The sending state needs a label").max(60),
  success_title: z.string().trim().min(1, "The confirmation needs a heading").max(120),
  success_body: z.string().trim().min(1, "The confirmation needs a body").max(600),
  consent_note: z.string().trim().max(300).nullable(),
});

export const formSaveSchema = z
  .object({
    key: z.string().trim().min(1),
    enabled: z.boolean(),
    notify_emails: z
      .array(z.string().trim().toLowerCase().email("That isn't a valid address"))
      .max(10, "Ten addresses is the cap"),
    copy: formCopySchema,
    fields: z
      .array(formFieldSchema)
      .min(1, "A form needs at least one field")
      .max(MAX_FORM_FIELDS, `${MAX_FORM_FIELDS} fields is the cap`),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.fields.forEach((field, index) => {
      if (seen.has(field.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "key"],
          message: `Two fields share the key "${field.key}"`,
        });
      }
      seen.add(field.key);

      // A dropdown with nothing to drop down is a dead control; catching it
      // here is cheaper than a visitor finding an empty select.
      if (
        hasOptions(field.type) &&
        !field.optionSource &&
        (field.options?.length ?? 0) === 0
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "options"],
          message: `"${field.label}" needs at least one option`,
        });
      }

      if (field.min != null && field.max != null && field.min > field.max) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "min"],
          message: "Minimum can't exceed maximum",
        });
      }
    });

    // One field per mapping, except `custom`. Two fields both claiming to be
    // the email would race for the same column.
    const claimed = new Map<string, string>();
    value.fields.forEach((field, index) => {
      if (field.mapping === "custom") return;
      const taken = claimed.get(field.mapping);
      if (taken) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "mapping"],
          message: `"${taken}" already answers that — two fields can't both be it`,
        });
      } else {
        claimed.set(field.mapping, field.label);
      }
    });
  });

export type FormSaveInput = z.infer<typeof formSaveSchema>;

/** A fresh field for the "add field" button. */
export function blankField(type: FormFieldType, index: number): FormFieldSaveInput {
  return {
    key: `question_${index + 1}`,
    label: "New question",
    type,
    mapping: "custom",
    placeholder: null,
    help: null,
    required: false,
    enabled: true,
    width: "full",
    options: hasOptions(type)
      ? [{ label: "First option", value: "first_option", intent: null }]
      : [],
    optionSource: null,
    rows: type === "textarea" ? 4 : null,
    min: null,
    max: null,
    locked: false,
  };
}

/** "First option" → "first_option". Used when an editor leaves value blank. */
export function slugifyOptionValue(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}
