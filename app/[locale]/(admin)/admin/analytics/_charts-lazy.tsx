"use client";

import dynamic from "next/dynamic";

/**
 * Lazy boundary for the recharts bundle (~360 kB).
 *
 * `analytics/page.tsx` is a Server Component and `ssr: false` is only legal
 * inside a client one, so the `dynamic()` calls live here and the page imports
 * from this module instead of `./_charts`. Every call site keeps its props —
 * `dynamic` infers them from the imported component.
 *
 * The KPI row above the charts stays server-rendered, so the page still shows
 * its numbers immediately; only the plotting library waits.
 *
 * The options object is repeated rather than hoisted into a shared `const`:
 * Turbopack requires an object literal here and fails the build with
 * `next/dynamic options must be an object literal` otherwise.
 */

function ChartSkeleton() {
  return (
    <div
      className="w-full h-[260px] rounded-lg bg-bz-surface-2 animate-pulse"
      aria-hidden
    />
  );
}

export const PublishedOverTimeChart = dynamic(
  () => import("./_charts").then((m) => m.PublishedOverTimeChart),
  { ssr: false, loading: ChartSkeleton },
);

export const EnquiriesOverTimeChart = dynamic(
  () => import("./_charts").then((m) => m.EnquiriesOverTimeChart),
  { ssr: false, loading: ChartSkeleton },
);

export const EnquiriesBySourceChart = dynamic(
  () => import("./_charts").then((m) => m.EnquiriesBySourceChart),
  { ssr: false, loading: ChartSkeleton },
);

export const FunnelChart = dynamic(
  () => import("./_charts").then((m) => m.FunnelChart),
  { ssr: false, loading: ChartSkeleton },
);

export const ViewingsByStatusChart = dynamic(
  () => import("./_charts").then((m) => m.ViewingsByStatusChart),
  { ssr: false, loading: ChartSkeleton },
);
