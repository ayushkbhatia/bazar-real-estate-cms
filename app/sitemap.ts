import type { MetadataRoute } from "next";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured, env } from "@/lib/env";
import { propertyUrl } from "@/lib/queries/property-utils";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";
import { listDevelopers } from "@/lib/queries/developers-extras";
import { listArticleCategories } from "@/lib/queries/article-categories";
import { categoryToUrlSlug } from "@/lib/schemas/article";

const STATIC_ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/buy", changeFrequency: "hourly", priority: 0.9 },
  { path: "/rent", changeFrequency: "hourly", priority: 0.8 },
  { path: "/off-plan", changeFrequency: "weekly", priority: 0.7 },
  { path: "/commercial", changeFrequency: "weekly", priority: 0.6 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/services", changeFrequency: "monthly", priority: 0.5 },
  { path: "/insights", changeFrequency: "daily", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/agents", changeFrequency: "weekly", priority: 0.5 },
  { path: "/areas", changeFrequency: "weekly", priority: 0.5 },
  { path: "/developers", changeFrequency: "weekly", priority: 0.5 },
];

function siteUrl(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? "https://bazar-real-estate-cms.vercel.app").replace(/\/+$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Insights category pages are a runtime-editable taxonomy.
  // listArticleCategories() falls back to the seed set when Supabase is
  // unreachable, so these always populate.
  const categoryEntries: MetadataRoute.Sitemap = (
    await listArticleCategories().catch((err) => {
      console.error("[sitemap] category fetch failed", err);
      return [];
    })
  ).map((c) => ({
    url: `${base}/insights/category/${categoryToUrlSlug(c.slug)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  // listAreasWithCounts() and listDevelopers() both fall back to seeds
  // when Supabase is offline, so we always get a populated list.
  const [areaEntries, developerEntries] = await Promise.all([
    listAreasWithCounts()
      .then((rows) =>
        rows.map<MetadataRoute.Sitemap[number]>((r) => ({
          url: `${base}/areas/${r.slug}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.6,
        })),
      )
      .catch((err) => {
        console.error("[sitemap] area fetch failed", err);
        return [] as MetadataRoute.Sitemap;
      }),
    listDevelopers()
      .then((rows) =>
        rows.map<MetadataRoute.Sitemap[number]>((r) => ({
          url: `${base}/developers/${r.slug}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.5,
        })),
      )
      .catch((err) => {
        console.error("[sitemap] developer fetch failed", err);
        return [] as MetadataRoute.Sitemap;
      }),
  ]);

  if (!isSupabaseConfigured) {
    return [...staticEntries, ...categoryEntries, ...areaEntries, ...developerEntries];
  }

  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("properties")
      .select("slug, reference, updated_at, status")
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(5000);

    const propertyEntries: MetadataRoute.Sitemap = (data ?? []).map((p) => ({
      url: `${base}${propertyUrl(p)}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    return [
      ...staticEntries,
      ...categoryEntries,
      ...areaEntries,
      ...developerEntries,
      ...propertyEntries,
    ];
  } catch (err) {
    console.error("[sitemap] property fetch failed", err);
    return [...staticEntries, ...categoryEntries, ...areaEntries, ...developerEntries];
  }
}
