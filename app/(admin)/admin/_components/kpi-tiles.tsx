import Link from "next/link";

type Kpi = {
  label: string;
  value: string | number;
  delta?: string;
  href?: string;
};

/**
 * Sprint 7a (backfilled): 5-KPI tile row on the admin dashboard.
 * Plan called for Active / Drafts / New enquiries (24h) / Hot leads /
 * Closing AED. The Closing-AED placeholder reads from `deals` totals
 * once Sprint 9 wires the aggregate.
 */
export function DashboardKpiTiles({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {kpis.map((kpi) => {
        const content = (
          <>
            <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
              {kpi.label}
            </div>
            <div
              className="text-[26px] font-medium mt-1 leading-none"
              style={{ letterSpacing: "-0.02em" }}
            >
              {kpi.value}
            </div>
            {kpi.delta ? (
              <div className="text-[11px] text-bz-muted mt-2 mono">
                {kpi.delta}
              </div>
            ) : null}
          </>
        );
        return kpi.href ? (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="p-4 border border-bz-border rounded-lg bg-bz-surface hover:border-bz-border-strong transition-colors"
          >
            {content}
          </Link>
        ) : (
          <div
            key={kpi.label}
            className="p-4 border border-bz-border rounded-lg bg-bz-surface"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
