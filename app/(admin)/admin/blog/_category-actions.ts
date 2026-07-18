"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { slugify } from "@/lib/slug";
import {
  articleCategoryCreateSchema,
  type ArticleCategoryCreateInput,
} from "@/lib/schemas/article";
import type { ArticleCategoryRow } from "@/lib/queries/article-categories";

const BLOG_ROLES = ["admin", "editor", "marketing"] as const;

export type CreateCategoryResult =
  | { status: "ok"; category: ArticleCategoryRow; categories: ArticleCategoryRow[] }
  | { status: "error"; message: string };

/** Category slugs use the underscore convention of the original enum values. */
function toCategorySlug(input: string): string {
  return slugify(input).replace(/-/g, "_").replace(/^_+|_+$/g, "");
}

async function fetchActiveCategories(
  supabase: Awaited<ReturnType<typeof requireRole>>["supabase"],
): Promise<ArticleCategoryRow[]> {
  const { data } = await supabase
    .from("article_categories")
    .select("slug, label, description, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  return (data ?? []) as ArticleCategoryRow[];
}

/**
 * Create a new article category ("blog type") from the editor. Idempotent on
 * slug: if the slug already exists and is active, the existing row is returned
 * so the editor can just select it.
 */
export async function createArticleCategory(
  raw: ArticleCategoryCreateInput,
): Promise<CreateCategoryResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  const { supabase } = await requireRole(BLOG_ROLES);

  const parsed = articleCategoryCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const label = parsed.data.label.trim();
  const slug = toCategorySlug(parsed.data.slug || label);
  if (!slug)
    return { status: "error", message: "Could not derive a slug from that name." };

  // Place new categories after the current max sort_order.
  const { data: last } = await supabase
    .from("article_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? 0) + 10;

  const { data, error } = await supabase
    .from("article_categories")
    .insert({ slug, label, sort_order: sortOrder })
    .select("slug, label, description, sort_order, is_active")
    .maybeSingle();

  if (error) {
    // 23505 = unique_violation on slug: the type already exists.
    if (error.code === "23505") {
      const categories = await fetchActiveCategories(supabase);
      const existing = categories.find((c) => c.slug === slug);
      if (existing)
        return { status: "ok", category: existing, categories };
      return {
        status: "error",
        message: "A category with that slug already exists.",
      };
    }
    // 42P01 = undefined_table: migration 0055 not applied in this environment.
    if (error.code === "42P01") {
      return {
        status: "error",
        message:
          "Category storage isn't set up yet — apply migration 0055, then retry.",
      };
    }
    return { status: "error", message: error.message };
  }
  if (!data)
    return { status: "error", message: "Could not create the category." };

  await logAudit({
    action: "article_category.create",
    target_kind: "article_category",
    target_id: data.slug,
    before: null,
    after: { slug: data.slug, label: data.label },
  });

  revalidatePath("/admin/blog");
  revalidatePath("/insights");

  const categories = await fetchActiveCategories(supabase);
  return {
    status: "ok",
    category: data as ArticleCategoryRow,
    categories,
  };
}
