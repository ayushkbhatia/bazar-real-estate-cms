"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isMissingTableError } from "@/lib/queries/forms";
import { getFormDef } from "@/lib/forms/registry";
import { defaultForm } from "@/lib/forms/resolve";
import { formSaveSchema, type FormSaveInput } from "@/lib/schemas/form";
import type { FormFieldDef } from "@/lib/forms/types";
import { FORM_COPY_KEYS, copyArKey } from "@/lib/forms/copy-keys";

const FORM_ROLES = ["admin", "editor", "marketing"] as const;

export type SaveFormResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

function orNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

const MISSING_TABLE =
  "The forms tables aren't there yet — apply migration 0094_forms_manager.sql and reload. The public site keeps rendering its built-in fields until then.";

/**
 * Save one form: its visibility, its copy and its whole field list.
 *
 * A whole-form save rather than per-field writes, for the same reason the
 * floating-CTA rail saves as a list: order is a property of the list, and the
 * editor is holding all of it. Reconciling here keeps "what I see is what is
 * live" true when a field was reordered, another retyped and a third deleted
 * in one sitting.
 *
 * Three things the payload is not allowed to do, checked here rather than
 * trusted from the client:
 *   • drop, disable or retype a locked field — the handler can't submit without it;
 *   • edit the field list of a `control: "copy"` form, whose public component
 *     draws its own inputs and would ignore the change;
 *   • edit the copy of a `copyFromPage` form, whose strings live in Pages &
 *     blocks and would be overwritten from there on the next save.
 * In each case the offending half of the payload is dropped and the rest is
 * saved, because the editor's screen never offered those controls — a payload
 * carrying them is a stale tab or a hand-rolled request, not a decision.
 */
export async function saveForm(raw: FormSaveInput): Promise<SaveFormResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const { supabase } = await requireRole(FORM_ROLES);

  const parsed = formSaveSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields.",
      issues: parsed.error.issues.map((issue) => {
        const row = typeof issue.path[1] === "number" ? issue.path[1] + 1 : null;
        return row ? `Field ${row}: ${issue.message}` : issue.message;
      }),
    };
  }

  const input = parsed.data;
  const def = getFormDef(input.key);
  if (!def)
    return { status: "error", message: `Unknown form "${input.key}".` };

  const editsFields = def.control === "full";
  const editsCopy = !def.copyFromPage;

  // Locked fields must survive intact.
  if (editsFields) {
    const byKey = new Map(input.fields.map((f) => [f.key, f]));
    const broken = def.fields
      .filter((f) => f.locked)
      .filter((f) => {
        const sent = byKey.get(f.key);
        return !sent || !sent.enabled || sent.type !== f.type;
      });
    if (broken.length > 0) {
      return {
        status: "invalid",
        message: "Fix the highlighted fields.",
        issues: broken.map(
          (f) =>
            `"${f.label}" can't be removed, switched off or retyped — the form can't be submitted without it.`,
        ),
      };
    }
  }

  const enabled = def.alwaysOn ? true : input.enabled;

  const { data: existing, error: readError } = await supabase
    .from("forms")
    .select("id, enabled, copy")
    .eq("key", input.key)
    .maybeSingle();
  if (readError) {
    return {
      status: "error",
      message: isMissingTableError(readError)
        ? MISSING_TABLE
        : readError.message,
    };
  }

  /*
   * Built from `FORM_COPY_KEYS`, not hand-listed.
   *
   * This object REPLACES the stored bag rather than merging into it, so any key
   * missing here is destroyed on every save. docs/I18N.md names that as the
   * trap; deriving the list is what stops it being one, and it is why the seven
   * Arabic twins arrived without seven more chances to forget.
   */
  const copyPayload = editsCopy
    ? Object.fromEntries(
        FORM_COPY_KEYS.flatMap((k) => {
          const value = (input.copy as Record<string, unknown>)[k.key];
          const arabic = (input.copy as Record<string, unknown>)[copyArKey(k.key)];
          return [
            [
              k.key,
              k.optional
                ? orNull(value as string | null)
                : String(value ?? "").trim(),
            ],
            [copyArKey(k.key), orNull((arabic ?? null) as string | null)],
          ];
        }),
      )
    : ((existing?.copy ?? {}) as Record<string, unknown>);

  const row = {
    key: input.key,
    enabled,
    copy: copyPayload as never,
    notify_emails: input.notify_emails,
  };

  const { data: saved, error: writeError } = existing
    ? await supabase
        .from("forms")
        .update(row)
        .eq("id", existing.id)
        .select("id")
        .maybeSingle()
    : await supabase.from("forms").insert(row).select("id").maybeSingle();

  if (writeError || !saved) {
    return {
      status: "error",
      message: isMissingTableError(writeError)
        ? MISSING_TABLE
        : (writeError?.message ?? "Couldn't save the form."),
    };
  }

  if (editsFields) {
    // Replace rather than reconcile: the field list is small, the editor sent
    // all of it, and a delete-then-insert can't leave a stale row behind or
    // trip the (form_id, key) unique index when two fields swapped keys.
    const { error: clearError } = await supabase
      .from("form_fields")
      .delete()
      .eq("form_id", saved.id);
    if (clearError)
      return { status: "error", message: clearError.message };

    const rows = input.fields.map((field, index) => ({
      form_id: saved.id,
      key: field.key,
      label: field.label.trim(),
      label_ar: field.label_ar,
      type: field.type,
      mapping: field.mapping,
      placeholder: orNull(field.placeholder),
      placeholder_ar: field.placeholder_ar,
      help: orNull(field.help),
      help_ar: field.help_ar,
      required: field.required,
      enabled: field.enabled,
      width: field.width,
      options: (field.optionSource ? [] : (field.options ?? [])) as never,
      option_source: field.optionSource ?? null,
      rows: field.type === "textarea" ? (field.rows ?? 4) : null,
      // `min_value` / `max_value` are the ends of a scale, which a number box
      // and a slider both have; `step` and `unit` are the slider's alone.
      // Nulled outside their type so a field retyped from slider to text
      // doesn't keep an invisible scale that reappears if it is typed back.
      min_value:
        field.type === "number" || field.type === "range"
          ? (field.min ?? null)
          : null,
      max_value:
        field.type === "number" || field.type === "range"
          ? (field.max ?? null)
          : null,
      step: field.type === "range" ? (field.step ?? null) : null,
      unit: field.type === "range" ? orNull(field.unit) : null,
      unit_ar: field.type === "range" ? field.unit_ar : null,
      show_when: (field.showWhen ?? null) as never,
      locked: def.fields.some((f) => f.key === field.key && f.locked),
      position: (index + 1) * 10,
    }));

    const { error: insertError } = await supabase
      .from("form_fields")
      .insert(rows);
    if (insertError)
      return { status: "error", message: insertError.message };
  }

  await logAudit({
    action: "forms.save",
    target_kind: "form",
    target_id: input.key,
    before: existing ? { enabled: existing.enabled } : null,
    after: {
      enabled,
      fields: editsFields ? input.fields.length : null,
      notify_emails: input.notify_emails.length,
    },
  });

  revalidateFor(def.path);

  return {
    status: "ok",
    message: enabled ? "Saved." : "Saved — the form is switched off.",
  };
}

/** Back to the registry defaults: delete the row, and the fields with it. */
export async function resetForm(key: string): Promise<SaveFormResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  const { supabase } = await requireRole(FORM_ROLES);

  const def = getFormDef(key);
  if (!def) return { status: "error", message: `Unknown form "${key}".` };

  // `form_fields.form_id` cascades, so one delete clears both.
  const { error } = await supabase.from("forms").delete().eq("key", key);
  if (error) {
    return {
      status: "error",
      message: isMissingTableError(error) ? MISSING_TABLE : error.message,
    };
  }

  await logAudit({
    action: "forms.reset",
    target_kind: "form",
    target_id: key,
    after: { restored: "registry defaults" },
  });

  revalidateFor(def.path);
  return { status: "ok", message: "Reverted to the built-in form." };
}

export type SubmissionActionResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function setSubmissionStatus(
  id: string,
  status: "new" | "read" | "archived",
): Promise<SubmissionActionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  const { user, supabase } = await requireRole(FORM_ROLES);

  const { error } = await supabase
    .from("form_submissions")
    .update({
      status,
      read_at: status === "new" ? null : new Date().toISOString(),
      read_by: status === "new" ? null : user.id,
    })
    .eq("id", id);
  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/forms");
  return { status: "ok" };
}

/**
 * Which public paths a form's copy affects.
 *
 * The dialogs live on dynamic routes, and the layout-level revalidation is the
 * only honest way to reach every project or listing page carrying one.
 */
function revalidateFor(path: string) {
  revalidatePath("/admin/forms");
  if (path === "/" || path.split("/").length > 2) {
    revalidateLocalised("/", "layout");
    return;
  }
  revalidateLocalised(path);
}

/** The registry's version of a field, for the editor's "revert" affordance. */
export async function registryFieldsFor(key: string): Promise<FormFieldDef[]> {
  return defaultForm(key)?.fields ?? [];
}
