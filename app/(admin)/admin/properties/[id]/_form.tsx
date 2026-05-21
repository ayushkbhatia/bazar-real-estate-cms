"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { toast } from "sonner";
import {
  propertyEditSchema,
  type PropertyEditInput,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateProperty } from "./_actions";

type Props = {
  propertyId: string;
  initial: PropertyEditInput;
  reference: string;
};

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

export function PropertyEditForm({ propertyId, initial, reference }: Props) {
  const [pending, startTransition] = useTransition();
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string>
  >({});

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
  } = useForm<PropertyEditInput>({
    resolver: zodResolver(propertyEditSchema),
    defaultValues: initial,
  });

  const type = watch("type");
  const mode = watch("mode");

  const onSubmit = (values: PropertyEditInput) => {
    setServerFieldErrors({});
    startTransition(async () => {
      const result = await updateProperty(propertyId, values);
      if (result.status === "ok") {
        toast.success(result.message ?? "Saved.");
      } else {
        toast.error(result.message);
        if (result.fieldErrors) setServerFieldErrors(result.fieldErrors);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="details" disabled>
            Details
          </TabsTrigger>
          <TabsTrigger value="location" disabled>
            Location
          </TabsTrigger>
          <TabsTrigger value="amenities" disabled>
            Amenities
          </TabsTrigger>
          <TabsTrigger value="seo" disabled>
            SEO
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent
          value="overview"
          className="bg-bz-surface border border-bz-border rounded-lg p-6 mt-6 flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} />
            <FieldError
              message={errors.title?.message ?? serverFieldErrors.title}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="short_description">Short description</Label>
            <textarea
              id="short_description"
              {...register("short_description")}
              rows={3}
              className="border border-bz-border rounded p-2 text-[14px] resize-y bg-bz-surface focus:border-bz-ink-2 outline-none"
            />
            <span className="text-[11.5px] text-bz-muted">
              Used on cards and search results. Keep it under 320 characters.
            </span>
            <FieldError
              message={
                errors.short_description?.message ??
                serverFieldErrors.short_description
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) =>
                  setValue("type", v as PropertyEditInput["type"], {
                    shouldDirty: true,
                  })
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
                  setValue("mode", v as PropertyEditInput["mode"], {
                    shouldDirty: true,
                  })
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
        </TabsContent>

        {/* PRICING */}
        <TabsContent
          value="pricing"
          className="bg-bz-surface border border-bz-border rounded-lg p-6 mt-6 flex flex-col gap-5"
        >
          <div className="grid grid-cols-2 gap-5">
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
              <Label htmlFor="service_charge_per_ft2">
                Service charge (AED / ft² / year)
              </Label>
              <Input
                id="service_charge_per_ft2"
                type="number"
                step="0.1"
                {...register("service_charge_per_ft2", {
                  setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                })}
              />
              <FieldError
                message={
                  errors.service_charge_per_ft2?.message ??
                  serverFieldErrors.service_charge_per_ft2
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-5">
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="built_up_ft2">Built-up (ft²)</Label>
              <Input
                id="built_up_ft2"
                type="number"
                step="1"
                {...register("built_up_ft2", {
                  setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                })}
              />
              <FieldError
                message={
                  errors.built_up_ft2?.message ?? serverFieldErrors.built_up_ft2
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plot_ft2">Plot (ft²)</Label>
              <Input
                id="plot_ft2"
                type="number"
                step="1"
                {...register("plot_ft2", {
                  setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
                })}
              />
              <FieldError
                message={
                  errors.plot_ft2?.message ?? serverFieldErrors.plot_ft2
                }
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-bz-bg pt-3 pb-2">
        <span className="text-[12px] text-bz-muted mr-auto">
          Editing <span className="mono text-bz-ink-2">{reference}</span>
          {isDirty ? " · unsaved changes" : null}
        </span>
        <Button type="submit" disabled={pending || !isDirty}>
          <Save size={14} strokeWidth={1.8} />
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
