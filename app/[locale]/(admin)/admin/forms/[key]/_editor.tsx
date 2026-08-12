"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  FORM_FIELD_TYPES,
  FORM_FIELD_TYPE_LABELS,
  FORM_FIELD_MAPPINGS,
  FORM_FIELD_MAPPING_LABELS,
  FORM_OPTION_SOURCE_LABELS,
  hasOptions,
  type FormFieldCondition,
  type FormFieldType,
  type FormFieldMapping,
  type ResolvedForm,
} from "@/lib/forms/types";
import {
  blankField,
  slugifyOptionValue,
  type FormFieldSaveInput,
  type FormSaveInput,
} from "@/lib/schemas/form";
import type { SubmissionRow } from "@/lib/queries/forms";
import { resetForm, saveForm } from "../_actions";
import { ResponsesTable } from "./_responses";

const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[12.5px]";

type Tab = "content" | "fields" | "responses" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "content", label: "Content & CTA" },
  { key: "fields", label: "Fields" },
  { key: "responses", label: "Responses" },
  { key: "settings", label: "Settings" },
];

function toSaveField(field: ResolvedForm["fields"][number]): FormFieldSaveInput {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    mapping: field.mapping,
    placeholder: field.placeholder ?? null,
    help: field.help ?? null,
    note: field.note ?? null,
    required: field.required,
    enabled: field.enabled,
    width: field.width,
    options: (field.options ?? []).map((o) => ({
      label: o.label,
      value: o.value,
      intent: o.intent ?? null,
    })),
    optionSource: field.optionSource ?? null,
    rows: field.rows ?? null,
    min: field.min ?? null,
    max: field.max ?? null,
    step: field.step ?? null,
    unit: field.unit ?? null,
    showWhen: field.showWhen ?? null,
    locked: field.locked ?? false,
  };
}

export function FormEditor({
  form,
  submissions,
  submissionsError,
}: {
  form: ResolvedForm;
  submissions: SubmissionRow[];
  submissionsError: string | null;
}) {
  const def = form.def;
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("content");
  const [enabled, setEnabled] = useState(form.enabled);
  const [copy, setCopy] = useState(form.copy);
  const [fields, setFields] = useState<FormFieldSaveInput[]>(() =>
    form.fields.map(toSaveField),
  );
  const [notify, setNotify] = useState(form.notifyEmails.join(", "));
  const [open, setOpen] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const editsFields = def.control === "full";
  const editsCopy = !def.copyFromPage;
  const headingHref = def.headingSource
    ? `/admin/pages/master/${def.headingSource.pageKey}`
    : null;

  const unread = useMemo(
    () => submissions.filter((s) => s.status === "new").length,
    [submissions],
  );

  function touch() {
    setDirty(true);
    setIssues([]);
  }

  function setField(index: number, patch: Partial<FormFieldSaveInput>) {
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
    touch();
  }

  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= fields.length) return;
    setFields((prev) => {
      const next = prev.slice();
      [next[index], next[to]] = [next[to]!, next[index]!];
      return next;
    });
    setOpen(open === index ? to : open === to ? index : open);
    touch();
  }

  function remove(index: number) {
    const field = fields[index];
    if (field?.locked) {
      toast.error(
        `"${field.label}" can't be removed — the form can't be submitted without it.`,
      );
      return;
    }
    setFields((prev) => prev.filter((_, i) => i !== index));
    setOpen(null);
    touch();
  }

  function add(type: FormFieldType) {
    setFields((prev) => {
      const taken = new Set(prev.map((f) => f.key));
      let draft = blankField(type, prev.length);
      let n = prev.length + 1;
      while (taken.has(draft.key)) draft = blankField(type, n++);
      return [...prev, draft];
    });
    setOpen(fields.length);
    touch();
  }

  function changeType(index: number, type: FormFieldType) {
    const field = fields[index]!;
    if (field.locked) {
      toast.error(`"${field.label}" has a fixed type — the handler needs it.`);
      return;
    }
    const seed = blankField(type, index);
    setField(index, {
      type,
      // Switching into a list type with nothing to list would save a dead
      // control, so seed one option the editor can rename.
      options:
        hasOptions(type) && (field.options?.length ?? 0) === 0
          ? [{ label: "First option", value: "first_option", intent: null }]
          : field.options,
      rows: type === "textarea" ? (field.rows ?? 4) : null,
      // A slider needs a scale to be saveable at all, so retyping into one
      // borrows the same defaults a brand-new slider gets.
      min: type === "range" ? (field.min ?? seed.min) : field.min,
      max: type === "range" ? (field.max ?? seed.max) : field.max,
      step: type === "range" ? (field.step ?? seed.step) : null,
      unit: type === "range" ? field.unit : null,
    });

    // Anything depending on this field's answers depended on it having some.
    if (!hasOptions(type)) {
      setFields((prev) =>
        prev.map((f) =>
          f.showWhen?.field === field.key ? { ...f, showWhen: null } : f,
        ),
      );
    }
  }

  function save() {
    const payload: FormSaveInput = {
      key: form.key,
      enabled,
      notify_emails: notify
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      copy,
      fields: fields.map((f) => ({
        ...f,
        options: (f.options ?? []).map((o) => ({
          ...o,
          value: o.value.trim() || slugifyOptionValue(o.label),
        })),
      })),
    };

    startTransition(async () => {
      const result = await saveForm(payload);
      if (result.status === "ok") {
        setDirty(false);
        setIssues([]);
        toast.success(result.message);
        router.refresh();
        return;
      }
      if (result.status === "invalid") {
        setIssues(result.issues);
        toast.error(result.message);
        return;
      }
      toast.error(result.message);
    });
  }

  function revert() {
    startTransition(async () => {
      const result = await resetForm(form.key);
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-medium">{def.name}</h2>
            <span
              className={cn(
                "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                enabled
                  ? "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]"
                  : "bg-bz-surface-2 text-bz-ink-2",
              )}
            >
              {enabled ? "Live" : "Off"}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-bz-muted max-w-[76ch] leading-relaxed">
            {def.description}
          </p>
          <p className="mt-1 mono text-[11px] text-bz-muted-2">
            {def.surface} · {def.path}
            {def.alsoOn?.length ? ` · also on ${def.alsoOn.join(", ")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={def.path} target="_blank">
              <ExternalLink size={13} strokeWidth={1.7} />
              View on site
            </Link>
          </Button>
          <Button size="sm" onClick={save} disabled={pending || !dirty}>
            <Save size={13} strokeWidth={1.8} />
            {pending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </div>

      {form.usingDefaults ? (
        <p className="text-[12.5px] text-bz-muted-2 rounded border border-bz-border bg-bz-surface p-3">
          Nothing has been changed here yet — this is the form exactly as it
          ships. Saving takes ownership of it; “Revert to the built-in form” in
          Settings hands it back.
        </p>
      ) : null}

      {issues.length > 0 ? (
        <ul className="rounded border border-bz-danger/40 bg-bz-surface p-3 text-[12.5px] text-bz-danger flex flex-col gap-1">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-bz-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "relative -mb-px px-3 py-2 text-[12.5px] border-b-2 transition-colors",
              tab === t.key
                ? "border-bz-accent text-bz-ink"
                : "border-transparent text-bz-muted hover:text-bz-ink",
            )}
          >
            {t.label}
            {t.key === "responses" && unread > 0 ? (
              <span className="ml-1.5 inline-flex items-center h-[16px] px-1.5 rounded-full bg-bz-accent-soft text-bz-accent text-[10px] font-medium">
                {unread}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "content" ? (
        <ContentTab
          copy={copy}
          editable={editsCopy}
          ownsTitle={!def.headingSource || def.copy.title !== null}
          headingHref={headingHref}
          headingNote={def.headingSource?.note ?? null}
          onChange={(patch) => {
            setCopy((prev) => ({ ...prev, ...patch }));
            touch();
          }}
        />
      ) : null}

      {tab === "fields" ? (
        <FieldsTab
          fields={fields}
          editable={editsFields}
          open={open}
          setOpen={setOpen}
          onAdd={add}
          onRemove={remove}
          onMove={move}
          onChange={setField}
          onChangeType={changeType}
        />
      ) : null}

      {tab === "responses" ? (
        <ResponsesTable
          formName={def.name}
          formKey={form.key}
          fields={form.fields}
          rows={submissions}
          error={submissionsError}
        />
      ) : null}

      {tab === "settings" ? (
        <SettingsTab
          enabled={enabled}
          alwaysOn={def.alwaysOn === true}
          notify={notify}
          headingHref={headingHref}
          headingNote={def.headingSource?.note ?? null}
          usingDefaults={form.usingDefaults}
          pending={pending}
          onToggle={(v) => {
            setEnabled(v);
            touch();
          }}
          onNotify={(v) => {
            setNotify(v);
            touch();
          }}
          onRevert={revert}
        />
      ) : null}
    </div>
  );
}

// ── content ──────────────────────────────────────────────────────────────

function ContentTab({
  copy,
  editable,
  ownsTitle,
  headingHref,
  headingNote,
  onChange,
}: {
  copy: ResolvedForm["copy"];
  editable: boolean;
  ownsTitle: boolean;
  headingHref: string | null;
  headingNote: string | null;
  onChange: (patch: Partial<ResolvedForm["copy"]>) => void;
}) {
  if (!editable) {
    return (
      <div className="flex flex-col gap-3 text-[12.5px]">
        <p className="rounded border border-bz-border bg-bz-surface p-3 text-bz-muted max-w-[76ch] leading-relaxed">
          This form&apos;s wording is edited on its page, not here — it was
          already there before this screen existed, and two writable copies of
          one string is a bug waiting to happen.{" "}
          {headingHref ? (
            <Link
              href={headingHref}
              className="text-bz-accent underline underline-offset-2"
            >
              Open it in Pages &amp; blocks →
            </Link>
          ) : null}
        </p>
        <dl className="grid gap-2 sm:grid-cols-2">
          {[
            ["Button", copy.submit_label],
            ["While sending", copy.pending_label],
            ["Confirmation heading", copy.success_title],
            ["Confirmation copy", copy.success_body],
            ["Small print", copy.consent_note ?? "—"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded border border-bz-border bg-bz-surface p-3"
            >
              <dt className="eyebrow">{label}</dt>
              <dd className="mt-1 text-bz-ink-2 leading-relaxed">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-[70ch]">
      {headingHref ? (
        <p className="text-[12.5px] text-bz-muted rounded border border-bz-border bg-bz-surface p-3 leading-relaxed">
          The heading and artwork around this form live in Pages &amp; blocks
          {headingNote ? ` — ${headingNote.toLowerCase()}` : ""}.{" "}
          <Link
            href={headingHref}
            className="text-bz-accent underline underline-offset-2"
          >
            Edit them there →
          </Link>
        </p>
      ) : null}

      {ownsTitle ? (
        <>
          <Text
            label="Heading"
            help="Shown above the fields. `{project}` and `{reference}` are filled in from the page."
            value={copy.title ?? ""}
            onChange={(v) => onChange({ title: v || null })}
          />
          <Area
            label="Sub-heading"
            value={copy.subtitle ?? ""}
            onChange={(v) => onChange({ subtitle: v || null })}
          />
        </>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Text
          label="Button label"
          value={copy.submit_label}
          onChange={(v) => onChange({ submit_label: v })}
        />
        <Text
          label="While sending"
          help="What the button says between the click and the confirmation."
          value={copy.pending_label}
          onChange={(v) => onChange({ pending_label: v })}
        />
      </div>

      <Text
        label="Confirmation heading"
        value={copy.success_title}
        onChange={(v) => onChange({ success_title: v })}
      />
      <Area
        label="Confirmation copy"
        help="What the visitor reads once it's sent. Say what happens next and by when."
        value={copy.success_body}
        onChange={(v) => onChange({ success_body: v })}
      />
      <Area
        label="Small print"
        help="Sits under the button. Leave blank to hide it."
        value={copy.consent_note ?? ""}
        onChange={(v) => onChange({ consent_note: v || null })}
      />
    </div>
  );
}

// ── fields ───────────────────────────────────────────────────────────────

function FieldsTab({
  fields,
  editable,
  open,
  setOpen,
  onAdd,
  onRemove,
  onMove,
  onChange,
  onChangeType,
}: {
  fields: FormFieldSaveInput[];
  editable: boolean;
  open: number | null;
  setOpen: (index: number | null) => void;
  onAdd: (type: FormFieldType) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, delta: number) => void;
  onChange: (index: number, patch: Partial<FormFieldSaveInput>) => void;
  onChangeType: (index: number, type: FormFieldType) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {!editable ? (
        <p className="text-[12.5px] text-bz-muted rounded border border-bz-border bg-bz-surface p-3 max-w-[76ch] leading-relaxed">
          This form draws its own inputs — a two-step wizard, a verification
          step, or a single locked box. The fields below are what it asks, shown
          so the record is complete; changing them here would have no effect on
          the page, so the controls are off rather than misleading.
        </p>
      ) : (
        <p className="text-[12.5px] text-bz-muted max-w-[76ch] leading-relaxed">
          Drag order, wording and type all take effect on the next page load.
          Half-width fields pair up with the next half-width field beneath them.
          A field marked <Lock size={11} className="inline -mt-0.5" /> is one
          the form can&apos;t be submitted without.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {fields.map((field, index) => (
          <li
            key={`${field.key}-${index}`}
            className={cn(
              "rounded border bg-bz-surface",
              field.enabled ? "border-bz-border" : "border-dashed border-bz-border",
            )}
          >
            <div className="flex items-center gap-2 p-2.5">
              <span className="mono text-[11px] text-bz-muted-2 w-6 shrink-0">
                {index + 1}
              </span>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setOpen(open === index ? null : index)}
              >
                <span
                  className={cn(
                    "text-[13px]",
                    field.enabled ? "" : "text-bz-muted line-through",
                  )}
                >
                  {field.label}
                </span>
                <span className="ml-2 text-[11.5px] text-bz-muted-2">
                  {FORM_FIELD_TYPE_LABELS[field.type]}
                  {field.required ? " · required" : ""}
                  {field.width === "half" ? " · half width" : ""}
                  {field.mapping !== "custom"
                    ? ` · ${FORM_FIELD_MAPPING_LABELS[field.mapping]}`
                    : ""}
                  {field.showWhen
                    ? ` · only when ${field.showWhen.field} is ${field.showWhen.values.join(" or ")}`
                    : ""}
                </span>
              </button>
              {field.locked ? (
                <Lock size={12} className="text-bz-muted-2 shrink-0" />
              ) : null}
              {editable ? (
                <div className="flex items-center gap-0.5 shrink-0">
                  <IconButton
                    label="Move up"
                    onClick={() => onMove(index, -1)}
                    disabled={index === 0}
                  >
                    <ChevronUp size={14} strokeWidth={1.8} />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    onClick={() => onMove(index, 1)}
                    disabled={index === fields.length - 1}
                  >
                    <ChevronDown size={14} strokeWidth={1.8} />
                  </IconButton>
                  <IconButton
                    label={field.enabled ? "Hide this field" : "Show this field"}
                    onClick={() =>
                      onChange(index, { enabled: !field.enabled })
                    }
                    disabled={field.locked}
                  >
                    {field.enabled ? (
                      <Eye size={14} strokeWidth={1.7} />
                    ) : (
                      <EyeOff size={14} strokeWidth={1.7} />
                    )}
                  </IconButton>
                  <IconButton
                    label="Delete this field"
                    onClick={() => onRemove(index)}
                    disabled={field.locked}
                  >
                    <Trash2 size={14} strokeWidth={1.7} />
                  </IconButton>
                </div>
              ) : null}
            </div>

            {open === index ? (
              <FieldDetail
                field={field}
                // Only the questions asked *before* this one, and only the
                // ones with a fixed set of answers — a condition needs
                // something to match against, and something already answered.
                candidates={fields
                  .slice(0, index)
                  .filter((f) => hasOptions(f.type) && !f.optionSource)}
                editable={editable}
                onChange={(patch) => onChange(index, patch)}
                onChangeType={(type) => onChangeType(index, type)}
              />
            ) : null}
          </li>
        ))}
      </ul>

      {editable ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[12px] text-bz-muted-2">Add a field:</span>
          {FORM_FIELD_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onAdd(type)}
              className="inline-flex items-center gap-1 h-7 px-2 rounded border border-bz-border bg-bz-surface text-[11.5px] text-bz-ink-2 hover:border-bz-accent transition-colors"
            >
              <Plus size={11} strokeWidth={2} />
              {FORM_FIELD_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FieldDetail({
  field,
  candidates,
  editable,
  onChange,
  onChangeType,
}: {
  field: FormFieldSaveInput;
  candidates: FormFieldSaveInput[];
  editable: boolean;
  onChange: (patch: Partial<FormFieldSaveInput>) => void;
  onChangeType: (type: FormFieldType) => void;
}) {
  const disabled = !editable;
  return (
    <div className="border-t border-bz-border p-3 flex flex-col gap-3 bg-bz-bg/40">
      <div className="grid gap-3 sm:grid-cols-2">
        <Text
          label="Label"
          value={field.label}
          disabled={disabled}
          onChange={(v) => onChange({ label: v })}
        />
        <div className="flex flex-col gap-1">
          <Label className="text-[12px]">Type</Label>
          <select
            className={fieldCls}
            value={field.type}
            disabled={disabled || field.locked}
            onChange={(e) => onChangeType(e.target.value as FormFieldType)}
          >
            {FORM_FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FORM_FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Text
          label="Placeholder"
          value={field.placeholder ?? ""}
          disabled={disabled}
          onChange={(v) => onChange({ placeholder: v || null })}
        />
        <div className="flex flex-col gap-1">
          <Label className="text-[12px]">Where the answer goes</Label>
          <select
            className={fieldCls}
            value={field.mapping}
            disabled={disabled || field.locked}
            onChange={(e) =>
              onChange({ mapping: e.target.value as FormFieldMapping })
            }
          >
            {FORM_FIELD_MAPPINGS.map((m) => (
              <option key={m} value={m}>
                {FORM_FIELD_MAPPING_LABELS[m]}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-bz-muted-2">
            “Extra question” answers are appended to the enquiry an advisor
            reads, and kept in full under Responses.
          </span>
        </div>
      </div>

      <Text
        label="Helper text"
        help="Shown to the visitor under the input. Leave blank for none."
        value={field.help ?? ""}
        disabled={disabled}
        onChange={(v) => onChange({ help: v || null })}
      />

      {field.note ? (
        <p className="text-[11.5px] text-bz-muted-2 rounded border border-bz-border bg-bz-surface p-2.5">
          {field.note}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Check
          label="Required"
          checked={field.required}
          disabled={disabled}
          onChange={(v) => onChange({ required: v })}
        />
        <Check
          label="Half width"
          checked={field.width === "half"}
          disabled={disabled}
          onChange={(v) => onChange({ width: v ? "half" : "full" })}
        />
        {field.type === "textarea" ? (
          <label className="flex items-center gap-2 text-[12px] text-bz-ink-2">
            Rows
            <input
              type="number"
              min={2}
              max={12}
              className={cn(fieldCls, "w-16")}
              value={field.rows ?? 4}
              disabled={disabled}
              onChange={(e) => onChange({ rows: Number(e.target.value) })}
            />
          </label>
        ) : null}
        {field.type === "number" || field.type === "range" ? (
          <>
            <label className="flex items-center gap-2 text-[12px] text-bz-ink-2">
              Min
              <input
                type="number"
                className={cn(fieldCls, "w-24")}
                value={field.min ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    min: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-[12px] text-bz-ink-2">
              Max
              <input
                type="number"
                className={cn(fieldCls, "w-24")}
                value={field.max ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    max: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          </>
        ) : null}
        {field.type === "range" ? (
          <>
            <label className="flex items-center gap-2 text-[12px] text-bz-ink-2">
              Step
              <input
                type="number"
                min={1}
                className={cn(fieldCls, "w-28")}
                value={field.step ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    step: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-[12px] text-bz-ink-2">
              Unit
              <input
                className={cn(fieldCls, "w-20")}
                placeholder="AED"
                value={field.unit ?? ""}
                disabled={disabled}
                onChange={(e) => onChange({ unit: e.target.value || null })}
              />
            </label>
          </>
        ) : null}
      </div>

      {field.type === "range" ? (
        <p className="text-[11.5px] text-bz-muted-2">
          Both handles are submitted as one answer. A handle left at its end of
          the scale means “no limit that side”; both left alone means the
          visitor didn&apos;t say, and nothing is filed against the lead.
        </p>
      ) : null}

      <ConditionEditor
        condition={field.showWhen ?? null}
        candidates={candidates}
        disabled={disabled}
        onChange={(showWhen) => onChange({ showWhen })}
      />

      {field.optionSource ? (
        <p className="text-[12px] text-bz-muted-2 rounded border border-bz-border bg-bz-surface p-2.5">
          Options come from live records —{" "}
          <strong className="font-medium text-bz-ink-2">
            {FORM_OPTION_SOURCE_LABELS[field.optionSource]}
          </strong>
          . They update themselves; there is nothing to type here.
        </p>
      ) : hasOptions(field.type) ? (
        <OptionsEditor
          options={field.options ?? []}
          disabled={disabled}
          showIntent={field.mapping === "intent"}
          onChange={(options) => onChange({ options })}
        />
      ) : null}
    </div>
  );
}

/**
 * "Ask this only when …".
 *
 * The candidate list is the questions above this one that have a fixed set of
 * answers, so the two ways to build a broken branch — depending on a question
 * asked later, or on one that can be answered with anything — aren't offered
 * rather than being rejected on save. A field whose condition can't be met is
 * never shown, so this control has to be hard to get wrong.
 */
function ConditionEditor({
  condition,
  candidates,
  disabled,
  onChange,
}: {
  condition: FormFieldCondition | null;
  candidates: FormFieldSaveInput[];
  disabled: boolean;
  onChange: (condition: FormFieldCondition | null) => void;
}) {
  const controller = condition
    ? candidates.find((f) => f.key === condition.field)
    : null;

  if (candidates.length === 0) {
    return condition ? (
      <p className="text-[11.5px] text-bz-danger rounded border border-bz-danger/40 bg-bz-surface p-2.5">
        This field depends on <span className="mono">{condition.field}</span>,
        which is no longer a question with fixed answers above it. Clear the
        condition or put that question back — the field is hidden until then.
      </p>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-bz-border bg-bz-surface p-2.5">
      <Label className="text-[12px]">Only ask this when…</Label>
      <select
        className={fieldCls}
        value={condition?.field ?? ""}
        disabled={disabled}
        onChange={(e) => {
          const key = e.target.value;
          if (!key) return onChange(null);
          onChange({ field: key, values: [] });
        }}
      >
        <option value="">Always ask it</option>
        {candidates.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>

      {condition && controller ? (
        <>
          <span className="text-[11.5px] text-bz-muted-2">
            …is answered with any of:
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {(controller.options ?? []).map((option) => {
              const value = option.value || option.label;
              const on = condition.values.includes(value);
              return (
                <Check
                  key={value}
                  label={option.label}
                  checked={on}
                  disabled={disabled}
                  onChange={(next) =>
                    onChange({
                      ...condition,
                      values: next
                        ? [...condition.values, value]
                        : condition.values.filter((v) => v !== value),
                    })
                  }
                />
              );
            })}
          </div>
          {condition.values.length === 0 ? (
            <span className="text-[11.5px] text-bz-danger">
              Pick at least one answer, or this field is never asked.
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function OptionsEditor({
  options,
  disabled,
  showIntent,
  onChange,
}: {
  options: NonNullable<FormFieldSaveInput["options"]>;
  disabled: boolean;
  showIntent: boolean;
  onChange: (options: NonNullable<FormFieldSaveInput["options"]>) => void;
}) {
  function set(index: number, patch: Partial<(typeof options)[number]>) {
    onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-[12px]">Options</Label>
      {options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            className={fieldCls}
            value={option.label}
            placeholder="What the visitor reads"
            disabled={disabled}
            onChange={(e) => set(index, { label: e.target.value })}
          />
          <input
            className={cn(fieldCls, "max-w-[180px]")}
            value={option.value}
            placeholder="stored value (optional)"
            disabled={disabled}
            onChange={(e) => set(index, { value: e.target.value })}
          />
          {showIntent ? (
            <select
              className={cn(fieldCls, "max-w-[130px]")}
              value={option.intent ?? ""}
              disabled={disabled}
              onChange={(e) => set(index, { intent: e.target.value || null })}
            >
              <option value="">No tag</option>
              {["buy", "sell", "rent", "invest", "manage"].map((i) => (
                <option key={i} value={i}>
                  Tag as {i}
                </option>
              ))}
            </select>
          ) : null}
          <IconButton
            label="Remove this option"
            disabled={disabled || options.length <= 1}
            onClick={() => onChange(options.filter((_, i) => i !== index))}
          >
            <Trash2 size={13} strokeWidth={1.7} />
          </IconButton>
        </div>
      ))}
      {!disabled ? (
        <button
          type="button"
          onClick={() =>
            onChange([...options, { label: "", value: "", intent: null }])
          }
          className="self-start inline-flex items-center gap-1 h-7 px-2 rounded border border-bz-border bg-bz-surface text-[11.5px] text-bz-ink-2 hover:border-bz-accent transition-colors"
        >
          <Plus size={11} strokeWidth={2} />
          Add an option
        </button>
      ) : null}
      <span className="text-[11px] text-bz-muted-2">
        Leave the stored value blank and it is derived from the label. Changing
        a stored value doesn&apos;t rewrite answers already collected.
      </span>
    </div>
  );
}

// ── settings ─────────────────────────────────────────────────────────────

function SettingsTab({
  enabled,
  alwaysOn,
  notify,
  headingHref,
  headingNote,
  usingDefaults,
  pending,
  onToggle,
  onNotify,
  onRevert,
}: {
  enabled: boolean;
  alwaysOn: boolean;
  notify: string;
  headingHref: string | null;
  headingNote: string | null;
  usingDefaults: boolean;
  pending: boolean;
  onToggle: (value: boolean) => void;
  onNotify: (value: string) => void;
  onRevert: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 max-w-[70ch]">
      <div className="rounded border border-bz-border bg-bz-surface p-4">
        <Check
          label="Show this form on the site"
          checked={enabled}
          disabled={alwaysOn}
          onChange={onToggle}
        />
        <p className="mt-2 text-[12px] text-bz-muted leading-relaxed">
          {alwaysOn
            ? "This one can't be switched off — it is the site's only unconditional way to reach you, and hiding it would leave the contact page with nothing on it."
            : "Off removes the form from the page. The heading and artwork around it belong to the page's own section, which has its own switch in Pages & blocks."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[12px]">Notify these addresses</Label>
        <input
          className={fieldCls}
          value={notify}
          placeholder="sales@bazar.ae, desk@bazar.ae"
          onChange={(e) => onNotify(e.target.value)}
        />
        <span className="text-[11px] text-bz-muted-2">
          Comma-separated, and on top of the routing rules in Settings → Lead
          routing. Leave blank to rely on routing alone.
        </span>
      </div>

      {headingHref ? (
        <div className="rounded border border-bz-border bg-bz-surface p-4">
          <div className="eyebrow">Page copy</div>
          <p className="mt-1.5 text-[12.5px] text-bz-muted leading-relaxed">
            {headingNote}
          </p>
          <Link
            href={headingHref}
            className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-bz-accent underline underline-offset-2"
          >
            Open in Pages &amp; blocks
            <ExternalLink size={12} strokeWidth={1.7} />
          </Link>
        </div>
      ) : null}

      <div className="rounded border border-bz-border bg-bz-surface p-4">
        <div className="eyebrow">Revert</div>
        <p className="mt-1.5 text-[12.5px] text-bz-muted leading-relaxed">
          Throws away every change made here and puts the built-in form back —
          its fields, their order, its button and its confirmation. Responses
          already collected are untouched.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={pending || usingDefaults}
          onClick={onRevert}
        >
          <RotateCcw size={13} strokeWidth={1.7} />
          {usingDefaults ? "Already the built-in form" : "Revert to the built-in form"}
        </Button>
      </div>
    </div>
  );
}

// ── small controls ───────────────────────────────────────────────────────

function Text({
  label,
  help,
  value,
  disabled,
  onChange,
}: {
  label: string;
  help?: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[12px]">{label}</Label>
      <input
        className={fieldCls}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {help ? (
        <span className="text-[11px] text-bz-muted-2">{help}</span>
      ) : null}
    </div>
  );
}

function Area({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[12px]">{label}</Label>
      <textarea
        className={cn(fieldCls, "resize-y")}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {help ? (
        <span className="text-[11px] text-bz-muted-2">{help}</span>
      ) : null}
    </div>
  );
}

function Check({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 text-[12.5px]",
        disabled ? "text-bz-muted-2" : "text-bz-ink-2",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-bz-navy"
      />
      {label}
    </label>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-ink-2 hover:bg-bz-surface-2 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
    >
      {children}
    </button>
  );
}
