/**
 * Market Reports query layer.
 *
 * Aggregates `dld_comparables` (per the 0029 migration) into per-
 * (area × property_type × quarter) snapshots that drive the
 * `/market-reports` content surface. No new tables needed for the v1
 * surface — if perf gets tight later we can materialise into a snapshot
 * table refreshed by cron.
 *
 * The valuation tool already reads `dld_comparables`; this module reuses the
 * same source data so both surfaces stay in sync.
 */

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";

export type PropertyTypeSlug =
  "villa" | "apartment" | "townhouse" | "penthouse";

const PROPERTY_TYPE_DB_NAME: Record<PropertyTypeSlug, string> = {
  villa: "Villa",
  apartment: "Apartment",
  townhouse: "Townhouse",
  penthouse: "Penthouse",
};

export const PROPERTY_TYPES: readonly PropertyTypeSlug[] = [
  "villa",
  "apartment",
  "townhouse",
  "penthouse",
] as const;

export function propertyTypeLabel(t: PropertyTypeSlug): string {
  return PROPERTY_TYPE_DB_NAME[t];
}

export type Quarter = {
  year: number;
  q: 1 | 2 | 3 | 4;
};

export function quarterFromDate(d: Date): Quarter {
  const m = d.getMonth();
  const q = (Math.floor(m / 3) + 1) as 1 | 2 | 3 | 4;
  return { year: d.getFullYear(), q };
}

export function quarterToSlug(q: Quarter): string {
  return `${q.year}-q${q.q}`;
}

export function quarterFromSlug(slug: string): Quarter | null {
  const m = /^(\d{4})-q([1-4])$/.exec(slug);
  if (!m) return null;
  return { year: parseInt(m[1]!, 10), q: parseInt(m[2]!, 10) as 1 | 2 | 3 | 4 };
}

export function quarterLabel(q: Quarter): string {
  return `Q${q.q} ${q.year}`;
}

export function quarterBoundaries(q: Quarter): { start: string; end: string } {
  // Inclusive start, exclusive end (so we get the full quarter).
  const startMonth = (q.q - 1) * 3;
  const start = new Date(Date.UTC(q.year, startMonth, 1));
  const end = new Date(Date.UTC(q.year, startMonth + 3, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** Lag the live "current" quarter by one calendar quarter so reports are
 *  always closed-book, not partial. */
export function currentReportQuarter(now: Date = new Date()): Quarter {
  const live = quarterFromDate(now);
  if (live.q === 1) return { year: live.year - 1, q: 4 };
  return { year: live.year, q: (live.q - 1) as 1 | 2 | 3 | 4 };
}

/** Step back N quarters from a given one (N >= 0). */
export function priorQuarter(q: Quarter, n: number): Quarter {
  let year = q.year;
  let qi = q.q - n;
  while (qi <= 0) {
    qi += 4;
    year -= 1;
  }
  return { year, q: qi as 1 | 2 | 3 | 4 };
}

export type Snapshot = {
  area_slug: string;
  area_name: string;
  property_type: PropertyTypeSlug;
  quarter: Quarter;
  /** Number of closed transactions in the quarter. */
  count: number;
  /** Median sale price (AED) — null when no transactions. */
  median_price_aed: number | null;
  /** Median AED per ft² — null when no transactions. */
  median_aed_per_ft2: number | null;
  /** Year-over-year change in median price (e.g. 0.12 = +12%) — null when
   *  insufficient prior-year data. */
  yoy_change: number | null;
};

export type TrendPoint = {
  quarter: Quarter;
  count: number;
  median_price_aed: number | null;
  median_aed_per_ft2: number | null;
};

export type Comparable = {
  transaction_date: string;
  price_aed: number;
  built_up_ft2: number | null;
  bedrooms: number | null;
  property_type: string;
  area_slug: string | null;
};

type DldRow = {
  transaction_date: string;
  property_type: string;
  area_slug: string | null;
  built_up_ft2: number | null;
  price_aed: number;
  bedrooms: number | null;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

async function fetchDldRows(opts: {
  area_slug: string;
  property_type: PropertyTypeSlug;
  start: string;
  end: string;
}): Promise<DldRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  // `dld_comparables` isn't in db/types.ts yet (Sprint 13 added it via 0029
  // but the types haven't been regenerated). Use the s8 escape hatch.
  const { data, error } = await supabase
    .from("dld_comparables")
    .select(
      "transaction_date, property_type, area_slug, built_up_ft2, price_aed, bedrooms",
    )
    .eq("area_slug", opts.area_slug)
    .eq("property_type", PROPERTY_TYPE_DB_NAME[opts.property_type])
    .gte("transaction_date", opts.start)
    .lt("transaction_date", opts.end);
  if (error || !data) return [];
  return data as DldRow[];
}

function aggregate(rows: DldRow[]): {
  count: number;
  median_price_aed: number | null;
  median_aed_per_ft2: number | null;
} {
  const prices = rows
    .map((r) => Number(r.price_aed))
    .filter((n) => Number.isFinite(n) && n > 0);
  const perFt2 = rows
    .filter((r) => r.built_up_ft2 && Number(r.built_up_ft2) > 0)
    .map((r) => Number(r.price_aed) / Number(r.built_up_ft2));
  return {
    count: rows.length,
    median_price_aed: median(prices),
    median_aed_per_ft2: median(perFt2),
  };
}

/** Resolve area slug → name in one DB hop. */
async function lookupAreaName(slug: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("areas")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();
  return data?.name ?? null;
}

export async function getSnapshot(opts: {
  area_slug: string;
  property_type: PropertyTypeSlug;
  quarter: Quarter;
}): Promise<Snapshot | null> {
  const area_name = await lookupAreaName(opts.area_slug);
  if (!area_name) return null;

  const cur = quarterBoundaries(opts.quarter);
  const curRows = await fetchDldRows({ ...opts, ...cur });
  const cur_agg = aggregate(curRows);

  // YoY: same quarter, prior year
  const prior = priorQuarter(opts.quarter, 4);
  const priorBounds = quarterBoundaries(prior);
  const priorRows = await fetchDldRows({ ...opts, ...priorBounds });
  const prior_agg = aggregate(priorRows);

  const yoy_change =
    cur_agg.median_price_aed != null &&
    prior_agg.median_price_aed != null &&
    prior_agg.median_price_aed > 0
      ? (cur_agg.median_price_aed - prior_agg.median_price_aed) /
        prior_agg.median_price_aed
      : null;

  return {
    area_slug: opts.area_slug,
    area_name,
    property_type: opts.property_type,
    quarter: opts.quarter,
    count: cur_agg.count,
    median_price_aed: cur_agg.median_price_aed,
    median_aed_per_ft2: cur_agg.median_aed_per_ft2,
    yoy_change,
  };
}

/** 8 quarters back (2 years). Returns oldest → newest. */
export async function getTrend(opts: {
  area_slug: string;
  property_type: PropertyTypeSlug;
  endQuarter: Quarter;
  span?: number;
}): Promise<TrendPoint[]> {
  const span = opts.span ?? 8;
  const quarters: Quarter[] = [];
  for (let i = span - 1; i >= 0; i--)
    quarters.push(priorQuarter(opts.endQuarter, i));

  // Fetch the full range in one query, then bin by quarter in JS.
  const oldest = quarterBoundaries(quarters[0]!);
  const newest = quarterBoundaries(quarters[quarters.length - 1]!);
  const rows = await fetchDldRows({
    area_slug: opts.area_slug,
    property_type: opts.property_type,
    start: oldest.start,
    end: newest.end,
  });

  return quarters.map((q) => {
    const bounds = quarterBoundaries(q);
    const subset = rows.filter(
      (r) =>
        r.transaction_date >= bounds.start && r.transaction_date < bounds.end,
    );
    const a = aggregate(subset);
    return { quarter: q, ...a };
  });
}

export async function listRecentComparables(opts: {
  area_slug: string;
  property_type: PropertyTypeSlug;
  quarter: Quarter;
  limit?: number;
}): Promise<Comparable[]> {
  const bounds = quarterBoundaries(opts.quarter);
  const rows = await fetchDldRows({ ...opts, ...bounds });
  return rows
    .sort((a, b) =>
      a.transaction_date < b.transaction_date
        ? 1
        : a.transaction_date > b.transaction_date
          ? -1
          : 0,
    )
    .slice(0, opts.limit ?? 10)
    .map((r) => ({
      transaction_date: r.transaction_date,
      price_aed: Number(r.price_aed),
      built_up_ft2: r.built_up_ft2 != null ? Number(r.built_up_ft2) : null,
      bedrooms: r.bedrooms,
      property_type: r.property_type,
      area_slug: r.area_slug,
    }));
}

/** All published areas that have at least one transaction in the live quarter,
 *  for the index page. */
export async function listReportableAreas(opts: {
  quarter: Quarter;
}): Promise<{ slug: string; name: string }[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const bounds = quarterBoundaries(opts.quarter);
  // Two queries: pull distinct area_slugs from comparables for the quarter,
  // then join area names. Postgres-pure approach would be one RPC; the JS
  // approach below is fine for ~30 areas.
  const { data: slugs } = await supabase
    .from("dld_comparables")
    .select("area_slug")
    .gte("transaction_date", bounds.start)
    .lt("transaction_date", bounds.end)
    .not("area_slug", "is", null);
  const distinct = [
    ...new Set(
      ((slugs ?? []) as { area_slug: string | null }[])
        .map((r) => r.area_slug)
        .filter((s): s is string => !!s),
    ),
  ];
  if (!distinct.length) return [];
  const { data: areas } = await supabase
    .from("areas")
    .select("slug, name")
    .in("slug", distinct)
    .order("name", { ascending: true });
  return (areas ?? []).map((a) => ({ slug: a.slug, name: a.name }));
}

/** Compact URL: `/market-reports/[area]/[type]/[quarter]`. */
export function reportPath(opts: {
  area_slug: string;
  property_type: PropertyTypeSlug;
  quarter: Quarter;
}): string {
  return `/market-reports/${opts.area_slug}/${opts.property_type}/${quarterToSlug(opts.quarter)}`;
}
