import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/db/types";

export type ArticleCategory =
  Database["public"]["Enums"]["article_category"];
export type ArticleStatus =
  Database["public"]["Enums"]["article_status"];

export type ArticleListRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: ArticleCategory;
  status: ArticleStatus;
  read_minutes: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author: {
    display_name: string;
    title: string | null;
    slug: string;
  } | null;
  hero: {
    storage_key: string;
    filename: string;
    alt_text: string | null;
  } | null;
};

export type ArticleDetail = ArticleListRow & {
  body_html: string;
  seo: Record<string, unknown> | null;
};

const LIST_FIELDS =
  "id, slug, title, excerpt, category, status, read_minutes, published_at, created_at, updated_at, staff:author_id(display_name, title, slug), media:hero_image_id(storage_key, filename, alt_text)";

const DETAIL_FIELDS =
  "id, slug, title, excerpt, category, status, read_minutes, body_html, seo, published_at, created_at, updated_at, staff:author_id(display_name, title, slug), media:hero_image_id(storage_key, filename, alt_text)";

type RawJoin = {
  staff: {
    display_name: string;
    title: string | null;
    slug: string;
  } | null;
  media: {
    storage_key: string;
    filename: string;
    alt_text: string | null;
  } | null;
};

function reshape<T extends RawJoin>(
  row: T,
): Omit<T, "staff" | "media"> & {
  author: ArticleListRow["author"];
  hero: ArticleListRow["hero"];
} {
  const { staff, media, ...rest } = row;
  return { ...rest, author: staff ?? null, hero: media ?? null };
}

/** Public-facing list — published articles, newest first. */
export async function listPublishedArticles(opts: {
  category?: ArticleCategory;
  authorId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: ArticleListRow[]; total: number }> {
  if (!isSupabaseConfigured) return { rows: [], total: 0 };
  const supabase = createSupabasePublicClient();
  let query = supabase
    .from("articles")
    .select(LIST_FIELDS, { count: "exact" })
    .eq("status", "published")
    .is("deleted_at", null);
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.authorId) query = query.eq("author_id", opts.authorId);
  query = query
    .order("published_at", { ascending: false })
    .range(
      opts.offset ?? 0,
      (opts.offset ?? 0) + (opts.limit ?? 24) - 1,
    );
  const { data, error, count } = await query;
  if (error) {
    console.error("[listPublishedArticles]", error);
    return { rows: [], total: 0 };
  }
  const rows = (data ?? []).map((r) =>
    reshape(r as unknown as RawJoin),
  ) as unknown as ArticleListRow[];
  return { rows, total: count ?? 0 };
}

/**
 * Resolve a staff slug → { id, display_name, title } for the author-archive page.
 * Returns null when no staff row matches.
 */
export async function getStaffByPublicSlug(slug: string): Promise<{
  id: string;
  display_name: string;
  title: string | null;
  bio: string | null;
} | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("staff")
    .select("user_id, display_name, title, bio")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[getStaffByPublicSlug]", error);
    return null;
  }
  return {
    id: data.user_id,
    display_name: data.display_name,
    title: data.title,
    bio: data.bio ?? null,
  };
}

/** Counts per category (for the category chip bar). */
export async function countArticlesByCategory(): Promise<{
  total: number;
  byCategory: Record<ArticleCategory, number>;
}> {
  if (!isSupabaseConfigured) {
    return { total: 0, byCategory: {} as Record<ArticleCategory, number> };
  }
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("articles")
    .select("category")
    .eq("status", "published")
    .is("deleted_at", null);
  if (error || !data) {
    return { total: 0, byCategory: {} as Record<ArticleCategory, number> };
  }
  const byCategory = data.reduce<Record<string, number>>((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, {});
  return {
    total: data.length,
    byCategory: byCategory as Record<ArticleCategory, number>,
  };
}

/** Public-facing single article. Only published, not soft-deleted. */
export async function getPublishedArticleBySlug(
  slug: string,
): Promise<ArticleDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("articles")
    .select(DETAIL_FIELDS)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[getPublishedArticleBySlug]", error);
    return null;
  }
  if (!data) return null;
  return reshape(data as unknown as RawJoin) as unknown as ArticleDetail;
}

/** Find up to N other published articles, prefer same category, exclude self. */
export async function getRelatedArticles(
  excludeId: string,
  category: ArticleCategory,
  limit = 3,
): Promise<ArticleListRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("articles")
    .select(LIST_FIELDS)
    .eq("status", "published")
    .is("deleted_at", null)
    .neq("id", excludeId)
    .order("published_at", { ascending: false })
    .limit(limit + 4); // over-fetch so we can prefer same category
  if (error || !data) return [];
  const all = data.map((r) =>
    reshape(r as unknown as RawJoin),
  ) as unknown as ArticleListRow[];
  const same = all.filter((a) => a.category === category);
  const others = all.filter((a) => a.category !== category);
  return [...same, ...others].slice(0, limit);
}

/** Admin (auth-aware): list every article regardless of status. */
export async function listAllArticlesForAdmin(opts: {
  limit?: number;
  offset?: number;
}): Promise<{ rows: ArticleListRow[]; total: number }> {
  if (!isSupabaseConfigured) return { rows: [], total: 0 };
  const supabase = await createSupabaseServerClient();
  const { data, error, count } = await supabase
    .from("articles")
    .select(LIST_FIELDS, { count: "exact" })
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1);
  if (error) {
    console.error("[listAllArticlesForAdmin]", error);
    return { rows: [], total: 0 };
  }
  const rows = (data ?? []).map((r) =>
    reshape(r as unknown as RawJoin),
  ) as unknown as ArticleListRow[];
  return { rows, total: count ?? 0 };
}

/** Slug for the public article URL. */
export function articleUrl(article: { slug: string }): string {
  return `/insights/${article.slug}`;
}
