import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { type Locale } from "@/lib/i18n/locales";
import { localiseDeep } from "@/lib/i18n/localise";
import {
  SEED_ARTICLE_CATEGORIES,
  ARTICLE_CATEGORY_LABELS,
  formatCategoryLabel,
} from "@/lib/schemas/article";

export type ArticleCategoryRow = {
  slug: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

/** Shape returned when the DB is unavailable / not yet migrated. */
const SEED_ROWS: ArticleCategoryRow[] = SEED_ARTICLE_CATEGORIES.map((c) => ({
  slug: c.slug,
  label: c.label,
  description: null,
  sort_order: c.sort_order,
  is_active: true,
}));

/**
 * Every category, active or retired, ordered for display. DB-first; falls back
 * to the seed set only when Supabase is unconfigured or the table cannot be
 * read (e.g. the migration has not been applied). A legitimately empty table
 * returns `[]` — we do not paper over that.
 *
 * This is the base for label + URL resolution: an article tagged with a
 * since-retired category (`is_active = false`) must still render its real label
 * and keep a working archive page, so those paths need inactive rows too.
 *
 * `cache()` dedupes the round-trip within a single server render, so many
 * consumers on one page share one query.
 */
export const listAllArticleCategories = cache(
  async (
    /**
     * Overridable; defaults to the locale of the request.
     *
     * Callers OUTSIDE the `[locale]` segment must pass one explicitly —
     * app/sitemap.ts and the metadata routes have no `setRequestLocale` above
     * them, so an ambient read there is a dynamic API and silently drops the
     * route off prerendering. `cache()` keys on the argument, so passing it
     * costs nothing.
     */
    locale?: Locale,
  ): Promise<ArticleCategoryRow[]> => {
    if (!isSupabaseConfigured) return SEED_ROWS;
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("article_categories")
      .select(
        "slug, label, label_ar, description, description_ar, sort_order, is_active",
      )
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (error) {
      // Table missing (pre-migration) or transient — degrade to the seed set
      // so the editor and marketplace keep working.
      console.error("[listAllArticleCategories]", error.message);
      return SEED_ROWS;
    }
    // Folded here rather than at each consumer: the label reaches the chip
    // bar, the category heading, every article card and the sitemap, and this
    // is the one place they all come through.
    return localiseDeep(
      (data ?? []) as ArticleCategoryRow[],
      locale ?? (await currentLocale()),
    );
  },
);

/**
 * Active categories only — the set offered in the editor dropdown, the public
 * chip bar, the sitemap, and generateStaticParams. Retired categories are
 * hidden here so they can't be chosen or browsed, while still resolving for
 * content that already references them (see label/URL helpers below).
 */
export const listArticleCategories = cache(
  async (locale?: Locale): Promise<ArticleCategoryRow[]> => {
    const rows = await listAllArticleCategories(locale);
    return rows.filter((r) => r.is_active);
  },
);

/**
 * slug → label map for per-article label rendering. Built from *all* categories
 * (plus the seed labels as a base) so an article tagged with a now-retired
 * category still renders its proper label on public cards.
 */
export const getArticleCategoryLabels = cache(
  async (locale?: Locale): Promise<Record<string, string>> => {
    const rows = await listAllArticleCategories(locale);
    const labels: Record<string, string> = { ...ARTICLE_CATEGORY_LABELS };
    for (const row of rows) labels[row.slug] = row.label;
    return labels;
  },
);

/**
 * Resolve a public URL slug (hyphenated) to a stored category. Accepts the
 * hyphenated form (`off-plan-watch`) or the raw stored slug (`off_plan_watch`).
 * Matches against *all* categories — including retired ones — so a published
 * article that still references a retired category keeps a live archive page
 * (and its breadcrumb / JSON-LD link) instead of 404ing. Returns null when no
 * category matches.
 */
export async function resolveArticleCategoryByUrlSlug(
  urlSlug: string,
): Promise<ArticleCategoryRow | null> {
  const wanted = urlSlug.toLowerCase();
  const underscored = wanted.replace(/-/g, "_");
  const rows = await listAllArticleCategories();
  return rows.find((r) => r.slug === wanted || r.slug === underscored) ?? null;
}

/** Convenience for callers that only need a readable label for one slug. */
export async function getArticleCategoryLabel(slug: string): Promise<string> {
  const labels = await getArticleCategoryLabels();
  return formatCategoryLabel(slug, labels);
}
