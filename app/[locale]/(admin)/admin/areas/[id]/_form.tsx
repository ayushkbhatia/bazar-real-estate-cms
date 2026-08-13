"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArabicTwin } from "../../_fields/arabic-twin";
import { slugify } from "@/lib/slug";
import { AREA_KINDS, AREA_KIND_LABELS, type AreaKind } from "@/lib/schemas/area";
import { updateArea } from "../../pages/sub/area/_record-actions";

export type AreaRecord = {
  id: string;
  name: string;
  slug: string;
  kind: AreaKind;
  parent_id: string | null;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  meta_title: string | null;
  meta_description: string | null;
  lat: number | null;
  lng: number | null;
};

const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[13px]";

export function AreaRecordForm({
  initial,
  parents,
}: {
  initial: AreaRecord;
  parents: { id: string; name: string; kind: AreaKind }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function set<K extends keyof AreaRecord>(key: K, value: AreaRecord[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await updateArea(form.id, {
        name: form.name,
        slug: form.slug,
        kind: form.kind,
        parent_id: form.parent_id ?? "",
        name_ar: form.name_ar ?? "",
        description: form.description ?? "",
        description_ar: form.description_ar ?? "",
        meta_title: form.meta_title ?? "",
        meta_description: form.meta_description ?? "",
        lat: form.lat ?? "",
        lng: form.lng ?? "",
      });
      if (result.status === "ok") {
        toast.success(result.message);
        setDirty(false);
        router.refresh();
      } else {
        toast.error(result.message);
        if (result.fieldErrors) setErrors(result.fieldErrors);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <section className="bg-bz-surface border border-bz-border rounded-lg p-6 flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            <ArabicTwin
              field={{ key: "name_ar", label: "Name", kind: "text", max: 120 }}
              value={form.name_ar ?? ""}
              onChange={(v) => set("name_ar", v || null)}
            />
            <FieldError message={errors.name} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug">Slug</Label>
            <div className="flex items-center gap-2">
              <span className="mono text-[12px] text-bz-muted">/areas/</span>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                onBlur={(e) => set("slug", slugify(e.target.value))}
              />
            </div>
            <span className="text-[11.5px] text-bz-muted">
              Changing this changes the public URL.
            </span>
            <FieldError message={errors.slug} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kind">Kind</Label>
            <select
              id="kind"
              className={fieldCls}
              value={form.kind}
              onChange={(e) => set("kind", e.target.value as AreaKind)}
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
            <Label htmlFor="parent">Sits inside</Label>
            <select
              id="parent"
              className={fieldCls}
              value={form.parent_id ?? ""}
              onChange={(e) => set("parent_id", e.target.value || null)}
            >
              <option value="">Nothing — top level</option>
              {parents
                .filter((p) => p.id !== form.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {AREA_KIND_LABELS[p.kind]}
                  </option>
                ))}
            </select>
            <FieldError message={errors.parent_id} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            rows={4}
            className={cn(fieldCls, "resize-y")}
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value || null)}
          />
          <ArabicTwin
            field={{
              key: "description_ar",
              label: "Description",
              kind: "textarea",
              max: 2000,
            }}
            value={form.description_ar ?? ""}
            onChange={(v) => set("description_ar", v || null)}
          />
          <FieldError message={errors.description} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lat">Latitude</Label>
            <Input
              id="lat"
              type="number"
              step="any"
              value={form.lat ?? ""}
              onChange={(e) =>
                set("lat", e.target.value === "" ? null : Number(e.target.value))
              }
            />
            <span className="text-[11.5px] text-bz-muted">
              Sets where the guide&apos;s map centres. Leave blank to hide it.
            </span>
            <FieldError message={errors.lat} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lng">Longitude</Label>
            <Input
              id="lng"
              type="number"
              step="any"
              value={form.lng ?? ""}
              onChange={(e) =>
                set("lng", e.target.value === "" ? null : Number(e.target.value))
              }
            />
            <FieldError message={errors.lng} />
          </div>
        </div>
      </section>

      <section className="bg-bz-surface border border-bz-border rounded-lg p-6 flex flex-col gap-5">
        <h2 className="text-[14px] font-medium">Search listing</h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meta_title">Meta title</Label>
          <Input
            id="meta_title"
            value={form.meta_title ?? ""}
            placeholder="Inherits the area name if blank"
            onChange={(e) => set("meta_title", e.target.value || null)}
          />
          <FieldError message={errors.meta_title} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meta_description">Meta description</Label>
          <textarea
            id="meta_description"
            rows={3}
            className={cn(fieldCls, "resize-y")}
            value={form.meta_description ?? ""}
            onChange={(e) => set("meta_description", e.target.value || null)}
          />
          <FieldError message={errors.meta_description} />
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-bz-bg pt-3 pb-2">
        <span className="text-[12px] text-bz-muted me-auto">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <Button type="submit" disabled={pending || !dirty}>
          <Save size={14} strokeWidth={1.8} />
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="text-[12px] text-[oklch(0.45_0.13_28)]">{message}</span>
  );
}
