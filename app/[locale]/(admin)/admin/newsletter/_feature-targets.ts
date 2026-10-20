import "server-only";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { articleUrl } from "@/lib/queries/articles";
import { formatCategoryLabel } from "@/lib/schemas/article";
import { listInternalLinkTargets } from "../blog/_link-targets";
import type { FeatureTarget } from "../content-assets/emails/_feature-types";

/**
 * Everything the newsletter's Feature picker and site-link search offer, in
 * one load: the published areas, projects and listings the article
 * internal-link picker offers (the same readers the public pages use), plus
 * published articles. Only what a card could draw — a block can never be
 * pointed at something the email would then leave out.
 */
export async function listFeatureTargets(): Promise<FeatureTarget[]> {
  const [links, articles] = await Promise.all([listInternalLinkTargets(), listArticleTargets()]);
  const order: Record<string, number> = { property: 0, development: 1, article: 2, area: 3 };
  return [...links, ...articles].sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
}

type Row = Record<string, unknown>;

/** Published articles, newest first — the order a newsletter wants them in. */
async function listArticleTargets(): Promise<FeatureTarget[]> {
  if (!isSupabaseConfigured) return [];
  const sb = createSupabasePublicClient();
  const [{ data, error }, { data: cats }] = await Promise.all([
    sb
      .from("articles")
      .select("id, slug, title, category, read_minutes, published_at, media:hero_image_id(storage_key, deleted_at)")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(300),
    sb.from("article_categories").select("slug, label"),
  ]);
  if (error) {
    console.error("[newsletter] article targets", error.message);
    return [];
  }
  const labels = Object.fromEntries(((cats ?? []) as Row[]).map((c) => [String(c.slug), String(c.label)]));
  return ((data ?? []) as unknown as Row[]).map((row) => articleTarget(row, labels));
}

/** An article as the picker shows it. Exported for its spec. */
export function articleTarget(row: Row, labels: Record<string, string> = {}): FeatureTarget {
  const slug = String(row.slug);
  const href = articleUrl({ slug });
  const media = row.media && typeof row.media === "object" ? (row.media as Row) : null;
  const key = media && !media.deleted_at && typeof media.storage_key === "string" ? media.storage_key : null;
  const published = typeof row.published_at === "string" ? new Date(row.published_at) : null;
  const minutes = Number(row.read_minutes);
  const category = typeof row.category === "string" ? formatCategoryLabel(row.category, labels) : null;
  return {
    kind: "article",
    id: String(row.id).toLowerCase(),
    name: typeof row.title === "string" && row.title.trim() ? row.title.trim() : slug,
    href,
    slug,
    detail: {
      thumb: key ? mediaPublicUrl(key) || null : null,
      code: null,
      sub: [
        category,
        published && !Number.isNaN(published.getTime())
          ? published.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" })
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      facts: Number.isFinite(minutes) && minutes > 0 ? [`${Math.round(minutes)} min read`] : [],
      price: null,
      badge: null,
      href,
    },
  };
}
