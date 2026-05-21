/**
 * Pure, server-agnostic analytics helpers + types. Safe to import from
 * Client Components — no `next/headers`, no Supabase server client.
 */

export type TimeBucket = { date: string; count: number };

export type EnquiriesBySource = {
  source: string;
  count: number;
};

export type FunnelStage = {
  status: string;
  label: string;
  count: number;
};

export type ViewingsByStatus = {
  status: string;
  count: number;
};

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export function parseAnalyticsRange(input: unknown): AnalyticsRange {
  const n = Number(input);
  if ((ANALYTICS_RANGES as readonly number[]).includes(n)) {
    return n as AnalyticsRange;
  }
  return 30;
}

/** Bucket ISO timestamps into days. Returned in ascending date order with
 *  pre-filled zero entries so a sparse stream still draws a continuous line. */
export function bucketByDay(
  isoTimestamps: Array<string | null | undefined>,
  rangeDays: number,
  now = new Date(),
): TimeBucket[] {
  const buckets = new Map<string, number>();
  const startMs = now.getTime() - rangeDays * 86_400_000;

  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    buckets.set(toIsoDate(d), 0);
  }

  for (const iso of isoTimestamps) {
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    if (d.getTime() < startMs) continue;
    const key = toIsoDate(d);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Source aggregation. Empty / null sources fall into "unknown". */
export function aggregateBySource(
  sources: Array<string | null | undefined>,
): EnquiriesBySource[] {
  const map = new Map<string, number>();
  for (const s of sources) {
    const key = s && s.trim() ? s.trim() : "unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
}

export const FUNNEL_ORDER: FunnelStage[] = [
  { status: "new", label: "New", count: 0 },
  { status: "in_progress", label: "Qualifying", count: 0 },
  { status: "viewing_scheduled", label: "Viewing", count: 0 },
  { status: "offer", label: "Offer", count: 0 },
  { status: "closed_won", label: "Closed", count: 0 },
];

/** Fold an enquiries-by-status array into the canonical funnel order. */
export function aggregateFunnel(
  statuses: Array<string | null | undefined>,
): FunnelStage[] {
  const counts = new Map<string, number>();
  for (const s of statuses) {
    if (!s) continue;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return FUNNEL_ORDER.map((stage) => ({
    ...stage,
    count: counts.get(stage.status) ?? 0,
  }));
}

export function aggregateViewingsByStatus(
  statuses: Array<string | null | undefined>,
): ViewingsByStatus[] {
  const map = new Map<string, number>();
  for (const s of statuses) {
    const key = s ?? "unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}
