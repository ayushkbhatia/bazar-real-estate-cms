import { redirect } from "next/navigation";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Eyebrow } from "@/components/brand/eyebrow";
import { currentUserIsAdmin } from "@/lib/queries/staff";
import {
  getAnalyticsSnapshot,
  parseAnalyticsRange,
} from "@/lib/queries/analytics";
import { cn } from "@/lib/utils";
import {
  EnquiriesBySourceChart,
  EnquiriesOverTimeChart,
  FunnelChart,
  PublishedOverTimeChart,
  ViewingsByStatusChart,
} from "./_charts";
import { AnalyticsRangePicker } from "./_range-picker";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatAed(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  if (!(await currentUserIsAdmin())) {
    redirect("/admin?error=admins_only");
  }
  const params = await searchParams;
  const range = parseAnalyticsRange(
    typeof params.range === "string" ? params.range : undefined,
  );
  const snapshot = await getAnalyticsSnapshot(range);

  return (
    <CmsShell
      title="Analytics"
      breadcrumbs="Admin"
      primary={<AnalyticsRangePicker current={range} />}
    >
      <div className="flex flex-col gap-6 min-w-0">
        <div className="grid grid-cols-4 gap-3">
          <Kpi
            label="Properties published"
            value={snapshot.kpis.properties_published.toString()}
            delta={snapshot.kpis.properties_published_delta}
          />
          <Kpi
            label="Enquiries"
            value={snapshot.kpis.enquiries_total.toString()}
            delta={snapshot.kpis.enquiries_delta}
          />
          <Kpi
            label="Viewings"
            value={snapshot.kpis.viewings_total.toString()}
            delta={snapshot.kpis.viewings_delta}
          />
          <Kpi
            label="Avg property price"
            value={`AED ${formatAed(snapshot.kpis.avg_property_price_aed)}`}
          />
        </div>

        <div className="grid grid-cols-[1.4fr_1fr] gap-3">
          <Card title="Properties published over time">
            <PublishedOverTimeChart
              data={snapshot.properties_published_over_time}
            />
          </Card>
          <Card title="Enquiries by source">
            <EnquiriesBySourceChart data={snapshot.enquiries_by_source} />
          </Card>
        </div>

        <div className="grid grid-cols-[1.4fr_1fr] gap-3">
          <Card title="Enquiries over time">
            <EnquiriesOverTimeChart data={snapshot.enquiries_over_time} />
          </Card>
          <Card title="Viewings by status">
            <ViewingsByStatusChart data={snapshot.viewings_by_status} />
          </Card>
        </div>

        <Card title="Lead funnel (all-time)">
          <FunnelChart data={snapshot.enquiry_funnel} />
          <p className="text-[11.5px] text-bz-muted mt-3 leading-[1.55]">
            Drop-off is computed stage to stage. New → Qualifying → Viewing
            → Offer → Closed. We don&apos;t prune historical leads, so this
            view spans the whole pipeline since launch.
          </p>
        </Card>

        <Eyebrow>About the numbers</Eyebrow>
        <p className="text-[12.5px] text-bz-muted max-w-[80ch] -mt-3">
          Aggregates are computed at request time from the live Postgres
          tables (properties, enquiries, viewings). The range picker
          recalculates compared against the previous period for the KPI
          deltas. PostHog session metrics will fold in here in Phase 7.
        </p>
      </div>
    </CmsShell>
  );
}

function Kpi({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: number;
}) {
  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg p-4">
      <div className="eyebrow">{label}</div>
      <div
        className="serif text-[36px] mt-2 leading-none"
        style={{ letterSpacing: "-0.025em" }}
      >
        {value}
      </div>
      {delta != null ? <DeltaTag delta={delta} /> : null}
    </div>
  );
}

function DeltaTag({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <div className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-bz-muted">
        <Minus size={11} strokeWidth={2} /> flat vs. previous period
      </div>
    );
  }
  const positive = delta > 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div
      className={cn(
        "mt-2 inline-flex items-center gap-1 text-[11.5px]",
        positive ? "text-[oklch(0.5_0.13_145)]" : "text-bz-danger",
      )}
    >
      <Icon size={11} strokeWidth={2} />
      {Math.abs(delta)}% vs. previous period
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-bz-surface border border-bz-border rounded-lg p-5">
      <h2 className="text-[13px] font-medium tracking-tight mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}
