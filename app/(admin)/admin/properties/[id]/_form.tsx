"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { toast } from "sonner";
import {
  propertyEditSchema,
  type PropertyEditInput,
  formForMode,
  isSaleMode,
  PROPERTY_FORMS,
  PROPERTY_FORM_HELP,
  PROPERTY_FORM_HINTS,
  PROPERTY_FORM_LABELS,
  PROPERTY_MODE_LABELS,
  PROPERTY_MODES,
  PROPERTY_TYPES,
  TENURES,
  FURNISHINGS,
} from "@/lib/schemas/property";
import { slugify } from "@/lib/slug";
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
import { cn } from "@/lib/utils";
import { setPropertyDeveloper, updateProperty } from "./_actions";
import { LocationPicker } from "./_components/location-picker";
import { AmenitiesPicker } from "./_components/amenities-picker";
import { NewAreaDialog } from "./_components/new-area-dialog";
import { NewDeveloperDialog } from "./_components/new-developer-dialog";
import type { AmenityOption } from "@/lib/amenities";

export type AreaOption = { id: string; name: string; kind: string };
export type DeveloperOption = { id: string; name: string };

type Props = {
  propertyId: string;
  initial: PropertyEditInput;
  reference: string;
  areas: AreaOption[];
  developers: DeveloperOption[];
  geo: { lat: number; lng: number } | null;
  mapboxAvailable: boolean;
  /** Amenity taxonomy, resolved server-side. */
  amenityOptions: AmenityOption[];
  /**
   * Whether this staff member's role may add areas. False hides the "New
   * area" control — the server action would answer with a 404, which reads
   * as a broken page rather than a permission boundary.
   */
  canCreateArea?: boolean;
  /** Same, for the developer catalogue. */
  canCreateDeveloper?: boolean;
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
  office: "Office",
  building: "Building",
  retail: "Retail",
  commercial_villa: "Commercial villa",
};

const TENURE_LABELS: Record<(typeof TENURES)[number], string> = {
  freehold: "Freehold",
  leasehold: "Leasehold",
  usufruct: "Usufruct",
};

const FURNISHING_LABELS: Record<(typeof FURNISHINGS)[number], string> = {
  unfurnished: "Unfurnished",
  semi: "Semi-furnished",
  fully: "Fully furnished",
};

const UNSET = "__unset__";

/** Which tab owns each field, so a failed validation can jump the user to it
 *  instead of failing silently inside an unmounted tab panel. */
const FIELD_TAB: Partial<Record<keyof PropertyEditInput, string>> = {
  title: "overview",
  short_description: "overview",
  type: "overview",
  mode: "overview",
  property_form: "overview",
  developer_id: "overview",
  price_aed: "pricing",
  service_charge_per_ft2: "pricing",
  beds: "pricing",
  baths: "pricing",
  built_up_ft2: "pricing",
  plot_ft2: "pricing",
  year_built: "details",
  tenure: "details",
  furnishing: "details",
  view: "details",
  orientation: "details",
  parking_bays: "details",
  floor: "details",
  address_line: "details",
  listing_permit_no: "details",
  listing_permit_expires_at: "details",
  dld_plot_number: "details",
  area_id: "location",
  amenities: "amenities",
  slug: "seo",
  meta_title: "seo",
  meta_description: "seo",
};

export function PropertyEditForm({
  propertyId,
  initial,
  reference,
  areas,
  developers,
  geo,
  mapboxAvailable,
  amenityOptions,
  canCreateArea = false,
  canCreateDeveloper = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState("overview");
  const [savingDeveloper, setSavingDeveloper] = useState(false);
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
  const propertyForm = watch("property_form") ?? null;
  const showPropertyForm = isSaleMode(mode);
  const developerId = watch("developer_id") ?? "";
  const tenure = watch("tenure") ?? null;
  const furnishing = watch("furnishing") ?? null;
  const areaId = watch("area_id") ?? null;
  const amenities = watch("amenities") ?? [];
  const slug = watch("slug");
  const title = watch("title");

  // Suggest a slug when the user opens the SEO tab on a property whose slug
  // looks empty/default. Auto-fill on change of title if the slug field is
  // currently empty. Don't override a user-set slug.
  useEffect(() => {
    if ((slug === "" || slug == null) && title && title.length >= 3) {
      setValue("slug", slugify(title), { shouldDirty: true });
    }
  }, [title, slug, setValue]);

  // Areas can be added from inside this tab, so the picker's options are
  // local state seeded from the server list rather than the prop itself —
  // a router.refresh() mid-edit would drop unsaved fields.
  const [areaOptions, setAreaOptions] = useState<AreaOption[]>(areas);
  useEffect(() => setAreaOptions(areas), [areas]);

  // Same for developers, which are added from the Overview tab.
  const [developerOptions, setDeveloperOptions] =
    useState<DeveloperOption[]>(developers);
  useEffect(() => setDeveloperOptions(developers), [developers]);

  const sortedDevelopers = useMemo(
    () => [...developerOptions].sort((a, b) => a.name.localeCompare(b.name)),
    [developerOptions],
  );

  const sortedAreas = useMemo(
    () =>
      [...areaOptions].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
        return a.name.localeCompare(b.name);
      }),
    [areaOptions],
  );

  const onSubmit = (values: PropertyEditInput) => {
    setServerFieldErrors({});
    startTransition(async () => {
      const result = await updateProperty(propertyId, values);
      if (result.status === "ok") {
        toast.success(result.message ?? "Saved.");
        // Refresh so the publish card's pre-flight (title/slug/price/permit/
        // developer) re-reads the saved row.
        router.refresh();
      } else {
        toast.error(result.message);
        if (result.fieldErrors) setServerFieldErrors(result.fieldErrors);
      }
    });
  };

  /** Client-side validation failed. The offending field usually lives in a tab
   *  that isn't mounted, so its inline error is invisible and Save looks like
   *  it did nothing. Say what failed and open the tab that owns it. */
  const onInvalid = (formErrors: FieldErrors<PropertyEditInput>) => {
    const first = Object.keys(formErrors)[0] as
      | keyof PropertyEditInput
      | undefined;
    if (!first) return;
    const target = FIELD_TAB[first];
    if (target) setTab(target);
    const message = formErrors[first]?.message;
    toast.error(
      typeof message === "string"
        ? message
        : "Some fields need fixing before saving.",
    );
  };

  /** Mode and property form are coupled: rent rows must have a null form
   *  (DB CHECK `properties_form_rent_null_ck`) and the picker is hidden
   *  outside sale modes. Clear the value on the way out so we never save a
   *  combination the operator can no longer see or fix. */
  const onModeChange = (next: PropertyEditInput["mode"]) => {
    setValue("mode", next, { shouldDirty: true });
    setValue("property_form", formForMode(next, propertyForm), {
      shouldDirty: true,
    });
    setServerFieldErrors((prev) => ({ ...prev, property_form: "" }));
  };

  /** Save the developer as soon as it's picked — the publish gate reads it
   *  from the saved row, so deferring it to the form save is what made
   *  "Developer is set" look stuck. */
  const onDeveloperChange = (developerId: string) => {
    setValue("developer_id", developerId, { shouldDirty: true });
    setServerFieldErrors((prev) => ({ ...prev, developer_id: "" }));
    setSavingDeveloper(true);
    void (async () => {
      const result = await setPropertyDeveloper(propertyId, developerId);
      setSavingDeveloper(false);
      if (result.status === "ok") {
        router.refresh();
      } else {
        toast.error(result.message);
      }
    })();
  };

  const fieldClass =
    "border border-bz-border rounded p-2 text-[14px] bg-bz-surface focus:border-bz-accent outline-none";

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      className="flex flex-col gap-6"
    >
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
          <TabsTrigger value="amenities">Amenities</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
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
              className={cn(fieldClass, "resize-y")}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  onModeChange(v as PropertyEditInput["mode"])
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
          </div>

          {showPropertyForm ? (
            <div className="flex flex-col gap-1.5 max-w-md">
              <Label htmlFor="property_form">Property form</Label>
              <Select
                value={propertyForm ?? UNSET}
                onValueChange={(v) =>
                  setValue(
                    "property_form",
                    v === UNSET
                      ? null
                      : (v as NonNullable<PropertyEditInput["property_form"]>),
                    { shouldDirty: true },
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

          <div className="flex flex-col gap-1.5 max-w-md">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="developer_id">Developer</Label>
              {canCreateDeveloper ? (
                <NewDeveloperDialog
                  onCreated={(developer) => {
                    setDeveloperOptions((prev) => [
                      ...prev.filter((d) => d.id !== developer.id),
                      developer,
                    ]);
                    onDeveloperChange(developer.id);
                  }}
                />
              ) : null}
            </div>
            <Select value={developerId} onValueChange={onDeveloperChange}>
              <SelectTrigger id="developer_id">
                <SelectValue placeholder="Choose a developer" />
              </SelectTrigger>
              <SelectContent>
                {sortedDevelopers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11.5px] text-bz-muted">
              {savingDeveloper
                ? "Saving…"
                : "Required. The developer behind this listing — shown on the public property page and required before it can be published. Saved as soon as you pick one."}
            </span>
            <FieldError
              message={
                errors.developer_id?.message ?? serverFieldErrors.developer_id
              }
            />
          </div>
        </TabsContent>

        {/* PRICING */}
        <TabsContent
          value="pricing"
          className="bg-bz-surface border border-bz-border rounded-lg p-6 mt-6 flex flex-col gap-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  setValueAs: (v) =>
                    v === "" || v === null ? null : Number(v),
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
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
                  setValueAs: (v) =>
                    v === "" || v === null ? null : Number(v),
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
                  setValueAs: (v) =>
                    v === "" || v === null ? null : Number(v),
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

        {/* DETAILS */}
        <TabsContent
          value="details"
          className="bg-bz-surface border border-bz-border rounded-lg p-6 mt-6 flex flex-col gap-5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="year_built">Year built</Label>
              <Input
                id="year_built"
                type="number"
                step="1"
                {...register("year_built", {
                  setValueAs: (v) =>
                    v === "" || v === null ? null : Number(v),
                })}
              />
              <FieldError
                message={
                  errors.year_built?.message ?? serverFieldErrors.year_built
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="floor">Floor</Label>
              <Input
                id="floor"
                type="number"
                step="1"
                {...register("floor", {
                  setValueAs: (v) =>
                    v === "" || v === null ? null : Number(v),
                })}
              />
              <FieldError
                message={errors.floor?.message ?? serverFieldErrors.floor}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="parking_bays">Parking bays</Label>
              <Input
                id="parking_bays"
                type="number"
                step="1"
                {...register("parking_bays", {
                  setValueAs: (v) =>
                    v === "" || v === null ? null : Number(v),
                })}
              />
              <FieldError
                message={
                  errors.parking_bays?.message ?? serverFieldErrors.parking_bays
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tenure">Tenure</Label>
              <Select
                value={tenure ?? UNSET}
                onValueChange={(v) =>
                  setValue(
                    "tenure",
                    v === UNSET ? null : (v as PropertyEditInput["tenure"]),
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger id="tenure">
                  <SelectValue placeholder="Unset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Unset</SelectItem>
                  {TENURES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TENURE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="furnishing">Furnishing</Label>
              <Select
                value={furnishing ?? UNSET}
                onValueChange={(v) =>
                  setValue(
                    "furnishing",
                    v === UNSET
                      ? null
                      : (v as PropertyEditInput["furnishing"]),
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger id="furnishing">
                  <SelectValue placeholder="Unset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>Unset</SelectItem>
                  {FURNISHINGS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {FURNISHING_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="view">View</Label>
              <Input id="view" {...register("view")} placeholder="Sea view" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="orientation">Orientation</Label>
              <Input
                id="orientation"
                {...register("orientation")}
                placeholder="North-east"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="listing_permit_no">Listing permit no.</Label>
              <Input
                id="listing_permit_no"
                {...register("listing_permit_no")}
                placeholder="ORN-..."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="listing_permit_expires_at">Permit expires</Label>
              <Input
                id="listing_permit_expires_at"
                type="date"
                {...register("listing_permit_expires_at")}
              />
              <FieldError
                message={
                  errors.listing_permit_expires_at?.message ??
                  serverFieldErrors.listing_permit_expires_at
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dld_plot_number">DLD plot no.</Label>
              <Input
                id="dld_plot_number"
                {...register("dld_plot_number")}
                placeholder="PLOT-..."
              />
            </div>
          </div>
        </TabsContent>

        {/* LOCATION */}
        <TabsContent
          value="location"
          className="bg-bz-surface border border-bz-border rounded-lg p-6 mt-6 flex flex-col gap-5"
        >
          {/* Map pin — saves on its own (not part of the form submit), so the
              public Location map updates immediately. */}
          <LocationPicker
            propertyId={propertyId}
            initialGeo={geo}
            mapboxAvailable={mapboxAvailable}
          />

          <div className="border-t border-bz-border pt-5 flex flex-col gap-1.5 max-w-md">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="area_id">Area</Label>
              {canCreateArea ? (
                <NewAreaDialog
                  areas={areaOptions}
                  propertyGeo={geo}
                  onCreated={(area) => {
                    setAreaOptions((prev) => [
                      ...prev.filter((a) => a.id !== area.id),
                      { id: area.id, name: area.name, kind: area.kind },
                    ]);
                    setValue("area_id", area.id, { shouldDirty: true });
                  }}
                />
              ) : null}
            </div>
            <Select
              value={areaId ?? UNSET}
              onValueChange={(v) =>
                setValue("area_id", v === UNSET ? null : v, {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="area_id">
                <SelectValue placeholder="Choose an area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET}>Unset</SelectItem>
                {sortedAreas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    <span className="ml-2 text-[11px] text-bz-muted">
                      · {a.kind}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[11.5px] text-bz-muted">
              Drives the public area filter and the listing&apos;s place on
              /areas.
              {canCreateArea
                ? " Missing one? Add it without leaving this page."
                : ""}
            </span>
            <FieldError
              message={errors.area_id?.message ?? serverFieldErrors.area_id}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address_line">Address line</Label>
            <Input
              id="address_line"
              {...register("address_line")}
              placeholder="Mamsha Al Saadiyat, Saadiyat Island, Abu Dhabi"
            />
            <span className="text-[11.5px] text-bz-muted">
              Internal — used for advisor reference. Public view shows area
              + building only.
            </span>
          </div>
        </TabsContent>

        {/* AMENITIES */}
        <TabsContent
          value="amenities"
          className="bg-bz-surface border border-bz-border rounded-lg p-6 mt-6 flex flex-col gap-5"
        >
          <AmenitiesPicker
            value={amenities}
            options={amenityOptions}
            onChange={(next) =>
              setValue("amenities", next, { shouldDirty: true })
            }
          />
          <FieldError
            message={errors.amenities?.message ?? serverFieldErrors.amenities}
          />
        </TabsContent>

        {/* SEO */}
        <TabsContent
          value="seo"
          className="bg-bz-surface border border-bz-border rounded-lg p-6 mt-6 flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug">URL slug</Label>
            <Input id="slug" {...register("slug")} />
            <span className="text-[11.5px] text-bz-muted">
              Final URL: <span className="mono text-bz-ink-2">
                /p/{slug || "<slug>"}-{reference.toLowerCase()}
              </span>
              . Lowercase letters, numbers, and hyphens only.
            </span>
            <FieldError
              message={errors.slug?.message ?? serverFieldErrors.slug}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meta_title">Meta title</Label>
            <Input
              id="meta_title"
              {...register("meta_title")}
              placeholder="Inherits the listing title if blank"
            />
            <span className="text-[11.5px] text-bz-muted">
              Shown in search engines. Up to ~70 characters.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meta_description">Meta description</Label>
            <textarea
              id="meta_description"
              {...register("meta_description")}
              rows={3}
              className={cn(fieldClass, "resize-y")}
              placeholder="Inherits the short description if blank"
            />
            <span className="text-[11.5px] text-bz-muted">
              Up to ~180 characters.
            </span>
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
