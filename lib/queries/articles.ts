import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { type Locale } from "@/lib/i18n/locales";
import { localiseDeep } from "@/lib/i18n/localise";
import { formatCategoryLabel } from "@/lib/schemas/article";
import { getArticleCategoryLabels } from "@/lib/queries/article-categories";
import type { Database } from "@/db/types";

/**
 * A category slug. Categories are a runtime-editable taxonomy (migration 0055c),
 * so this is an open `string` rather than a fixed enum. Use `category_label`
 * for display and `getArticleCategoryLabels()` to resolve arbitrary slugs.
 */
export type ArticleCategory = string;
export type ArticleStatus =
  Database["public"]["Enums"]["article_status"];

export type ArticleListRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: ArticleCategory;
  /** Resolved display label for `category` (DB label, else title-cased slug). */
  category_label: string;
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

/* The `_ar` twins ride along in both selects. They are folded away by
 * `localiseDeep` before anything downstream sees them, so no renderer and no
 * admin screen learns that Arabic exists — but they have to be SELECTED, or
 * there is nothing to fold. */
const LIST_FIELDS =
  "id, slug, title, title_ar, excerpt, excerpt_ar, category, status, read_minutes, published_at, created_at, updated_at, staff:author_id(display_name, title, slug), media:hero_image_id(storage_key, filename, alt_text)";

const DETAIL_FIELDS =
  "id, slug, title, title_ar, excerpt, excerpt_ar, category, status, read_minutes, body_html, body_html_ar, seo, published_at, created_at, updated_at, staff:author_id(display_name, title, slug), media:hero_image_id(storage_key, filename, alt_text)";

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

/**
 * Resolve `category_label` for each row from the (cached) category label map.
 * One tiny lookup per render regardless of how many article queries run.
 */
async function attachLabels<T extends ArticleListRow>(
  rows: T[],
): Promise<T[]> {
  const labels = await getArticleCategoryLabels();
  return rows.map((r) => ({
    ...r,
    category_label: formatCategoryLabel(r.category, labels),
  }));
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
  const articleLocale = await currentLocale();
  const rows = await attachLabels(
    (data ?? []).map((r) =>
      // Folded on the raw row, before reshape builds explicit literals and
      // drops the twins — the mistake made once already in the megamenu.
      reshape(localiseDeep(r, articleLocale) as unknown as RawJoin),
    ) as unknown as ArticleListRow[],
  );
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
  /** Overridable; defaults to the locale of the request. */
  locale?: Locale,
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
  const [row] = await attachLabels([
    reshape(
      localiseDeep(data, locale ?? (await currentLocale())) as unknown as RawJoin,
    ) as unknown as ArticleDetail,
  ]);
  return row;
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
  const articleLocale = await currentLocale();
  const all = await attachLabels(
    data.map((r) =>
      // Folded on the raw row, before reshape builds explicit literals and
      // drops the twins — the mistake made once already in the megamenu.
      reshape(localiseDeep(r, articleLocale) as unknown as RawJoin),
    ) as unknown as ArticleListRow[],
  );
  const same = all.filter((a) => a.category === category);
  const others = all.filter((a) => a.category !== category);
  return [...same, ...others].slice(0, limit);
}

/**
 * Admin (auth-aware): every article regardless of status.
 *
 * `trashed` flips the soft-delete filter, which is what the Trash view on
 * /admin/blog reads — trashed posts are excluded everywhere else.
 */
export async function listAllArticlesForAdmin(opts: {
  limit?: number;
  offset?: number;
  trashed?: boolean;
}): Promise<{ rows: ArticleListRow[]; total: number }> {
  if (!isSupabaseConfigured) return { rows: [], total: 0 };
  const supabase = await createSupabaseServerClient();
  const base = supabase.from("articles").select(LIST_FIELDS, { count: "exact" });
  const { data, error, count } = await (opts.trashed
    ? base.not("deleted_at", "is", null)
    : base.is("deleted_at", null))
    .order("updated_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1);
  if (error) {
    console.error("[listAllArticlesForAdmin]", error);
    return { rows: [], total: 0 };
  }
  const rows = await attachLabels(
    (data ?? []).map((r) =>
      reshape(r as unknown as RawJoin),
    ) as unknown as ArticleListRow[],
  );
  return { rows, total: count ?? 0 };
}

/** Slug for the public article URL. */
export function articleUrl(article: { slug: string }): string {
  return `/insights/${article.slug}`;
}
