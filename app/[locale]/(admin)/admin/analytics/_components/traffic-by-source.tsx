import { Eyebrow } from "@/components/brand/eyebrow";

type Source = {
  label: string;
  visits: number;
  share: number; // 0..1
};

/**
 * Sprint 7h (backfilled): "Traffic by source" horizontal bar chart for
 * /admin/analytics. Sprint 13 wires PostHog event ingestion; for now the
 * parent passes a deterministic seed snapshot so the surface renders.
 */
export function TrafficBySource({ rows }: { rows: Source[] }) {
  const max = rows.reduce((m, r) => Math.max(m, r.visits), 0) || 1;
  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <Eyebrow>Traffic by source · 30 days</Eyebrow>
      <ul className="mt-4 flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[12.5px] mb-1">
              <span className="text-bz-ink-2">{r.label}</span>
              <span className="mono text-bz-muted">
                {r.visits.toLocaleString()} ·{" "}
                <span className="text-bz-ink">
                  {(r.share * 100).toFixed(0)}%
                </span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-bz-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-bz-accent"
                style={{ width: `${Math.max(2, (r.visits / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
