import type { MetadataRoute } from "next";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured, env } from "@/lib/env";
import { propertyUrl } from "@/lib/queries/property-utils";

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

  if (!isSupabaseConfigured) return staticEntries;

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

    return [...staticEntries, ...propertyEntries];
  } catch (err) {
    console.error("[sitemap] property fetch failed", err);
    return staticEntries;
  }
}
