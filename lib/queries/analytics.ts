import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  ANALYTICS_RANGES,
  aggregateBySource,
  aggregateFunnel,
  aggregateViewingsByStatus,
  bucketByDay,
  FUNNEL_ORDER,
  parseAnalyticsRange,
  type AnalyticsRange,
  type EnquiriesBySource,
  type FunnelStage,
  type TimeBucket,
  type ViewingsByStatus,
} from "./analytics-utils";

export type {
  AnalyticsRange,
  EnquiriesBySource,
  FunnelStage,
  TimeBucket,
  ViewingsByStatus,
};
export {
  ANALYTICS_RANGES,
  aggregateBySource,
  aggregateFunnel,
  aggregateViewingsByStatus,
  bucketByDay,
  parseAnalyticsRange,
};

export type AnalyticsSnapshot = {
  range_days: number;
  kpis: {
    properties_published: number;
    properties_published_delta: number;
    enquiries_total: number;
    enquiries_delta: number;
    viewings_total: number;
    viewings_delta: number;
    avg_property_price_aed: number | null;
  };
  properties_published_over_time: TimeBucket[];
  enquiries_over_time: TimeBucket[];
  enquiries_by_source: EnquiriesBySource[];
  enquiry_funnel: FunnelStage[];
  viewings_by_status: ViewingsByStatus[];
};

const EMPTY: AnalyticsSnapshot = {
  range_days: 30,
  kpis: {
    properties_published: 0,
    properties_published_delta: 0,
    enquiries_total: 0,
    enquiries_delta: 0,
    viewings_total: 0,
    viewings_delta: 0,
    avg_property_price_aed: null,
  },
  properties_published_over_time: [],
  enquiries_over_time: [],
  enquiries_by_source: [],
  enquiry_funnel: FUNNEL_ORDER.map((s) => ({ ...s })),
  viewings_by_status: [],
};

function pct(delta: number, prior: number): number {
  if (prior === 0) return delta === 0 ? 0 : 100;
  return Math.round((delta / prior) * 100);
}

export async function getAnalyticsSnapshot(
  rangeDays: AnalyticsRange,
): Promise<AnalyticsSnapshot> {
  if (!isSupabaseConfigured) return { ...EMPTY, range_days: rangeDays };
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const since = new Date(now.getTime() - rangeDays * 86_400_000);
  const sincePrior = new Date(now.getTime() - rangeDays * 2 * 86_400_000);

  const [
    properties,
    propertiesPrior,
    enquiriesCurrent,
    enquiriesPrior,
    viewingsCurrent,
    viewingsPrior,
    enquiriesAll,
    priceAvg,
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("published_at, price_aed")
      .eq("status", "published")
      .is("deleted_at", null)
      .gte("published_at", since.toISOString()),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null)
      .gte("published_at", sincePrior.toISOString())
      .lt("published_at", since.toISOString()),
    supabase
      .from("enquiries")
      .select("created_at, source, status")
      .gte("created_at", since.toISOString()),
    supabase
      .from("enquiries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sincePrior.toISOString())
      .lt("created_at", since.toISOString()),
    supabase
      .from("viewings")
      .select("scheduled_for, status")
      .gte("created_at", since.toISOString()),
    supabase
      .from("viewings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sincePrior.toISOString())
      .lt("created_at", since.toISOString()),
    supabase.from("enquiries").select("status"),
    supabase
      .from("properties")
      .select("price_aed")
      .eq("status", "published")
      .is("deleted_at", null),
  ]);

  const propertyRows =
    (properties.data as unknown as Array<{
      published_at: string | null;
      price_aed: number | string;
    }> | null) ?? [];
  const enquiriesRows =
    (enquiriesCurrent.data as unknown as Array<{
      created_at: string;
      source: string | null;
      status: string | null;
    }> | null) ?? [];
  const viewingsRows =
    (viewingsCurrent.data as unknown as Array<{
      scheduled_for: string | null;
      status: string | null;
    }> | null) ?? [];

  const propertyCurrentTotal = propertyRows.length;
  const propertyPriorTotal = propertiesPrior.count ?? 0;
  const enquiriesCurrentTotal = enquiriesRows.length;
  const enquiriesPriorTotal = enquiriesPrior.count ?? 0;
  const viewingsCurrentTotal = viewingsRows.length;
  const viewingsPriorTotal = viewingsPrior.count ?? 0;

  const priceRows =
    (priceAvg.data as unknown as Array<{
      price_aed: number | string;
    }> | null) ?? [];
  const avgPrice =
    priceRows.length === 0
      ? null
      : Math.round(
          priceRows.reduce((sum, r) => sum + Number(r.price_aed), 0) /
            priceRows.length,
        );

  return {
    range_days: rangeDays,
    kpis: {
      properties_published: propertyCurrentTotal,
      properties_published_delta: pct(
        propertyCurrentTotal - propertyPriorTotal,
        propertyPriorTotal,
      ),
      enquiries_total: enquiriesCurrentTotal,
      enquiries_delta: pct(
        enquiriesCurrentTotal - enquiriesPriorTotal,
        enquiriesPriorTotal,
      ),
      viewings_total: viewingsCurrentTotal,
      viewings_delta: pct(
        viewingsCurrentTotal - viewingsPriorTotal,
        viewingsPriorTotal,
      ),
      avg_property_price_aed: avgPrice,
    },
    properties_published_over_time: bucketByDay(
      propertyRows.map((r) => r.published_at),
      rangeDays,
      now,
    ),
    enquiries_over_time: bucketByDay(
      enquiriesRows.map((r) => r.created_at),
      rangeDays,
      now,
    ),
    enquiries_by_source: aggregateBySource(enquiriesRows.map((r) => r.source)),
    enquiry_funnel: aggregateFunnel(
      (
        (enquiriesAll.data as unknown as Array<{
          status: string | null;
        }> | null) ?? []
      ).map((r) => r.status),
    ),
    viewings_by_status: aggregateViewingsByStatus(
      viewingsRows.map((r) => r.status),
    ),
  };
}
