"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  articleCreateSchema,
  type ArticleCreateInput,
} from "@/lib/schemas/article";
import type { ArticleCategoryRow } from "@/lib/queries/article-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategorySelect } from "../_category-select";
import { createArticle } from "./_actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="text-[12px] text-[oklch(0.45_0.13_28)]">{message}</span>
  );
}

export function NewArticleForm({
  categories,
}: {
  categories: ArticleCategoryRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ArticleCreateInput>({
    resolver: zodResolver(articleCreateSchema),
    defaultValues: {
      title: "",
      category:
        categories.find((c) => c.slug === "field_note")?.slug ??
        categories[0]?.slug ??
        "field_note",
    },
  });

  const category = watch("category");

  const onSubmit = (values: ArticleCreateInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createArticle(values);
      if (result.status === "error") {
        setServerError(result.message);
        toast.error(result.message);
      }
      // On success, the server action redirects to the editor.
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
          <Input
            id="title"
            placeholder="e.g. Saadiyat closed Q1 up 8.4%"
            {...register("title")}
            autoFocus
          />
          <span className="text-[11.5px] text-bz-muted">
            We&apos;ll auto-generate a slug from this — you can rename it on
            the editor screen.
          </span>
          <FieldError message={errors.title?.message} />
        </div>

        <div className="flex flex-col gap-1.5 max-w-md">
          <Label htmlFor="category">Blog type</Label>
          <CategorySelect
            id="category"
            value={category}
            onChange={(v) => setValue("category", v)}
            categories={categories}
          />
          <FieldError message={errors.category?.message} />
        </div>

        {serverError ? <FieldError message={serverError} /> : null}
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
