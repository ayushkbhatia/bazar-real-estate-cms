/**
 * Reading forms — for the public site, and for /admin/forms.
 *
 * Public reads go through the cookie-free client for the same reason master
 * pages do: touching `cookies()` would push every page carrying a form out of
 * ISR into fully dynamic rendering, and that is most of the site.
 *
 * Every public read is failure-tolerant by construction. A missing table, an
 * unapplied migration, an unconfigured environment or a dead database all
 * resolve to the registry defaults, which are the forms as they render today.
 * The failure mode of this whole feature is "the CMS edits don't apply yet",
 * never "the form is gone".
 */

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseDeep, localiseRow } from "@/lib/i18n/localise";
import { type Locale } from "@/lib/i18n/locales";
import type { Database, Json } from "@/db/types";
import {
  FORM_DEFS,
  defaultForm,
  getFormDef,
  resolveForm,
  type FormCopy,
  type FormDef,
  type FormFieldCondition,
  type FormFieldType,
  type FormFieldMapping,
  type FormOption,
  type FormOptionSource,
  type FormSubmissionStatus,
  type ResolvedForm,
} from "@/lib/forms";
import type { StoredField } from "@/lib/forms/resolve";

export function isMissingTableError(
  error: { code?: string | null } | null,
): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

const FORM_COLUMNS = "id, key, enabled, copy, notify_emails";
const FIELD_COLUMNS =
  "id, form_id, key, label, label_ar, type, mapping, placeholder, placeholder_ar, help, help_ar, required, enabled, width, options, option_source, rows, min_value, max_value, step, unit, unit_ar, show_when, locked, position";

type FormRow = Database["public"]["Tables"]["forms"]["Row"];
type FieldRow = Database["public"]["Tables"]["form_fields"]["Row"];

/** jsonb → the option list, dropping anything malformed rather than throwing. */
function parseOptions(value: Json | null): FormOption[] {
  if (!Array.isArray(value)) return [];
  const out: FormOption[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label : null;
    if (!label) continue;
    out.push({
      label,
      // Rebuilt key by key, so anything not named here is destroyed. That is
      // exactly how the four field-level twins were lost (#390) — this one is
      // named on purpose.
      label_ar: typeof record.label_ar === "string" ? record.label_ar : null,
      value:
        typeof record.value === "string" && record.value ? record.value : label,
      intent: typeof record.intent === "string" ? record.intent : null,
    });
  }
  return out;
}

/**
 * jsonb → a visibility condition, or null.
 *
 * Same posture as `parseOptions`: anything malformed is dropped rather than
 * thrown on. A condition that fails to parse leaves the field unconditional,
 * which shows a question that should have been hidden — the safe direction.
 * The opposite default would silently delete a question from a live form.
 */
function parseCondition(value: Json | null): FormFieldCondition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const field = typeof record.field === "string" ? record.field.trim() : "";
  if (!field) return null;
  const values = Array.isArray(record.values)
    ? record.values.filter((v): v is string => typeof v === "string")
    : [];
  if (values.length === 0) return null;
  return { field, values };
}

/**
 * One database row to the shape `resolveForm` and `localiseDeep` expect.
 *
 * The four `_ar` columns are the whole reason this function is worth a comment.
 * They were selected in `FIELD_COLUMNS` and never mapped here, which made every
 * piece of field-level Arabic in the product unreachable: migration 0104 added
 * the columns, `_actions.ts` writes them, `localiseFields` below exists purely
 * to fold them — and `localiseDeep` had nothing to fold, because the twins were
 * dropped one step earlier.
 *
 * It was silent in both directions and destructive on the second save. The
 * editor reads through this same function, so it rendered blank Arabic inputs
 * over stored content; saving that form then wrote the blanks back and the
 * Arabic was gone for good.
 *
 * TypeScript could not catch it: `StoredField` is `FormFieldDef & {position}`,
 * and all four twins are declared optional on `FormFieldDef` — correctly, since
 * a form need not have Arabic — so omitting them is well-typed. `forms-arabic.
 * test.ts` is the guard instead, and it is written against `FIELD_COLUMNS`
 * rather than against these four names, so a fifth twin cannot repeat this.
 */
function toStoredField(row: FieldRow): StoredField {
  return {
    key: row.key,
    label: row.label,
    label_ar: row.label_ar,
    type: row.type as FormFieldType,
    mapping: row.mapping as FormFieldMapping,
    placeholder: row.placeholder,
    placeholder_ar: row.placeholder_ar,
    help: row.help,
    help_ar: row.help_ar,
    required: row.required,
    enabled: row.enabled,
    width: row.width === "half" ? "half" : "full",
    options: parseOptions(row.options),
    optionSource: (row.option_source as FormOptionSource | null) ?? null,
    rows: row.rows,
    min: row.min_value,
    max: row.max_value,
    step: row.step,
    unit: row.unit,
    unit_ar: row.unit_ar,
    showWhen: parseCondition(row.show_when),
    locked: row.locked,
    position: row.position,
  };
}

function toStoredForm(row: FormRow) {
  const copy =
    row.copy && typeof row.copy === "object" && !Array.isArray(row.copy)
      ? (row.copy as Partial<FormCopy>)
      : {};
  return {
    key: row.key,
    enabled: row.enabled,
    copy,
    notify_emails: Array.isArray(row.notify_emails) ? row.notify_emails : [],
  };
}

/**
 * One request's worth of forms, fetched once.
 *
 * Deliberately fetches *every* form rather than the one asked for: a landing
 * page renders two, the layout may add a third, and one small query beats
 * three round-trips. Sixteen rows and their fields is a few kilobytes.
 */
const loadAll = cache(
  async (): Promise<{
    forms: Map<string, ReturnType<typeof toStoredForm>>;
    fields: Map<string, StoredField[]>;
  }> => {
    const empty = { forms: new Map(), fields: new Map() };
    if (!isSupabaseConfigured) return empty;
    try {
      const supabase = createSupabasePublicClient();
      const [formsResult, fieldsResult] = await Promise.all([
        supabase.from("forms").select(FORM_COLUMNS),
        supabase.from("form_fields").select(FIELD_COLUMNS),
      ]);
      if (formsResult.error || fieldsResult.error) return empty;

      const forms = new Map<string, ReturnType<typeof toStoredForm>>();
      const byId = new Map<string, string>();
      for (const row of (formsResult.data ?? []) as FormRow[]) {
        forms.set(row.key, toStoredForm(row));
        byId.set(row.id, row.key);
      }

      const fields = new Map<string, StoredField[]>();
      for (const row of (fieldsResult.data ?? []) as FieldRow[]) {
        const key = byId.get(row.form_id);
        if (!key) continue;
        const list = fields.get(key) ?? [];
        list.push(toStoredField(row));
        fields.set(key, list);
      }
      return { forms, fields };
    } catch (error) {
      console.error("[forms] failed to load", error);
      return empty;
    }
  },
);

/**
 * Fold the stored field rows for a locale before they are merged.
 *
 * Done here rather than inside `resolveForm`, which the CMS also calls — the
 * editor has to see the twins it is about to write back. Registry defaults are
 * left alone on purpose: those are code strings with no `_ar` sibling, so an
 * un-overridden field falls back to its English exactly as the site-wide rule
 * requires.
 */
export function localiseFields(
  rows: StoredField[] | null,
  locale: Locale,
): StoredField[] | null {
  if (!rows) return null;
  return localiseDeep(rows, locale);
}

/** The effective form for a public page. Never null for a registry key. */

/**
 * Fold a resolved form down to one locale.
 *
 * Has to happen AFTER `resolveForm`, not before, and that ordering is the
 * whole point. `localiseFields` above folds the STORED rows — but a form with
 * no stored rows falls back to the registry defaults, and `fillFormArabic`
 * (inside `resolveForm`) is what puts Arabic on those. Folding only the stored
 * rows meant a form that had never been edited in the CMS rendered its labels
 * in English on `/ar`, with the Arabic sitting right there in `label_ar`
 * unread.
 *
 * `resolveForm` itself must NOT fold: the admin editor reads through it and
 * needs both languages, or it renders blank Arabic inputs over stored content
 * and saves the blanks back — which is exactly how #390 destroyed data.
 */
export function localiseResolved(
  form: ResolvedForm,
  locale: Locale,
): ResolvedForm {
  return {
    ...form,
    copy: localiseRow(form.copy as Record<string, unknown>, locale) as typeof form.copy,
    fields: localiseDeep(form.fields, locale),
  };
}

export async function getForm(key: string): Promise<ResolvedForm> {
  const fallback = defaultForm(key);
  if (!fallback) throw new Error(`Unknown form: ${key}`);
  const { forms, fields } = await loadAll();
  const locale = await currentLocale();
  const resolved =
    resolveForm(
      key,
      forms.get(key) ?? null,
      localiseFields(fields.get(key) ?? null, locale),
    ) ?? fallback;
  return localiseResolved(resolved, locale);
}

/** Several at once, keyed by form key. */
export async function getForms(
  keys: string[],
): Promise<Record<string, ResolvedForm>> {
  const { forms, fields } = await loadAll();
  const locale = await currentLocale();
  const out: Record<string, ResolvedForm> = {};
  for (const key of keys) {
    const resolved =
      resolveForm(
        key,
        forms.get(key) ?? null,
        localiseFields(fields.get(key) ?? null, locale),
      ) ?? defaultForm(key);
    if (resolved) out[key] = localiseResolved(resolved, locale);
  }
  return out;
}

// ── admin ────────────────────────────────────────────────────────────────

export type AdminFormSummary = {
  def: FormDef;
  form: ResolvedForm;
  submissions: number;
  newSubmissions: number;
  lastSubmissionAt: string | null;
};

export type AdminFormsResult = {
  rows: AdminFormSummary[];
  missingTable: boolean;
  error: string | null;
};

/**
 * Every registry form, with whatever is stored against it.
 *
 * Reads through the caller's authenticated client so the staff policy applies.
 * The list is driven by the registry rather than by the table, so a form
 * nobody has edited still appears — with its defaults — instead of the manager
 * looking empty on a fresh database.
 */
export async function listFormsForAdmin(
  supabase: SupabaseClient<Database>,
): Promise<AdminFormsResult> {
  const fallback = (missingTable: boolean, error: string | null) => ({
    rows: FORM_DEFS.map((def) => ({
      def,
      form: defaultForm(def.key)!,
      submissions: 0,
      newSubmissions: 0,
      lastSubmissionAt: null,
    })),
    missingTable,
    error,
  });

  if (!isSupabaseConfigured) return fallback(false, null);

  const [formsResult, fieldsResult, submissionsResult] = await Promise.all([
    supabase.from("forms").select(FORM_COLUMNS),
    supabase.from("form_fields").select(FIELD_COLUMNS),
    supabase
      .from("form_submissions")
      .select("form_key, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const firstError =
    formsResult.error ?? fieldsResult.error ?? submissionsResult.error;
  if (firstError) {
    return fallback(isMissingTableError(firstError), firstError.message);
  }

  const stored = new Map<string, ReturnType<typeof toStoredForm>>();
  const byId = new Map<string, string>();
  for (const row of (formsResult.data ?? []) as FormRow[]) {
    stored.set(row.key, toStoredForm(row));
    byId.set(row.id, row.key);
  }

  const fields = new Map<string, StoredField[]>();
  for (const row of (fieldsResult.data ?? []) as FieldRow[]) {
    const key = byId.get(row.form_id);
    if (!key) continue;
    const list = fields.get(key) ?? [];
    list.push(toStoredField(row));
    fields.set(key, list);
  }

  const counts = new Map<
    string,
    { total: number; unread: number; last: string | null }
  >();
  for (const row of (submissionsResult.data ?? []) as {
    form_key: string;
    status: string;
    created_at: string;
  }[]) {
    const entry = counts.get(row.form_key) ?? {
      total: 0,
      unread: 0,
      last: null,
    };
    entry.total += 1;
    if (row.status === "new") entry.unread += 1;
    // Rows arrive newest-first, so the first one seen for a key is the latest.
    if (!entry.last) entry.last = row.created_at;
    counts.set(row.form_key, entry);
  }

  return {
    rows: FORM_DEFS.map((def) => {
      const count = counts.get(def.key);
      return {
        def,
        form:
          resolveForm(
            def.key,
            stored.get(def.key) ?? null,
            fields.get(def.key) ?? null,
          ) ?? defaultForm(def.key)!,
        submissions: count?.total ?? 0,
        newSubmissions: count?.unread ?? 0,
        lastSubmissionAt: count?.last ?? null,
      };
    }),
    missingTable: false,
    error: null,
  };
}

export type AdminFormDetail = {
  form: ResolvedForm;
  missingTable: boolean;
  error: string | null;
};

export async function getFormForAdmin(
  supabase: SupabaseClient<Database>,
  key: string,
): Promise<AdminFormDetail | null> {
  const def = getFormDef(key);
  if (!def) return null;
  const fallbackForm = defaultForm(key)!;
  if (!isSupabaseConfigured)
    return { form: fallbackForm, missingTable: false, error: null };

  const { data: formRow, error: formError } = await supabase
    .from("forms")
    .select(FORM_COLUMNS)
    .eq("key", key)
    .maybeSingle();
  if (formError) {
    return {
      form: fallbackForm,
      missingTable: isMissingTableError(formError),
      error: formError.message,
    };
  }
  if (!formRow) return { form: fallbackForm, missingTable: false, error: null };

  const { data: fieldRows, error: fieldError } = await supabase
    .from("form_fields")
    .select(FIELD_COLUMNS)
    .eq("form_id", (formRow as FormRow).id)
    .order("position", { ascending: true });
  if (fieldError) {
    return {
      form: fallbackForm,
      missingTable: isMissingTableError(fieldError),
      error: fieldError.message,
    };
  }

  return {
    form:
      resolveForm(
        key,
        toStoredForm(formRow as FormRow),
        ((fieldRows ?? []) as FieldRow[]).map(toStoredField),
      ) ?? fallbackForm,
    missingTable: false,
    error: null,
  };
}

// ── submissions ──────────────────────────────────────────────────────────

export type SubmissionRow = {
  id: string;
  form_key: string;
  data: Record<string, unknown>;
  labels: Record<string, string>;
  enquiry_id: string | null;
  source_path: string | null;
  status: FormSubmissionStatus;
  created_at: string;
};

/** `data._labels` is the snapshot; everything else is an answer. */
export function splitSubmissionData(value: Json | null): {
  data: Record<string, unknown>;
  labels: Record<string, string>;
} {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { data: {}, labels: {} };
  const record = { ...(value as Record<string, unknown>) };
  const rawLabels = record._labels;
  delete record._labels;
  const labels: Record<string, string> = {};
  if (rawLabels && typeof rawLabels === "object" && !Array.isArray(rawLabels)) {
    for (const [key, label] of Object.entries(
      rawLabels as Record<string, unknown>,
    )) {
      if (typeof label === "string") labels[key] = label;
    }
  }
  return { data: record, labels };
}

export async function listSubmissions(
  supabase: SupabaseClient<Database>,
  formKey: string,
  opts: { limit?: number; status?: FormSubmissionStatus | "all" } = {},
): Promise<{
  rows: SubmissionRow[];
  missingTable: boolean;
  error: string | null;
}> {
  if (!isSupabaseConfigured)
    return { rows: [], missingTable: false, error: null };

  let query = supabase
    .from("form_submissions")
    .select("id, form_key, data, enquiry_id, source_path, status, created_at")
    .eq("form_key", formKey)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);

  if (opts.status && opts.status !== "all") {
    query = query.eq("status", opts.status);
  }

  const { data, error } = await query;
  if (error)
    return {
      rows: [],
      missingTable: isMissingTableError(error),
      error: error.message,
    };

  const rows = (data ?? []).map((row) => {
    const split = splitSubmissionData(row.data);
    return {
      id: row.id,
      form_key: row.form_key,
      data: split.data,
      labels: split.labels,
      enquiry_id: row.enquiry_id,
      source_path: row.source_path,
      status: row.status as FormSubmissionStatus,
      created_at: row.created_at,
    };
  });

  return { rows, missingTable: false, error: null };
}
