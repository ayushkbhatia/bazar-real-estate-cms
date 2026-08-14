import type { MetadataRoute } from "next";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured, env } from "@/lib/env";
import { propertyUrl } from "@/lib/queries/property-utils";
import { developmentUrl } from "@/lib/queries/development-utils";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { listDevelopers } from "@/lib/queries/developers-extras";
import { listArticleCategories } from "@/lib/queries/article-categories";
import { categoryToUrlSlug } from "@/lib/schemas/article";

const STATIC_ROUTES: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}[] = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/buy", changeFrequency: "hourly", priority: 0.9 },
  { path: "/rent", changeFrequency: "hourly", priority: 0.8 },
  { path: "/off-plan", changeFrequency: "weekly", priority: 0.7 },
  { path: "/commercial", changeFrequency: "weekly", priority: 0.6 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/services", changeFrequency: "monthly", priority: 0.5 },
  // The two service landings that are lead-capture pages in their own right,
  // and search targets ("property management Abu Dhabi"). The remaining
  // /services/* routes are covered by the index above.
  { path: "/services/manage", changeFrequency: "monthly", priority: 0.6 },
  { path: "/services/consultation", changeFrequency: "monthly", priority: 0.6 },
  { path: "/insights", changeFrequency: "daily", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/agents", changeFrequency: "weekly", priority: 0.5 },
  { path: "/areas", changeFrequency: "weekly", priority: 0.5 },
  { path: "/developers", changeFrequency: "weekly", priority: 0.5 },
  // The QR scan destination is a real contact surface, so it is indexable.
  // /qr — the display page the code is printed on — deliberately is not: it
  // carries robots noindex and would only compete with /contact.
  { path: "/contact-qr", changeFrequency: "monthly", priority: 0.3 },
];

/**
 * Regenerate hourly.
 *
 * Without this the sitemap is a build-time snapshot: Next.js prerenders it
 * once and serves that file until the next deploy. Publishing is a CMS action
 * with no deploy behind it, so the two drift apart — this file was advertising
 * 66 property URLs while the database held 4, most of them 404 to a crawler.
 *
 * An hour is the trade: fresh enough that a newly published listing is
 * discoverable the same morning, rare enough that the query below (which can
 * pull thousands of rows) runs at most once an hour no matter how often
 * crawlers ask.
 */
export const revalidate = 3600;

function siteUrl(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? "https://www.bazarrealestate.ae").replace(
    /\/+$/,
    "",
  );
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
    await listArticleCategories(DEFAULT_LOCALE).catch((err) => {
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
    listAreasWithCounts(DEFAULT_LOCALE)
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
    // Explicitly English: this route is outside the [locale] segment, so an
    // ambient locale read here is a dynamic API and drops /sitemap.xml off
    // prerendering. It emits both trees regardless.
    listDevelopers(DEFAULT_LOCALE)
      .then((rows) =>
        // A draft developer 404s, so advertising it here would be a soft-404
        // against the whole section.
        rows
          .filter((r) => r.published)
          .map<MetadataRoute.Sitemap[number]>((r) => ({
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
    return [
      ...staticEntries,
      ...categoryEntries,
      ...areaEntries,
      ...developerEntries,
    ];
  }

  try {
    const supabase = createSupabasePublicClient();
    // Developments and articles were missing from the sitemap entirely — not
    // stale, absent. Every off-plan project page and every published article
    // was indexable, linked from the site's own navigation, and advertised
    // nowhere. They are queried directly rather than through the list helpers
    // because those reshape rows and attach labels the sitemap has no use for.
    const [properties, developments, articles, landings] = await Promise.all([
      supabase
        .from("properties")
        .select("slug, reference, updated_at, status")
        .eq("status", "published")
        .is("deleted_at", null)
        .limit(5000),
      supabase
        .from("developments")
        .select("slug, updated_at")
        .not("published_at", "is", null)
        .limit(1000),
      supabase
        .from("articles")
        .select("slug, updated_at")
        .eq("status", "published")
        .is("deleted_at", null)
        .limit(2000),
      // Campaign landing pages. `noindex` is the editor's explicit "keep this
      // out of search" — usually set on a paid-advert page so it doesn't
      // compete with the canonical route — so it filters here too.
      supabase
        .from("landing_pages")
        .select("slug, updated_at")
        .eq("status", "published")
        .eq("noindex", false)
        .is("deleted_at", null)
        .limit(500),
    ]);

    const propertyEntries: MetadataRoute.Sitemap = (properties.data ?? []).map(
      (p) => ({
        url: `${base}${propertyUrl(p)}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }),
    );

    const developmentEntries: MetadataRoute.Sitemap = (
      developments.data ?? []
    ).map((d) => ({
      url: `${base}${developmentUrl(d)}`,
      lastModified: d.updated_at ? new Date(d.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const articleEntries: MetadataRoute.Sitemap = (articles.data ?? []).map(
      (a) => ({
        url: `${base}/insights/${a.slug}`,
        lastModified: a.updated_at ? new Date(a.updated_at) : now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }),
    );

    const landingEntries: MetadataRoute.Sitemap = (landings.data ?? []).map(
      (l) => ({
        url: `${base}/lp/${l.slug}`,
        lastModified: l.updated_at ? new Date(l.updated_at) : now,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      }),
    );

    return [
      ...staticEntries,
      ...categoryEntries,
      ...areaEntries,
      ...developerEntries,
      ...propertyEntries,
      ...developmentEntries,
      ...articleEntries,
      ...landingEntries,
    ];
  } catch (err) {
    console.error("[sitemap] catalogue fetch failed", err);
    return [
      ...staticEntries,
      ...categoryEntries,
      ...areaEntries,
      ...developerEntries,
    ];
  }
}
