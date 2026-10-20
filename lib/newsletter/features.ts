import "server-only";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { localiseRow } from "@/lib/i18n/localise";
import { mediaPublicUrl } from "@/lib/media";
import { articleUrl } from "@/lib/queries/articles";
import { getPublicUnitLabels } from "@/lib/queries/site-settings";
import { formatCategoryLabel } from "@/lib/schemas/article";
import { resolveInternalLinks } from "@/lib/internal-links/resolve";
import type { InternalLinkKind } from "@/lib/internal-links/model";
import type { EmailBrand } from "@/lib/content-assets/email-brand";
import type { EmailLocale } from "@/lib/content-assets/tokens";
import type { EmailContext } from "@/lib/content-assets/email-html";
import { featureRefsIn, type FeatureKind, type FeatureRef } from "@/lib/content-assets/email-feature";
import {
  renderFeatureBlock,
  type FeatureLookup,
  type FeatureRecord,
  type ResolvedArticleFeature,
} from "./feature-render";

/**
 * Look up every record a newsletter features, for one language.
 *
 * Projects, listings and area guides go through the article internal-link
 * resolver (lib/internal-links/resolve.ts) — one query per kind, the public
 * client, the site's own publication filters, every string folded to the
 * locale — so a featured listing is exactly as public, and named exactly as,
 * the same listing linked from an article. Articles, which internal links
 * don't cover, get one more query here on the same terms.
 *
 * The public, cookie-free client works the same in a server action, a page
 * and the cron, which has no session.
 */
export async function resolveFeatures(
  refs: readonly FeatureRef[],
  locale: EmailLocale,
  client: Client | null = isSupabaseConfigured ? createSupabasePublicClient() : null,
): Promise<FeatureLookup> {
  const linkRefs = refs.filter((r): r is { kind: InternalLinkKind; id: string } => r.kind !== "article");
  const articleIds = [...new Set(refs.filter((r) => r.kind === "article").map((r) => r.id.toLowerCase()))];

  const [links, articles] = await Promise.all([
    linkRefs.length > 0 && client ? resolveInternalLinks(linkRefs, locale, client) : null,
    articleIds.length > 0 && client ? loadArticles(client, articleIds, locale).catch(logged) : null,
  ]);

  return {
    get(kind: FeatureKind, id: string): FeatureRecord | null | undefined {
      const key = id.toLowerCase();
      if (kind === "article") {
        if (!articles) return undefined;
        return articles.get(key) ?? (articleIds.includes(key) ? null : undefined);
      }
      return links?.get({ kind, id: key });
    },
  };
}

function logged(error: unknown): null {
  console.error("[newsletter/features] article lookup failed", error);
  return null;
}

type Client = Pick<ReturnType<typeof createSupabasePublicClient>, "from">;
type Row = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Exported for the fold proof. */
export const ARTICLE_FIELDS =
  "id, slug, title, title_ar, excerpt, excerpt_ar, category, read_minutes, hero:hero_image_id(storage_key, alt_text, alt_text_ar, deleted_at)";

async function loadArticles(client: Client, ids: string[], locale: EmailLocale): Promise<Map<string, ResolvedArticleFeature>> {
  const { data, error } = await client
    .from("articles")
    .select(ARTICLE_FIELDS)
    .in("id", ids)
    .eq("status", "published")
    .is("deleted_at", null);
  if (error) throw new Error(`articles: ${error.message}`);
  const rows = (data ?? []) as unknown as Row[];

  // Category names, in the reader's language; a failed read leaves the slug's
  // own words, which is what the site prints when the table is unreadable.
  const slugs = [...new Set(rows.map((r) => str(r.category)).filter((s): s is string => s !== null))];
  const labels: Record<string, string> = {};
  if (slugs.length > 0) {
    const { data: cats } = await client.from("article_categories").select("slug, label, label_ar").in("slug", slugs);
    for (const raw of (cats ?? []) as unknown as Row[]) {
      const cat = localiseRow(raw, locale);
      if (str(cat.slug) && str(cat.label)) labels[String(cat.slug)] = String(cat.label);
    }
  }

  return new Map(rows.map((raw) => {
    const shaped = shapeArticle(raw, locale, labels);
    return [shaped.id, shaped];
  }));
}

/** Exported for the fold proof. */
export function shapeArticle(raw: Row, locale: EmailLocale, labels: Record<string, string> = {}): ResolvedArticleFeature {
  const row = localiseRow(raw, locale);
  const name = str(row.title) ?? String(row.slug);
  const hero = row.hero && typeof row.hero === "object" ? localiseRow(row.hero as Row, locale) : null;
  const key = hero && !hero.deleted_at ? str(hero.storage_key) : null;
  const url = key ? mediaPublicUrl(key) : "";
  const category = str(row.category);
  const minutes = Number(row.read_minutes);
  return {
    kind: "article",
    id: String(row.id).toLowerCase(),
    href: articleUrl({ slug: String(row.slug) }),
    name,
    image: url ? { url, alt: str(hero?.alt_text) ?? name } : null,
    excerpt: str(row.excerpt),
    category: category ? (labels[category] ?? (locale === "en" ? formatCategoryLabel(category) : null)) : null,
    readMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null,
  };
}

/**
 * Everything renderNewsletter needs to draw a newsletter's featured blocks in
 * `locale`: the records, and the currency and area words with the site's
 * overrides (/admin/settings/units).
 */
export async function newsletterFeatures(
  bodies: readonly (string | null | undefined)[],
  locale: EmailLocale,
): Promise<NewsletterFeatures> {
  const refs = featureRefsIn(...bodies);
  const [lookup, labels] = await Promise.all([
    refs.length > 0 ? resolveFeatures(refs, locale) : Promise.resolve<FeatureLookup>({ get: () => undefined }),
    getPublicUnitLabels(locale),
  ]);
  return { lookup, labels };
}

export type NewsletterFeatures = { lookup: FeatureLookup; labels: Awaited<ReturnType<typeof getPublicUnitLabels>> };

/** The `features` hook an EmailContext takes, for one recipient language. */
export function featureDrawer(f: NewsletterFeatures, brand: EmailBrand, locale: EmailLocale): EmailContext["features"] {
  return (block) => renderFeatureBlock(block, f.lookup, { brand, locale, labels: f.labels });
}
