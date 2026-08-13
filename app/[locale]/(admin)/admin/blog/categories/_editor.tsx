"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ArabicTwin } from "../../_fields/arabic-twin";
import { updateArticleCategory } from "../_category-actions";

export type CategoryRow = {
  slug: string;
  label: string;
  label_ar: string | null;
  description: string | null;
  description_ar: string | null;
  sort_order: number;
  is_active: boolean;
  /** Live articles filed under this category. Drives the retire guard. */
  uses: number;
  /** Articles in the trash. Shown, never blocking — see the page comment. */
  trashed: number;
};

const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2.5 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[13px]";

/**
 * One row of the categories screen.
 *
 * Each saves on its own rather than the page saving as a whole. Thirteen rows
 * under one Save button means an editor fixing a typo in one label also
 * re-writes the other twelve, and any concurrent edit by someone else is
 * silently overwritten — the classic list-form trap.
 */
function CategoryCard({ row }: { row: CategoryRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(row);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof CategoryRow>(key: K, value: CategoryRow[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  function save() {
    setErrors({});
    startTransition(async () => {
      const result = await updateArticleCategory({
        slug: form.slug,
        label: form.label,
        label_ar: form.label_ar,
        description: form.description,
        description_ar: form.description_ar,
        sort_order: form.sort_order,
        is_active: form.is_active,
      });
      if (result.status === "ok") {
        toast.success(`Saved “${form.label}”.`);
        setDirty(false);
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="border border-bz-border rounded-lg bg-bz-surface p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          {/* The slug is the public URL and the value articles are filed
              under, so it is shown and never editable. */}
          <span className="mono text-[11px] text-bz-muted-2">{row.slug}</span>
          <span className="text-[11.5px] text-bz-muted">
            {row.uses === 0
              ? "No articles"
              : `${row.uses} article${row.uses === 1 ? "" : "s"}`}
            {row.trashed > 0 ? ` · ${row.trashed} in trash` : ""}
            {" · "}
            <a
              className="underline hover:text-bz-ink"
              href={`/insights/category/${row.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              view page
            </a>
          </span>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-bz-muted shrink-0">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
          />
          Offered
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-[11px]">Name</Label>
          <Input
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
          />
          <ArabicTwin
            field={{ key: "label_ar", label: "Name", kind: "text", max: 60 }}
            value={form.label_ar ?? ""}
            onChange={(v) => set("label_ar", v || null)}
          />
          {errors.label ? (
            <span className="text-[12px] text-bz-danger">{errors.label}</span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[11px]">Order</Label>
          <input
            type="number"
            className={cn(fieldCls, "w-20")}
            value={form.sort_order}
            onChange={(e) => set("sort_order", Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-[11px]">Description</Label>
        <textarea
          rows={2}
          className={cn(fieldCls, "resize-y")}
          placeholder="Shown under the heading on the category page."
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value || null)}
        />
        <ArabicTwin
          field={{
            key: "description_ar",
            label: "Description",
            kind: "textarea",
            max: 400,
          }}
          value={form.description_ar ?? ""}
          onChange={(v) => set("description_ar", v || null)}
        />
      </div>

      {errors.is_active ? (
        <span className="text-[12px] text-bz-danger">
          {errors.is_active} — move its articles to another category first.
        </span>
      ) : null}

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

export function CategoriesEditor({ rows }: { rows: CategoryRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <CategoryCard key={row.slug} row={row} />
      ))}
    </div>
  );
}
