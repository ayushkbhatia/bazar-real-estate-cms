"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  propertyCreateSchema,
  type PropertyCreateInput,
  PROPERTY_MODES,
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
};

const MODE_LABELS: Record<(typeof PROPERTY_MODES)[number], string> = {
  buy: "For sale",
  rent: "For rent",
  off_plan: "Off-plan",
  commercial: "Commercial",
};

const DEFAULTS: PropertyCreateInput = {
  title: "",
  type: "apartment",
  mode: "buy",
  price_aed: 0,
  beds: 1,
  baths: 1,
};

export function NewPropertyForm() {
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

  const onSubmit = (values: PropertyCreateInput) => {
    setServerFieldErrors({});
    startTransition(async () => {
      const result = await createProperty(values);
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
                setValue("mode", v as PropertyCreateInput["mode"])
              }
            >
              <SelectTrigger id="mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError
              message={errors.mode?.message ?? serverFieldErrors.mode}
            />
          </div>
        </div>

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

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          <Plus size={14} strokeWidth={1.8} />
          {pending ? "Creating…" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}
