/**
 * Everything /services/sell reads at request time.
 *
 * Two rules the handoff is explicit about: no invented numbers, and no
 * placeholder art. So the hero rail counts real rows, and the transactions
 * card draws a real DLD trend — or, until the DLD import has run, drops the
 * figures rather than inventing them.
 */
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import {
  currentReportQuarter,
  getTrend,
  type TrendPoint,
} from "@/lib/queries/market-reports";

/**
 * A live rail figure and the `pages.sell.*` key that names it.
 *
 * A key rather than a label, because this module is a query: it counts rows
 * and knows nothing about the locale the page is rendering in. The page turns
 * the key into words. An editor who fills the stat list in Pages & blocks
 * replaces the whole rail — those strings are CMS copy with their own Arabic
 * twin, and never reach here.
 */
export type SellHeroStat = { value: string; labelKey: SellHeroStatKey };

export type SellHeroStatKey = "statListings" | "statAreas" | "statAdvisors";

/** The area the transactions card samples — Bazar's core sales patch. */
const SPARK_AREA_SLUG = "saadiyat-island";
const SPARK_AREA_NAME = "Saadiyat";

export async function getSellHeroStats(): Promise<SellHeroStat[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createSupabasePublicClient();
    const [listings, areas, advisors] = await Promise.all([
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      supabase
        .from("areas")
        .select("id", { count: "exact", head: true })
        .in("kind", ["area", "sub_community"]),
      supabase
        .from("staff")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "agent")
        .eq("status", "active"),
    ]);

    const stats: SellHeroStat[] = [];
    if (listings.count)
      stats.push({
        value: String(listings.count),
        labelKey: "statListings",
      });
    if (areas.count)
      stats.push({
        value: String(areas.count),
        labelKey: "statAreas",
      });
    if (advisors.count)
      stats.push({
        value: String(advisors.count),
        labelKey: "statAdvisors",
      });
    return stats;
  } catch {
    return [];
  }
}

export type TransactionSpark = {
  /** Oldest → newest AED per ft², already filtered to quarters with data. */
  points: number[];
  first: number;
  last: number;
  caption: string;
};

/**
 * Two years of registered-sale medians for the transactions card. Returns null
 * when there isn't enough DLD data to draw an honest line — the card then
 * renders without figures.
 */
export async function getTransactionSpark(): Promise<TransactionSpark | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const trend: TrendPoint[] = await getTrend({
      area_slug: SPARK_AREA_SLUG,
      property_type: "apartment",
      endQuarter: currentReportQuarter(),
      span: 8,
    });
    const points = trend
      .map((p) => p.median_aed_per_ft2)
      .filter((v): v is number => typeof v === "number" && v > 0);
    if (points.length < 3) return null;
    return {
      points,
      first: points[0]!,
      last: points[points.length - 1]!,
      caption: `${SPARK_AREA_NAME} median · 24 months · DLD-registered`,
    };
  } catch {
    return null;
  }
}
