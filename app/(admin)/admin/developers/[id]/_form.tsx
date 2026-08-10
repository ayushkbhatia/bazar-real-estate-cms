"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slug";
import { updateDeveloper } from "../_actions";

export type DeveloperRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  founded_year: number | null;
};

const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[13px]";

export function DeveloperRecordForm({ initial }: { initial: DeveloperRecord }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function set<K extends keyof DeveloperRecord>(
    key: K,
    value: DeveloperRecord[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await updateDeveloper(form.id, {
        name: form.name,
        slug: form.slug,
        description: form.description ?? "",
        founded_year: form.founded_year ?? "",
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
            <FieldError message={errors.name} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug">Page link</Label>
            <div className="flex items-center gap-2">
              <span className="mono text-[12px] text-bz-muted">/developers/</span>
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

        <div className="flex flex-col gap-1.5 max-w-[220px]">
          <Label htmlFor="founded_year">Founded</Label>
          <Input
            id="founded_year"
            type="number"
            inputMode="numeric"
            placeholder="e.g. 2005"
            value={form.founded_year ?? ""}
            onChange={(e) =>
              set(
                "founded_year",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
          <FieldError message={errors.founded_year} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            rows={4}
            className={cn(fieldCls, "resize-y")}
            placeholder="One or two lines — shown on the profile hero and the /developers card."
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value || null)}
          />
          <FieldError message={errors.description} />
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-bz-bg pt-3 pb-2">
        <span className="text-[12px] text-bz-muted mr-auto">
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
