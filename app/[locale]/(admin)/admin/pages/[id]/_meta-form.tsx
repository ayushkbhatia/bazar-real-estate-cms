"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { pageEditSchema, type PageEditInput } from "@/lib/schemas/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePage } from "./_actions";
import { SearchResultPreview } from "../../_fields/search-appearance";

type Props = {
  pageId: string;
  initial: PageEditInput;
  /** What the page publishes when meta title is blank, template applied. */
  fallbackTitle: string;
  faviconUrl: string | null;
  brandName: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="text-[12px] text-[oklch(0.45_0.13_28)]">{message}</span>
  );
}

export function PageMetaForm({
  pageId,
  initial,
  fallbackTitle,
  faviconUrl,
  brandName,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<PageEditInput>({
    resolver: zodResolver(pageEditSchema),
    defaultValues: initial,
  });

  const onSubmit = (values: PageEditInput) => {
    setServerErrors({});
    startTransition(async () => {
      const result = await updatePage(pageId, values);
      if (result.status === "ok") toast.success(result.message ?? "Saved.");
      else {
        toast.error(result.message);
        if (result.fieldErrors) setServerErrors(result.fieldErrors);
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-bz-surface border border-bz-border rounded-lg p-6 flex flex-col gap-5"
      id="page-meta-form"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register("title")} />
        <FieldError
          message={errors.title?.message ?? serverErrors.title}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" {...register("slug")} />
        <span className="text-[11.5px] text-bz-muted">
          /pages/<span className="mono">{watch("slug") || "your-slug"}</span>
        </span>
        <FieldError
          message={errors.slug?.message ?? serverErrors.slug}
        />
      </div>
      <div className="border-t border-bz-border pt-5 flex flex-col gap-4">
        <div className="text-[11px] uppercase tracking-widest text-bz-muted-2">
          SEO
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meta_title">Meta title</Label>
          <Input id="meta_title" {...register("meta_title")} />
          <FieldError message={errors.meta_title?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meta_description">Meta description</Label>
          <textarea
            id="meta_description"
            rows={2}
            className="bz-field w-full rounded border border-bz-border px-3 py-2 text-[14px] outline-none focus:border-bz-accent transition-colors bg-bz-bg"
            {...register("meta_description")}
          />
          <FieldError message={errors.meta_description?.message} />
        </div>
        {/*
          The rehearsal, not decoration: the two fields above are the only copy
          on the page whose audience never sees the page. It follows the slug
          field live, so renaming the page updates the result URL as you type.
          /pages/[slug] publishes no description fallback at all, which is why
          leaving that field blank shows a warning rather than grey text.
        */}
        <SearchResultPreview
          path={`/pages/${watch("slug") || "your-slug"}`}
          title={watch("meta_title") ?? ""}
          description={watch("meta_description") ?? ""}
          fallbackTitle={fallbackTitle}
          fallbackDescription={null}
          faviconUrl={faviconUrl}
          brandName={brandName}
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save meta"}
        </Button>
      </div>
    </form>
  );
}
