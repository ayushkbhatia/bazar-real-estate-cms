"use client";

import { useMemo, useState, useTransition } from "react";
import { MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArabicTwin } from "../../../_fields/arabic-twin";
import { slugify } from "@/lib/slug";
import {
  AREA_KINDS,
  AREA_KIND_LABELS,
  parentError,
  type AreaKind,
} from "@/lib/schemas/area";
import {
  createArea,
  type CreatedArea,
} from "../../../pages/sub/area/_record-actions";

export type AreaPickerOption = { id: string; name: string; kind: string };

const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[13px]";

function isAreaKind(value: string): value is AreaKind {
  return (AREA_KINDS as readonly string[]).includes(value);
}

/**
 * Add an area without leaving the property wizard.
 *
 * Sending an advisor to /admin/pages/sub/area/new mid-edit throws away every
 * unsaved field on the listing, so the whole flow happens here: the row is
 * written, the new area is selected on the listing, and the public
 * /areas/<slug> guide exists from that moment. Everything else the area
 * needs — description, cover image, stats, section order — is editorial and
 * lives on the area's own record, linked from the success toast.
 */
export function NewAreaDialog({
  areas,
  /** The listing's current map pin, offered as the new area's centroid. */
  propertyGeo,
  onCreated,
}: {
  areas: AreaPickerOption[];
  propertyGeo: { lat: number; lng: number } | null;
  onCreated: (area: CreatedArea) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [kind, setKind] = useState<AreaKind>("area");
  const [parentId, setParentId] = useState("");
  const [useGeo, setUseGeo] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const effectiveSlug = slugTouched ? slug : slugify(name);

  // Only areas broader than the chosen kind can be its parent — the same rule
  // the server enforces, applied here so the list can't offer an invalid pick.
  const parents = useMemo(
    () =>
      areas.filter(
        (a) =>
          isAreaKind(a.kind) &&
          parentError({
            kind,
            parentId: a.id,
            parentKind: a.kind,
          }) === null,
      ),
    [areas, kind],
  );

  // An area outside the emirate tree never reaches the map (pins are read per
  // emirate), so default to the only sensible parent when there's one obvious
  // candidate for this kind.
  const defaultParent = useMemo(() => {
    const emirates = parents.filter((p) => p.kind === "emirate");
    if (kind === "area" && emirates.length === 1) return emirates[0].id;
    return "";
  }, [parents, kind]);

  const selectedParent = parents.some((p) => p.id === parentId)
    ? parentId
    : defaultParent;

  function reset() {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setKind("area");
    setNameAr("");
    setParentId("");
    setUseGeo(true);
    setErrors({});
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await createArea({
        name,
        name_ar: nameAr.trim() || null,
        slug: effectiveSlug,
        kind,
        parent_id: selectedParent || null,
        geo: useGeo ? propertyGeo : null,
      });
      if (result.status === "error") {
        toast.error(result.message);
        if (result.fieldErrors) setErrors(result.fieldErrors);
        return;
      }
      onCreated(result.area);
      toast.success(`${result.area.name} added — /areas/${result.area.slug} is live.`, {
        description: "Add the description, cover image and stats on the area record.",
        action: {
          label: "Open record",
          onClick: () => window.open(`/admin/areas/${result.area.id}`, "_blank"),
        },
      });
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus size={13} strokeWidth={1.8} />
          New area
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add an area</DialogTitle>
          <DialogDescription>
            Creates the catalogue record and its public guide at
            /areas/&lt;link&gt;. Every future listing can then be filed here.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-area-name">Name</Label>
            <Input
              id="new-area-name"
              value={name}
              autoFocus
              placeholder="Ramhan Island"
              onChange={(e) => setName(e.target.value)}
            />
            <FieldError message={errors.name} />
            {/*
              Asked here rather than left to the record editor. The area's name
              is the most-printed string it has — listing cards, map flyouts,
              the guide heading — and the person filing the listing is the one
              who knows it. A blank twin still falls back to English, so this
              is a prompt, not a gate.
            */}
            <ArabicTwin
              field={{ key: "name_ar", label: "Name", kind: "text", max: 120 }}
              value={nameAr}
              onChange={setNameAr}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-area-slug">Page link</Label>
            <div className="flex items-center gap-2">
              <span className="mono text-[12.5px] text-bz-muted">/areas/</span>
              <Input
                id="new-area-slug"
                value={effectiveSlug}
                placeholder="auto-generated from the name"
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                onBlur={(e) => setSlug(slugify(e.target.value))}
              />
            </div>
            <FieldError message={errors.slug} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-area-kind">Kind</Label>
              <select
                id="new-area-kind"
                className={fieldCls}
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as AreaKind);
                  setParentId("");
                }}
              >
                {AREA_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {AREA_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <FieldError message={errors.kind} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-area-parent">Sits inside</Label>
              <select
                id="new-area-parent"
                className={fieldCls}
                value={selectedParent}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">Nothing — top level</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {AREA_KIND_LABELS[p.kind as AreaKind]}
                  </option>
                ))}
              </select>
              <FieldError message={errors.parent_id} />
            </div>
          </div>

          {propertyGeo ? (
            <label className="flex items-start gap-2.5 rounded border border-bz-border bg-bz-surface-2 px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={useGeo}
                onChange={(e) => setUseGeo(e.target.checked)}
              />
              <span className="text-[12.5px] text-bz-ink-2 leading-relaxed">
                <span className="inline-flex items-center gap-1.5 text-bz-ink">
                  <MapPin size={12} className="text-bz-accent" />
                  Centre the area on this listing&apos;s pin
                </span>
                <span className="mono block text-[11.5px] text-bz-muted mt-0.5">
                  {propertyGeo.lat.toFixed(5)}, {propertyGeo.lng.toFixed(5)}
                </span>
                <span className="block mt-1">
                  Puts the area on the home and guide maps straight away. Adjust
                  it later on the area record.
                </span>
              </span>
            </label>
          ) : (
            <p className="text-[12px] text-bz-muted">
              No map pin on this listing yet — set the area&apos;s coordinates on
              its record so it appears on the maps.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || name.trim().length < 2}
          >
            <Plus size={14} strokeWidth={1.8} />
            {pending ? "Creating…" : "Create area"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="text-[12px] text-[oklch(0.45_0.13_28)]">{message}</span>
  );
}
