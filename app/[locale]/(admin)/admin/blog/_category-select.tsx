"use client";

import { useState, useTransition } from "react";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatCategoryLabel } from "@/lib/schemas/article";
import type { ArticleCategoryRow } from "@/lib/queries/article-categories";
import { createArticleCategory } from "./_category-actions";

/**
 * Blog-type picker: a DB-backed dropdown plus an inline "New type" affordance
 * that persists a new category to `article_categories` and selects it. Shared
 * by the new-article and edit-article forms.
 */
export function CategorySelect({
  id,
  value,
  onChange,
  categories: initialCategories,
}: {
  id?: string;
  value: string;
  onChange: (slug: string) => void;
  categories: ArticleCategoryRow[];
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();

  // Show the current value even if it isn't in the active list (e.g. the
  // article is tagged with a since-deactivated category) so the trigger is
  // never blank.
  const hasValue = !value || categories.some((c) => c.slug === value);

  const cancel = () => {
    setAdding(false);
    setLabel("");
  };

  const submit = () => {
    const name = label.trim();
    if (name.length < 2) {
      toast.error("Enter a name for the new type.");
      return;
    }
    startTransition(async () => {
      const result = await createArticleCategory({ label: name });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      setCategories(result.categories);
      onChange(result.category.slug);
      setLabel("");
      setAdding(false);
      toast.success(`Added “${result.category.label}”.`);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} className="flex-1">
            <SelectValue placeholder="Select a type" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.label}
              </SelectItem>
            ))}
            {!hasValue ? (
              <SelectItem value={value}>
                {formatCategoryLabel(value)}
              </SelectItem>
            ) : null}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => (adding ? cancel() : setAdding(true))}
          aria-expanded={adding}
        >
          <Plus size={14} strokeWidth={1.8} />
          New type
        </Button>
      </div>

      {adding ? (
        <div className="flex items-end gap-2 rounded-md border border-bz-border bg-bz-bg p-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <Label htmlFor="new-category-label" className="text-[12px]">
              New blog type
            </Label>
            <Input
              id="new-category-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Investor briefing"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
              }}
            />
            <span className="text-[11px] text-bz-muted">
              Saved to the shared list — available on every article.
            </span>
          </div>
          <Button type="button" size="sm" onClick={submit} disabled={pending}>
            <Check size={14} strokeWidth={1.8} />
            {pending ? "Adding…" : "Add"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={cancel}
            disabled={pending}
            aria-label="Cancel"
          >
            <X size={14} strokeWidth={1.8} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
