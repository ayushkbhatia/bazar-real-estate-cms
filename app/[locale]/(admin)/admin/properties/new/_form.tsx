"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  propertyCreateSchema,
  type PropertyCreateInput,
  formForMode,
  isSaleMode,
  PROPERTY_FORMS,
  PROPERTY_FORM_HELP,
  PROPERTY_FORM_HINTS,
  PROPERTY_FORM_LABELS,
  PROPERTY_MODE_LABELS,
  PROPERTY_MODES,
  PROPERTY_SEGMENT_LABELS,
  PROPERTY_SEGMENTS,
  PROPERTY_TYPES,
} from "@/lib/schemas/property";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardLabelPicker } from "@/components/brand/card-label-picker";
import type { CardLabel } from "@/lib/card-labels";
import { createProperty } from "./_actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="text-[12px] text-[oklch(0.45_0.13_28)]">{message}</span>
  );
}

const TYPE_LABELS: Record<(typeof PROPERTY_TYPES)[number], string> = {
  apartment: "Apartment",
  villa: "Villa",
  penthouse: "Penthouse",
  townhouse: "Townhouse",
  commercial: "Commercial",
  land: "Land",
  hotel_apartment: "Hotel apartment",
  office: "Office",
  building: "Building",
  retail: "Retail",
  commercial_villa: "Commercial villa",
};

const UNSET = "__unset__";

const DEFAULTS: PropertyCreateInput = {
  title: "",
  type: "apartment",
  mode: "buy",
  // The catalogue is almost entirely residential, so this is the answer that
  // is right without being touched — and the DB default behind it agrees.
  segment: "residential",
  price_aed: 0,
  beds: 1,
  baths: 1,
  property_form: null,
};

export function NewPropertyForm({
  cardLabels,
}: {
  /** The saved vocabulary, resolved on the server — see lib/card-labels.ts. */
  cardLabels: CardLabel[];
}) {
  const [labels, setLabels] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string>
  >({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<PropertyCreateInput>({
    resolver: zodResolver(propertyCreateSchema),
    defaultValues: DEFAULTS,
  });

  const type = watch("type");
  const mode = watch("mode");
  const segment = watch("segment") ?? "residential";
  const propertyForm = watch("property_form") ?? null;
  const showForm = isSaleMode(mode);

  /** Changing mode can invalidate the form value — a rent row with a form is
   *  rejected by the DB CHECK, and the picker is hidden outside sale modes.
   *  Clear it here rather than shipping a value the operator can't see. */
  const onModeChange = (next: PropertyCreateInput["mode"]) => {
    setValue("mode", next);
    setValue("property_form", formForMode(next, propertyForm));
  };

  const onSubmit = (values: PropertyCreateInput) => {
    setServerFieldErrors({});
    startTransition(async () => {
      // Labels ride alongside rather than inside `values`: they are a key in
      // the `flags` jsonb, not a column, and `propertyCreateSchema` is shared
      // with the edit form, the importer and the public query.
      const result = await createProperty(values, labels);
      if (result.status === "error") {
        toast.error(result.message);
        if (result.fieldErrors) setServerFieldErrors(result.fieldErrors);
      }
      // On success, the server action redirects — we don't reach this branch.
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5 max-w-2xl"
    >
      <div className="bg-bz-surface border border-bz-border rounded-lg p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" {...register("title")} autoFocus />
          <span className="text-[11.5px] text-bz-muted">
            We&apos;ll auto-generate a reference and URL slug from this. You
            can refine both later.
          </span>
          <FieldError
            message={errors.title?.message ?? serverFieldErrors.title}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Type</Label>
            <Select
              value={type}
              onValueChange={(v) =>
                setValue("type", v as PropertyCreateInput["type"])
              }
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError
              message={errors.type?.message ?? serverFieldErrors.type}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mode">Mode</Label>
            <Select
              value={mode}
              onValueChange={(v) =>
                onModeChange(v as PropertyCreateInput["mode"])
              }
            >
              <SelectTrigger id="mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PROPERTY_MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError
              message={errors.mode?.message ?? serverFieldErrors.mode}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="segment">Segment</Label>
            <Select
              value={segment}
              onValueChange={(v) =>
                setValue("segment", v as PropertyCreateInput["segment"])
              }
            >
              <SelectTrigger id="segment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_SEGMENTS.map((seg) => (
                  <SelectItem key={seg} value={seg}>
                    {PROPERTY_SEGMENT_LABELS[seg]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError
              message={errors.segment?.message ?? serverFieldErrors.segment}
            />
          </div>
        </div>

        {showForm ? (
          <div className="flex flex-col gap-1.5 max-w-sm">
            <Label htmlFor="property_form">Property form</Label>
            <Select
              value={propertyForm ?? UNSET}
              onValueChange={(v) =>
                setValue(
                  "property_form",
                  v === UNSET
                    ? null
                    : (v as NonNullable<PropertyCreateInput["property_form"]>),
                )
              }
            >
              <SelectTrigger id="property_form">
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET}>Not set</SelectItem>
                {PROPERTY_FORMS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {PROPERTY_FORM_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11.5px] text-bz-muted">
              {propertyForm
                ? PROPERTY_FORM_HINTS[propertyForm]
                : PROPERTY_FORM_HELP}
            </span>
            <FieldError
              message={
                errors.property_form?.message ??
                serverFieldErrors.property_form
              }
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="price_aed">Price (AED)</Label>
            <Input
              id="price_aed"
              type="number"
              step="1"
              {...register("price_aed", { valueAsNumber: true })}
            />
            <FieldError
              message={
                errors.price_aed?.message ?? serverFieldErrors.price_aed
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="beds">Beds</Label>
            <Input
              id="beds"
              type="number"
              step="1"
              {...register("beds", { valueAsNumber: true })}
            />
            <FieldError
              message={errors.beds?.message ?? serverFieldErrors.beds}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="baths">Baths</Label>
            <Input
              id="baths"
              type="number"
              step="1"
              {...register("baths", { valueAsNumber: true })}
            />
            <FieldError
              message={errors.baths?.message ?? serverFieldErrors.baths}
            />
          </div>
        </div>
      </div>

      {/*
        Card labels, in the wizard rather than only on the edit screen.

        The two that shipped before this — Exclusive, Vacant on transfer —
        had no control anywhere in the CMS: the wizard wrote `flags: {}` and
        nothing else ever set them, so the badges could only come from data
        seeded outside the product. Whether a listing is exclusive is known at
        the moment it is created, which is here.
      */}
      <div className="bg-bz-surface border border-bz-border rounded-lg p-6 flex flex-col gap-3">
        <div>
          <Label>Card labels</Label>
          <p className="mt-1 text-[12px] text-bz-muted">
            Drawn over the listing’s photograph. Edit the vocabulary under
            Settings → Card labels.
          </p>
        </div>
        <CardLabelPicker
          vocabulary={cardLabels}
          value={labels}
          onChange={setLabels}
          disabled={pending}
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          <Plus size={14} strokeWidth={1.8} />
          {pending ? "Creating…" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
