"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const BLOG_ROLES = ["admin", "editor", "marketing"] as const;
/** Destroying a post for good is admin-only; trashing isn't. */
const BLOG_DESTROY_ROLES = ["admin"] as const;

export type BlogRowResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

async function loadArticle(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, slug, status, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return { article: null, message: error.message };
  if (!data) return { article: null, message: "Article not found." };
  return { article: data, message: null };
}

function revalidateBlog(slug?: string) {
  revalidatePath("/admin/blog");
  revalidatePath("/insights");
  if (slug) revalidatePath(`/insights/${slug}`);
}

/**
 * Archive: the post stays in the list and keeps its URL reserved, but drops
 * off the public index. Reversible from the same menu.
 */
export async function setArticleArchived(
  id: string,
  archived: boolean,
): Promise<BlogRowResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(BLOG_ROLES);

  const { article, message } = await loadArticle(id);
  if (!article)
    return { status: "error", message: message ?? "Article not found." };

  // Un-archiving returns a post to draft rather than straight to published —
  // going live again should be a deliberate act, not a side effect of undo.
  const next = archived ? "archived" : "draft";
  if (article.status === next)
    return { status: "error", message: `Already ${next}.` };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("articles")
    .update({ status: next })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Not saved — your account may not be allowed to edit posts.",
    };

  await logAudit({
    action: archived ? "article.archive" : "article.unarchive",
    target_kind: "article",
    target_id: id,
    before: { status: article.status },
    after: { status: next },
  });

  revalidateBlog(data.slug);
  return {
    status: "ok",
    message: archived
      ? `"${article.title}" archived.`
      : `"${article.title}" moved back to draft.`,
  };
}

/** Soft-delete: out of the list and off the site, restorable from Trash. */
export async function trashArticle(id: string): Promise<BlogRowResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(BLOG_ROLES);

  const { article, message } = await loadArticle(id);
  if (!article)
    return { status: "error", message: message ?? "Article not found." };
  if (article.deleted_at)
    return { status: "error", message: "Already in the trash." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("articles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("slug")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Not saved — your account may not be allowed to edit posts.",
    };

  await logAudit({
    action: "article.trash",
    target_kind: "article",
    target_id: id,
    before: { status: article.status, deleted_at: null },
    after: { deleted_at: "now" },
  });

  revalidateBlog(data.slug);
  return { status: "ok", message: `"${article.title}" moved to trash.` };
}

export async function restoreArticle(id: string): Promise<BlogRowResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(BLOG_ROLES);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("articles")
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("title, slug")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Not in the trash any more." };

  await logAudit({
    action: "article.restore",
    target_kind: "article",
    target_id: id,
    before: null,
    after: { title: data.title },
  });

  revalidateBlog(data.slug);
  return { status: "ok", message: `"${data.title}" restored.` };
}

/**
 * Permanent delete. Admin-only, and only from the trash — the row goes for
 * good, so it takes two deliberate steps to get here.
 */
export async function deleteArticlePermanently(
  id: string,
): Promise<BlogRowResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(BLOG_DESTROY_ROLES);

  const { article, message } = await loadArticle(id);
  if (!article)
    return { status: "error", message: message ?? "Article not found." };
  if (!article.deleted_at)
    return { status: "error", message: "Move it to the trash first." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "article.delete",
    target_kind: "article",
    target_id: id,
    before: { title: article.title, slug: article.slug },
    after: null,
  });

  revalidateBlog(article.slug);
  return { status: "ok", message: `"${article.title}" deleted for good.` };
}
