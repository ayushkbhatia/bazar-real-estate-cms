"use client";

import { useState, useTransition } from "react";
import {
  AMENITY_CATEGORIES,
  AMENITY_CATEGORY_LABELS,
} from "@/lib/schemas/amenity-taxonomy";
import { toggleAmenityActive, createAmenity, setAmenityArabic } from "./_actions";

type ToggleProps = {
  code: string;
  active: boolean;
};

export function AmenityActiveToggle({ code, active }: ToggleProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const next = !active;
  const label = active ? "Deactivate" : "Activate";

  return (
    <button
      type="button"
      disabled={pending}
      className={
        active
          ? "text-[10.5px] mono uppercase tracking-wider text-bz-muted hover:text-bz-accent"
          : "text-[10.5px] mono uppercase tracking-wider text-bz-accent hover:underline"
      }
      onClick={() => {
        setError(null);
        startTransition(async () => {
          const res = await toggleAmenityActive(code, next);
          if (res.status === "error") setError(res.message);
        });
      }}
      title={error ?? `Click to ${label.toLowerCase()}`}
    >
      {pending ? "…" : active ? "Active" : "Inactive"}
    </button>
  );
}

/**
 * The Arabic twin for one existing row, editable in place.
 *
 * Saves on blur (and on Enter) rather than behind a button, because this
 * screen is a hundred-and-four-row list and the job it now exists for is a
 * translation pass down the whole thing — a Save click per row would triple
 * the work. The row reports its own state instead: idle, saving, saved, or the
 * server's message.
 *
 * `suggestion` is what the Arabic store already holds for this English. It
 * shows as a placeholder, not as a value: the public page falls back to it
 * anyway, so pre-filling the input would make an editor think they had checked
 * a word they never saw. Clicking "use" adopts it, which is the same word plus
 * a person's assent — which is exactly what ADR-0008 asks for.
 */
export function AmenityArabicField({
  code,
  initial,
  suggestion,
}: {
  code: string;
  initial: string | null;
  suggestion: string | null;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState<string>(initial ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(next: string) {
    const trimmed = next.replace(/\s+/g, " ").trim();
    if (trimmed === saved.replace(/\s+/g, " ").trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await setAmenityArabic(code, trimmed);
      if (res.status === "error") {
        setError(res.message);
        return;
      }
      setSaved(trimmed);
    });
  }

  const dirty = value.replace(/\s+/g, " ").trim() !== saved;

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <input
        dir="rtl"
        lang="ar"
        value={value}
        maxLength={90}
        disabled={pending}
        aria-label={`Arabic for ${code}`}
        placeholder={suggestion ?? "العربية"}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save((e.target as HTMLInputElement).value);
          }
          if (e.key === "Escape") setValue(saved);
        }}
        className={
          error
            ? "h-7 flex-1 min-w-0 rounded border border-red-500 bg-white px-2 text-[12.5px]"
            : saved === ""
              ? "h-7 flex-1 min-w-0 rounded border border-amber-400/70 bg-white px-2 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-bz-accent"
              : "h-7 flex-1 min-w-0 rounded border border-bz-border bg-white px-2 text-[12.5px] focus:outline-none focus:ring-1 focus:ring-bz-accent"
        }
      />
      {pending ? (
        <span className="text-[10.5px] text-bz-muted">…</span>
      ) : error ? (
        <span className="text-[10.5px] text-red-600" title={error}>
          !
        </span>
      ) : dirty ? null : suggestion && saved === "" ? (
        <button
          type="button"
          onClick={() => {
            setValue(suggestion);
            save(suggestion);
          }}
          className="text-[10.5px] mono uppercase tracking-wider text-bz-accent hover:underline shrink-0"
          title={`Use “${suggestion}”`}
        >
          use
        </button>
      ) : null}
    </div>
  );
}

export function AddAmenityForm() {
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="mt-4 rounded-md border border-bz-border bg-bz-surface p-4 max-w-[640px] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget as HTMLFormElement);
        setError(null);
        setFieldErrors({});
        setSuccess(false);
        startTransition(async () => {
          const res = await createAmenity({
            code: fd.get("code"),
            label: fd.get("label"),
            label_ar: fd.get("label_ar"),
            category: fd.get("category"),
            icon: fd.get("icon"),
            sort_order: fd.get("sort_order"),
          });
          if (res.status === "error") {
            setError(res.message);
            setFieldErrors(res.fieldErrors ?? {});
          } else {
            setSuccess(true);
            (e.target as HTMLFormElement).reset();
          }
        });
      }}
    >
      <Field label="Code" name="code" placeholder="rooftop_lounge" error={fieldErrors.code} />
      <Field label="Label" name="label" placeholder="Rooftop lounge" error={fieldErrors.label} />
      {/* A plain field rather than the collapsible ArabicTwin: this is an
          uncontrolled FormData form with no per-field state to hang a toggle
          on, and the row is four inputs wide, so a second one costs nothing. */}
      <Field
        label="Label (العربية)"
        name="label_ar"
        placeholder="صالة السطح"
        dir="rtl"
        lang="ar"
        error={fieldErrors.label_ar}
      />
      <SelectField
        label="Category"
        name="category"
        options={AMENITY_CATEGORIES.map((c) => ({
          value: c,
          label: AMENITY_CATEGORY_LABELS[c],
        }))}
        error={fieldErrors.category}
      />
      <Field label="Icon (optional)" name="icon" placeholder="lucide name" />
      <Field
        label="Sort order"
        name="sort_order"
        type="number"
        placeholder="220"
        error={fieldErrors.sort_order}
      />
      <div className="flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-bz-ink text-white text-[12.5px] py-2.5 hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add amenity"}
        </button>
      </div>
      {error ? (
        <div className="col-span-full text-[12px] text-red-600">{error}</div>
      ) : null}
      {success ? (
        <div className="col-span-full text-[12px] text-bz-accent">
          Added. Reload to see it grouped by category.
        </div>
      ) : null}
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  error,
  dir,
  lang,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  error?: string;
  /** "rtl" on the Arabic input, so the caret starts on the right. */
  dir?: "ltr" | "rtl";
  lang?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11.5px] uppercase tracking-wider text-bz-muted">
        {label}
      </span>
      <input
        name={name}
        type={type}
        dir={dir}
        lang={lang}
        placeholder={placeholder}
        className={
          error
            ? "h-9 rounded-md border border-red-500 bg-white px-2.5 text-[13px]"
            : "h-9 rounded-md border border-bz-border bg-white px-2.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-bz-accent"
        }
      />
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  error,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11.5px] uppercase tracking-wider text-bz-muted">
        {label}
      </span>
      <select
        name={name}
        defaultValue={options[0]?.value}
        className={
          error
            ? "h-9 rounded-md border border-red-500 bg-white px-2.5 text-[13px]"
            : "h-9 rounded-md border border-bz-border bg-white px-2.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-bz-accent"
        }
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
    </label>
  );
}
