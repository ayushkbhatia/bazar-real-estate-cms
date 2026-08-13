"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  articleEditSchema,
  deriveExcerpt,
  normaliseArticleEditInput,
  readingMinutes,
} from "@/lib/schemas/article";
import { sanitizeArticleHtml } from "@/lib/article-html";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

const BLOG_ROLES = ["admin", "editor", "marketing"] as const;

async function revalidateArticlePaths(slug: string | null, prevSlug?: string | null) {
  if (!isSupabaseConfigured) return;
  revalidatePath("/admin/blog");
  revalidateLocalised("/insights");
  if (slug) revalidateLocalised(`/insights/${slug}`);
  if (prevSlug && prevSlug !== slug) revalidateLocalised(`/insights/${prevSlug}`);
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
  await requireRole(BLOG_ROLES);

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
  // The body arrives as an opaque string, so the editor's extension whitelist
  // constrains nothing here. Sanitise before anything reads it — the excerpt
  // and reading time are derived from this same value.
  const body_html = sanitizeArticleHtml(rest.body_html);
  const excerpt = deriveExcerpt(rest.excerpt, body_html);
  // The Arabic body goes through the same sanitiser. It arrives from the slot
  // walker rather than a person, which is not a reason to trust it more: the
  // walker splices model output back into markup, and this is the last point
  // before it is stored.
  const body_html_ar = rest.body_html_ar
    ? sanitizeArticleHtml(rest.body_html_ar)
    : null;

  const { data, error } = await supabase
    .from("articles")
    .update({
      ...rest,
      body_html,
      body_html_ar,
      excerpt,
      read_minutes: readingMinutes(body_html),
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
    if (error.code === "23503") {
      return {
        status: "error",
        message: "That blog type no longer exists — pick another.",
        fieldErrors: { category: "Unknown category" },
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
  await requireRole(BLOG_ROLES);

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
  await requireRole(BLOG_ROLES);

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
  await requireRole(BLOG_ROLES);

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
