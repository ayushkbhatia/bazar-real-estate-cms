/**
 * Sprint 7h (backfilled): 5 KPI tile row for /admin/analytics.
 * Site visits / Property views / Enquiry conversion / Form completions /
 * Closes AED.
 */
type Kpi = {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
};

export function AnalyticsKpiTiles({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="p-5 rounded-lg border border-bz-border bg-bz-surface"
        >
          <div className="text-[11px] uppercase tracking-wider text-bz-muted">
            {k.label}
          </div>
          <div
            className="serif text-[32px] mt-1 leading-none"
            style={{ letterSpacing: "-0.02em" }}
          >
            {k.value}
          </div>
          <div
            className={
              k.positive
                ? "mt-2 mono text-[11px] text-bz-accent"
                : "mt-2 mono text-[11px] text-bz-danger"
            }
          >
            {k.delta}
          </div>
        </div>
      ))}
    </div>
  );
}
