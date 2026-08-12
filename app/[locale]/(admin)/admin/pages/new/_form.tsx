"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { pageCreateSchema, type PageCreateInput } from "@/lib/schemas/page";
import { slugify } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPage } from "./_actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="text-[12px] text-[oklch(0.45_0.13_28)]">{message}</span>
  );
}

export function NewPageForm() {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<PageCreateInput>({
    resolver: zodResolver(pageCreateSchema),
    defaultValues: { title: "", slug: "" },
  });

  const title = watch("title");
  const slug = watch("slug");

  const onTitleChange = (value: string) => {
    setValue("title", value);
    if (!slug || slug === slugify(title)) {
      setValue("slug", slugify(value));
    }
  };

  const onSubmit = (values: PageCreateInput) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createPage(values);
      if (result.status === "error") {
        setServerError(result.message);
        toast.error(result.message);
      }
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
            placeholder="e.g. About Bazar"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            autoFocus
          />
          <FieldError message={errors.title?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" {...register("slug")} placeholder="about" />
          <span className="text-[11.5px] text-bz-muted">
            Public URL: /pages/<span className="mono">{slug || "your-slug"}</span>
          </span>
          <FieldError message={errors.slug?.message} />
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
