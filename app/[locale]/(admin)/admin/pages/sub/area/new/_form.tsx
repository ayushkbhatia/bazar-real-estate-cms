"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/slug";
import {
  AREA_KINDS,
  AREA_KIND_LABELS,
  type AreaKind,
} from "@/lib/schemas/area";
import { createArea } from "../_record-actions";
import { ArabicTwin } from "../../../../_fields/arabic-twin";

const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[13px]";

export function NewAreaForm({
  parents,
}: {
  parents: { id: string; name: string; kind: AreaKind }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState<AreaKind>("area");
  const [parentId, setParentId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const effectiveSlug = slugTouched ? slug : slugify(name);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await createArea({
        name,
        name_ar: nameAr.trim() || null,
        slug: effectiveSlug,
        kind,
        parent_id: parentId || null,
      });
      if (result.status === "error") {
        toast.error(result.message);
        if (result.fieldErrors) setErrors(result.fieldErrors);
        return;
      }
      toast.success("Area created.");
      router.push(`/admin/areas/${result.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 max-w-2xl">
      <div className="bg-bz-surface border border-bz-border rounded-lg p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Area name</Label>
          <Input
            id="name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <FieldError message={errors.name} />
          {/* Same reasoning as the property wizard's dialog: the name is the
              most-printed string an area has, and this is the one moment
              someone who knows its Arabic is looking at the record. */}
          <ArabicTwin
            field={{ key: "name_ar", label: "Area name", kind: "text", max: 120 }}
            value={nameAr}
            onChange={setNameAr}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">Page link</Label>
          <div className="flex items-center gap-2">
            <span className="mono text-[12.5px] text-bz-muted">/areas/</span>
            <Input
              id="slug"
              value={effectiveSlug}
              placeholder="auto-generated from the name"
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </div>
          <span className="text-[11.5px] text-bz-muted">
            Lowercase letters, numbers and hyphens. This is the public URL.
          </span>
          <FieldError message={errors.slug} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kind">Kind</Label>
            <select
              id="kind"
              className={fieldCls}
              value={kind}
              onChange={(e) => setKind(e.target.value as AreaKind)}
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
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">Nothing — top level</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {AREA_KIND_LABELS[p.kind]}
                </option>
              ))}
            </select>
            <span className="text-[11.5px] text-bz-muted">
              A sub-community sits inside an area, an area inside an emirate.
            </span>
            <FieldError message={errors.parent_id} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <p className="text-[12px] text-bz-muted me-auto">
          You&apos;ll land on the record next, where the description, map
          position and cover image live.
        </p>
        <Button type="submit" disabled={pending}>
          <Plus size={14} strokeWidth={1.8} />
          {pending ? "Creating…" : "Create area"}
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
