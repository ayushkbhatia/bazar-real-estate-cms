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

/** "Ask this only when <field> answers one of <values>." */
const conditionSchema = z.object({
  field: z
    .string()
    .trim()
    .min(1, "Pick the question this one depends on")
    .max(40)
    .regex(FIELD_KEY_RE),
  values: z
    .array(z.string().trim().min(1).max(80))
    .min(1, "Pick at least one answer that reveals this field")
    .max(MAX_FIELD_OPTIONS),
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
  /** Registry-authored, re-attached on read — accepted here and not stored. */
  note: z.string().trim().max(400).nullable().optional(),
  required: z.boolean(),
  enabled: z.boolean(),
  width: z.enum(["full", "half"]),
  options: z.array(optionSchema).max(MAX_FIELD_OPTIONS).optional(),
  optionSource: z.enum(FORM_OPTION_SOURCES).nullable().optional(),
  rows: z.number().int().min(2).max(12).nullable().optional(),
  min: z.number().int().nullable().optional(),
  max: z.number().int().nullable().optional(),
  step: z.number().int().positive("A slider's step has to be above zero").nullable().optional(),
  unit: z.string().trim().max(12).nullable().optional(),
  showWhen: conditionSchema.nullable().optional(),
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

      // A slider with no scale has nothing to drag along — the same failure as
      // a dropdown with no options, caught in the same place.
      if (field.type === "range" && (field.min == null || field.max == null)) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "min"],
          message: `"${field.label}" needs a minimum and a maximum to slide between`,
        });
      }
    });

    /*
     * A condition can only point backwards.
     *
     * Visibility is resolved in one pass down the list, so a field depending on
     * an answer further down would be deciding whether to show itself from a
     * question the visitor hasn't reached. Rejecting it here is the only place
     * that can see the whole list: the column check in 0098 validates the
     * shape of one row, and the resolver just treats an unreachable condition
     * as unmet.
     */
    const positions = new Map(value.fields.map((f, i) => [f.key, i]));
    value.fields.forEach((field, index) => {
      const condition = field.showWhen;
      if (!condition) return;
      const at = positions.get(condition.field);
      if (at === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "showWhen"],
          message: `"${field.label}" depends on a field that isn't on this form any more`,
        });
        return;
      }
      if (at >= index) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "showWhen"],
          message: `"${field.label}" has to come after the question it depends on`,
        });
        return;
      }
      const controller = value.fields[at]!;
      if (!hasOptions(controller.type)) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "showWhen"],
          message: `"${controller.label}" has no fixed answers, so nothing can depend on it`,
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
    note: null,
    required: false,
    enabled: true,
    width: "full",
    options: hasOptions(type)
      ? [{ label: "First option", value: "first_option", intent: null }]
      : [],
    optionSource: null,
    rows: type === "textarea" ? 4 : null,
    // A new slider arrives with a scale rather than with two blanks, so the
    // first save doesn't fail on a field the editor hasn't looked at yet.
    min: type === "range" ? 0 : null,
    max: type === "range" ? 5_000_000 : null,
    step: type === "range" ? 100_000 : null,
    unit: null,
    showWhen: null,
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
