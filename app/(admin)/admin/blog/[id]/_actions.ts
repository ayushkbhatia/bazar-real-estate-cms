"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  articleEditSchema,
  deriveExcerpt,
  normaliseArticleEditInput,
  readingMinutes,
} from "@/lib/schemas/article";
import { logAudit } from "@/lib/audit";

async function revalidateArticlePaths(slug: string | null, prevSlug?: string | null) {
  if (!isSupabaseConfigured) return;
  revalidatePath("/admin/blog");
  revalidatePath("/insights");
  if (slug) revalidatePath(`/insights/${slug}`);
  if (prevSlug && prevSlug !== slug) revalidatePath(`/insights/${prevSlug}`);
}

export type SaveArticleResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export async function updateArticle(
  id: string,
  raw: Record<string, unknown>,
): Promise<SaveArticleResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const normalised = normaliseArticleEditInput(raw);
  const parsed = articleEditSchema.safeParse(normalised);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Please fix the errors below.", fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("articles")
    .select("title, slug, status")
    .eq("id", id)
    .maybeSingle();

  const { meta_title, meta_description, ...rest } = parsed.data;
  const excerpt = deriveExcerpt(rest.excerpt, rest.body_html);

  const { data, error } = await supabase
    .from("articles")
    .update({
      ...rest,
      excerpt,
      read_minutes: readingMinutes(rest.body_html),
      seo: {
        meta_title: meta_title ?? null,
        meta_description: meta_description ?? null,
      },
    })
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: "Slug already in use — pick a different one.",
        fieldErrors: { slug: "Already in use" },
      };
    }
    return { status: "error", message: error.message };
  }
  if (!data) {
    return {
      status: "error",
      message: "Article not found, or your account is not allowed to edit it.",
    };
  }

  if (before && (before.title !== rest.title || before.slug !== rest.slug)) {
    await logAudit({
      action: "article.update",
      target_kind: "article",
      target_id: id,
      before: { title: before.title, slug: before.slug },
      after: { title: rest.title, slug: rest.slug },
    });
  }

  await revalidateArticlePaths(data.slug, before?.slug ?? null);
  return { status: "ok", message: "Saved." };
}

export type PublishArticleResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

export async function publishArticle(
  id: string,
): Promise<PublishArticleResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("articles")
    .select("title, body_html, slug, status")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { status: "error", message: "Article not found." };
  if (!row.title.trim())
    return { status: "error", message: "Title is required to publish." };
  if (!row.body_html?.trim() || row.body_html === "<p></p>")
    return { status: "error", message: "Body is empty — write something first." };

  const { data, error } = await supabase
    .from("articles")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Could not publish — refresh and try again.",
    };

  await logAudit({
    action: "article.publish",
    target_kind: "article",
    target_id: id,
    before: { status: row.status },
    after: { status: "published" },
  });

  await revalidateArticlePaths(data.slug);
  return { status: "ok", message: "Published." };
}

export async function unpublishArticle(
  id: string,
): Promise<PublishArticleResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("articles")
    .select("status, slug")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { status: "error", message: "Article not found." };

  const { data, error } = await supabase
    .from("articles")
    .update({ status: "draft" })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data)
    return { status: "error", message: "Could not unpublish." };

  await logAudit({
    action: "article.unpublish",
    target_kind: "article",
    target_id: id,
    before: { status: row.status },
    after: { status: "draft" },
  });

  await revalidateArticlePaths(data.slug);
  return { status: "ok", message: "Reverted to draft." };
}

export async function archiveArticle(
  id: string,
): Promise<PublishArticleResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from("articles")
    .select("status, slug")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { status: "error", message: "Article not found." };

  const { data, error } = await supabase
    .from("articles")
    .update({ status: "archived" })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Could not archive." };

  await logAudit({
    action: "article.archive",
    target_kind: "article",
    target_id: id,
    before: { status: row.status },
    after: { status: "archived" },
  });

  await revalidateArticlePaths(data.slug);
  return { status: "ok", message: "Archived." };
}
