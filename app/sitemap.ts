import type { MetadataRoute } from "next";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured, env } from "@/lib/env";
import { propertyUrl } from "@/lib/queries/property-utils";
import { developmentUrl } from "@/lib/queries/development-utils";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { listDevelopers } from "@/lib/queries/developers-extras";
import { listAgents } from "@/lib/queries/agents";
import { listPublishedPageSlugs } from "@/lib/queries/pages";
import { listArticleCategories } from "@/lib/queries/article-categories";
import { categoryToUrlSlug } from "@/lib/schemas/article";

const STATIC_ROUTES: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}[] = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },

  // Search landings. /developments is the project index — it was the only
  // catalogue index missing here, while all 27 of its detail pages were
  // listed, so the section had no advertised entry point.
  { path: "/buy", changeFrequency: "hourly", priority: 0.9 },
  { path: "/rent", changeFrequency: "hourly", priority: 0.8 },
  { path: "/off-plan", changeFrequency: "weekly", priority: 0.7 },
  { path: "/commercial", changeFrequency: "weekly", priority: 0.6 },
  { path: "/developments", changeFrequency: "weekly", priority: 0.7 },
  { path: "/buy/ready", changeFrequency: "weekly", priority: 0.7 },
  { path: "/buy/resale", changeFrequency: "weekly", priority: 0.7 },
  // Curated inventory cuts. They turn over with the catalogue, not with a
  // deploy, hence the daily cadence on the two that are date-shaped.
  { path: "/exclusive", changeFrequency: "weekly", priority: 0.6 },
  { path: "/new-this-week", changeFrequency: "daily", priority: 0.6 },
  { path: "/price-drops", changeFrequency: "daily", priority: 0.6 },

  // Guides. This tree is the site's long-tail surface — "how to rent out a
  // property in Abu Dhabi", "golden visa property", "tax residency" — twelve
  // hand-written pages that were indexable, linked from the nav, and
  // advertised nowhere.
  { path: "/guides", changeFrequency: "weekly", priority: 0.7 },
  { path: "/guides/for-landlords", changeFrequency: "monthly", priority: 0.6 },
  { path: "/guides/for-tenants", changeFrequency: "monthly", priority: 0.6 },
  { path: "/guides/golden-visa", changeFrequency: "monthly", priority: 0.6 },
  {
    path: "/guides/how-to-rent-out",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/guides/kyc-non-residents",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/guides/property-linked-residency",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/guides/property-management",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  { path: "/guides/rental-process", changeFrequency: "monthly", priority: 0.6 },
  {
    path: "/guides/required-documents",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  { path: "/guides/tax-residency", changeFrequency: "monthly", priority: 0.6 },
  { path: "/guides/tenant-move-in", changeFrequency: "monthly", priority: 0.6 },

  // Tools. The valuation and mortgage calculators are lead magnets that rank
  // on their own terms ("abu dhabi property valuation", "uae mortgage
  // calculator"); /tools/compare only works with listings already chosen, so
  // it sits low.
  { path: "/tools/valuation", changeFrequency: "monthly", priority: 0.7 },
  { path: "/tools/mortgage", changeFrequency: "monthly", priority: 0.7 },
  { path: "/tools/compare", changeFrequency: "monthly", priority: 0.4 },

  // Editorial and market data.
  { path: "/insights", changeFrequency: "daily", priority: 0.7 },
  { path: "/market-reports", changeFrequency: "weekly", priority: 0.6 },

  // Services. All fifteen, not the two that happened to be listed before —
  // each is a distinct offering with its own copy and its own lead form.
  { path: "/services", changeFrequency: "monthly", priority: 0.5 },
  { path: "/services/buy", changeFrequency: "monthly", priority: 0.5 },
  { path: "/services/sell", changeFrequency: "monthly", priority: 0.6 },
  { path: "/services/invest", changeFrequency: "monthly", priority: 0.5 },
  { path: "/services/manage", changeFrequency: "monthly", priority: 0.6 },
  { path: "/services/consultation", changeFrequency: "monthly", priority: 0.6 },
  { path: "/services/consulting", changeFrequency: "monthly", priority: 0.5 },
  { path: "/services/conveyancing", changeFrequency: "monthly", priority: 0.5 },
  { path: "/services/developer", changeFrequency: "monthly", priority: 0.5 },
  { path: "/services/handover", changeFrequency: "monthly", priority: 0.5 },
  {
    path: "/services/interior-design",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    path: "/services/rental-finance",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    path: "/services/residency-visas",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    path: "/services/sales-leasing",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  { path: "/services/snagging", changeFrequency: "monthly", priority: 0.5 },
  {
    path: "/services/tenant-matchmaking",
    changeFrequency: "monthly",
    priority: 0.5,
  },

  // Company and directories.
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/agents", changeFrequency: "weekly", priority: 0.5 },
  { path: "/areas", changeFrequency: "weekly", priority: 0.5 },
  { path: "/developers", changeFrequency: "weekly", priority: 0.5 },
  { path: "/partners", changeFrequency: "monthly", priority: 0.4 },
  { path: "/press", changeFrequency: "monthly", priority: 0.4 },
  { path: "/careers", changeFrequency: "monthly", priority: 0.4 },
  { path: "/concierge", changeFrequency: "monthly", priority: 0.4 },
  // The HTML sitemap. Low priority — it exists for people, and as a crawl
  // path into anything this file misses.
  { path: "/sitemap", changeFrequency: "weekly", priority: 0.2 },
  // The QR scan destination is a real contact surface, so it is indexable.
  // /qr — the display page the code is printed on — deliberately is not: it
  // carries robots noindex and would only compete with /contact.
  { path: "/contact-qr", changeFrequency: "monthly", priority: 0.3 },

  // Legal. Listed so they are crawled and attributed to this site rather
  // than discovered late through footer links, but never competing. The
  // /legal index itself is not here: its whole body is a redirect to
  // /legal/privacy, and a 307 in a sitemap is a Search Console warning.
  { path: "/legal/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/legal/terms", changeFrequency: "yearly", priority: 0.2 },
  { path: "/legal/cookies", changeFrequency: "yearly", priority: 0.2 },
];

/*
 * Routes deliberately absent from the list above:
 *
 *   /off-plan/<slug>  — a functional alias of /developments/<slug>, same row
 *                       and same markup. Advertising both is duplicate
 *                       content; the canonical /developments tree is emitted.
 *   /buy/search, /rent/search, /off-plan/search
 *                     — search result pages. Parameterised, infinite, and
 *                       Google asks not to have them.
 *   /market-reports/<area>/<type>/<quarter>
 *                     — generateStaticParams builds the full area × 11
 *                       property-type cross product regardless of whether
 *                       that type traded in that area, so most of the set is
 *                       an empty report. The index is listed; the leaves wait
 *                       until the params are filtered by real DLD rows.
 *   /qr, /status, /forgot-password, /data-deleted, /newsletter/*, /sso, /auth
 *                     — utility surfaces, noindex or private.
 *   /ar/*             — the whole Arabic tree is disallowed in robots.ts
 *                       while it is under review.
 */

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

  // The four catalogue directories. listAreasWithCounts() and
  // listDevelopers() fall back to seeds when Supabase is offline, so those
  // always yield a populated list; listAgents() and listPublishedPageSlugs()
  // return nothing, which is the safer failure here — advertising a seeded
  // advisor or a page that does not exist would be a soft 404. Each is
  // caught individually so one failing directory costs its own entries
  // rather than the whole sitemap.
  const [areaEntries, developerEntries, agentEntries, cmsPageEntries] =
    await Promise.all([
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
      // Advisor profiles. Every /agents/<slug> page was indexable and reachable
      // from /agents, but none was advertised — so the directory was in the
      // sitemap and nothing it pointed at was. listAgents() filters to
      // role=agent, status=active, which is exactly the set whose pages
      // render, and returns an empty roster rather than a seeded one when the
      // read fails — so a bad hour costs this section its entries, never a
      // URL that 404s.
      //
      // DEFAULT_LOCALE is passed for the same reason as listDevelopers above:
      // an ambient locale read is a dynamic API and would drop /sitemap.xml off
      // prerendering.
      listAgents(DEFAULT_LOCALE)
        .then((rows) =>
          rows.map<MetadataRoute.Sitemap[number]>((a) => ({
            url: `${base}/agents/${a.slug}`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.5,
          })),
        )
        .catch((err) => {
          console.error("[sitemap] agent fetch failed", err);
          return [] as MetadataRoute.Sitemap;
        }),
      // Pages & blocks — editor-built pages served at /pages/<slug>. The helper
      // already excludes the master- and subpage- prefixes, which are CMS
      // documents backing other routes rather than pages of their own.
      listPublishedPageSlugs()
        .then((slugs) =>
          slugs.map<MetadataRoute.Sitemap[number]>((slug) => ({
            url: `${base}/pages/${slug}`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.5,
          })),
        )
        .catch((err) => {
          console.error("[sitemap] cms page fetch failed", err);
          return [] as MetadataRoute.Sitemap;
        }),
    ]);

  if (!isSupabaseConfigured) {
    return [
      ...staticEntries,
      ...categoryEntries,
      ...areaEntries,
      ...developerEntries,
      ...agentEntries,
      ...cmsPageEntries,
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
      ...agentEntries,
      ...cmsPageEntries,
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
      ...agentEntries,
      ...cmsPageEntries,
    ];
  }
}
