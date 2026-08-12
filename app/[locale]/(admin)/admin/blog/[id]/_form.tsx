"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  articleEditSchema,
  type ArticleEditInput,
} from "@/lib/schemas/article";
import type { ArticleCategoryRow } from "@/lib/queries/article-categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategorySelect } from "../_category-select";
import { ImagePicker } from "../../_fields/image-picker";
import type { BlogMediaOption } from "../_image-insert-dialog";
import { publishArticle, updateArticle } from "./_actions";
import { PUBLISH_INTENT } from "./_intent";

/**
 * TipTap is five packages and ~380 kB, and unlike the rest of this form it is
 * not needed to render the page — title, slug, category and the publish
 * controls are all usable while it arrives.
 *
 * The skeleton reserves the editor's height so nothing below it jumps when the
 * real surface mounts. This is the one lazy boundary here that defers rather
 * than removes work: the editor is always visible on this route, so it always
 * loads — just after the form is interactive rather than before.
 */
const ArticleEditor = dynamic(
  () => import("../_article-editor").then((m) => m.ArticleEditor),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-[420px] rounded-lg bg-bz-surface-2 animate-pulse"
        aria-hidden
      />
    ),
  },
);

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span className="text-[12px] text-[oklch(0.45_0.13_28)]">{message}</span>
  );
}

export type ArticleEditFormProps = {
  articleId: string;
  initial: ArticleEditInput;
  categories: ArticleCategoryRow[];
  media: BlogMediaOption[];
};

export function ArticleEditForm({
  articleId,
  initial,
  categories,
  media: initialMedia,
}: ArticleEditFormProps) {
  const router = useRouter();
  // Uploads land in the library, so the freshly uploaded asset has to appear
  // in this list straight away rather than after a refresh.
  const [media, setMedia] = useState<BlogMediaOption[]>(initialMedia);
  const [pending, startTransition] = useTransition();
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string>
  >({});
  const [bodyHtml, setBodyHtml] = useState<string>(initial.body_html ?? "");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ArticleEditInput>({
    resolver: zodResolver(articleEditSchema),
    defaultValues: initial,
  });

  const category = watch("category");

  const onSubmit = (
    values: ArticleEditInput,
    event?: React.BaseSyntheticEvent,
  ) => {
    // Which button submitted. The sidebar's Publish is associated with this
    // form by id, so it arrives here as the submitter rather than as a
    // separate action — that is what makes publishing save first.
    const submitter = (event?.nativeEvent as SubmitEvent | undefined)
      ?.submitter as HTMLButtonElement | null | undefined;
    const alsoPublish = submitter?.value === PUBLISH_INTENT;

    setServerFieldErrors({});
    startTransition(async () => {
      const result = await updateArticle(articleId, {
        ...values,
        body_html: bodyHtml,
      });
      if (result.status !== "ok") {
        toast.error(result.message);
        if (result.fieldErrors) setServerFieldErrors(result.fieldErrors);
        return;
      }
      if (!alsoPublish) {
        toast.success(result.message ?? "Saved.");
        return;
      }
      // Only now is the row the reader would get the row the author sees.
      const published = await publishArticle(articleId);
      if (published.status === "ok") {
        toast.success(published.message);
        router.refresh();
      } else {
        toast.error(published.message);
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
      id="article-edit-form"
    >
      <div className="bg-bz-surface border border-bz-border rounded-lg p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" {...register("title")} />
          <FieldError
            message={errors.title?.message ?? serverFieldErrors.title}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" {...register("slug")} />
            <span className="text-[11.5px] text-bz-muted">
              /insights/<span className="mono">{watch("slug") || "your-slug"}</span>
            </span>
            <FieldError
              message={errors.slug?.message ?? serverFieldErrors.slug}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Blog type</Label>
            <CategorySelect
              id="category"
              value={category}
              onChange={(v) => setValue("category", v)}
              categories={categories}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="excerpt">Excerpt</Label>
          <textarea
            id="excerpt"
            rows={2}
            placeholder="One sentence used on cards and social previews. Leave blank to auto-derive."
            className="bz-field w-full rounded border border-bz-border px-3 py-2 text-[14px] outline-none focus:border-bz-accent transition-colors bg-bz-bg"
            {...register("excerpt")}
          />
          <FieldError message={errors.excerpt?.message} />
        </div>

        <ImagePicker
          label="Cover image"
          help="Heads the article and is used on the /insights cards and social previews. Landscape works best. Without one the article falls back to placeholder art."
          value={watch("hero_image_id") ?? null}
          media={media}
          onChange={(id) =>
            setValue("hero_image_id", id, { shouldDirty: true })
          }
          onUploaded={(m) => setMedia((cur) => [m, ...cur])}
        />
        <FieldError message={errors.hero_image_id?.message} />
      </div>

      <div className="bg-bz-surface border border-bz-border rounded-lg p-6 flex flex-col gap-3">
        <Label>Body</Label>
        <ArticleEditor
          defaultValue={initial.body_html ?? ""}
          onChange={setBodyHtml}
          media={media}
          onMediaUploaded={(m) => setMedia((cur) => [m, ...cur])}
        />
        <span className="text-[11.5px] text-bz-muted">
          Heading 2, heading 3, bold, italic, lists, links, blockquotes, and
          images. We&apos;ll auto-derive reading time on save.
        </span>
      </div>

      <div className="bg-bz-surface border border-bz-border rounded-lg p-6 flex flex-col gap-4">
        <div className="text-[11px] uppercase tracking-widest text-bz-muted-2">
          SEO
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meta_title">Meta title</Label>
          <Input
            id="meta_title"
            placeholder="Optional — falls back to article title"
            {...register("meta_title")}
          />
          <FieldError message={errors.meta_title?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meta_description">Meta description</Label>
          <textarea
            id="meta_description"
            rows={2}
            placeholder="Optional — falls back to excerpt"
            className="bz-field w-full rounded border border-bz-border px-3 py-2 text-[14px] outline-none focus:border-bz-accent transition-colors bg-bz-bg"
            {...register("meta_description")}
          />
          <FieldError message={errors.meta_description?.message} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save draft"}
        </Button>
      </div>
    </form>
  );
}
