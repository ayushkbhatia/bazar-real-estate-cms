"use client";

import { useState, useTransition } from "react";
import {
  AMENITY_CATEGORIES,
  AMENITY_CATEGORY_LABELS,
} from "@/lib/schemas/amenity-taxonomy";
import { toggleAmenityActive, createAmenity } from "./_actions";

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
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11.5px] uppercase tracking-wider text-bz-muted">
        {label}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        className={
          error
            ? "h-9 rounded-md border border-red-500 bg-white px-2.5 text-[13px]"
            : "h-9 rounded-md border border-bz-border bg-white px-2.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-bz-ink"
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
            : "h-9 rounded-md border border-bz-border bg-white px-2.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-bz-ink"
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
