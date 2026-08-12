import { Eyebrow } from "@/components/brand/eyebrow";

type Row = {
  slug: string;
  name: string;
  views: number;
  enquiries: number;
};

/**
 * Sprint 7h (backfilled): top-neighborhoods bar chart card.
 * Reads from `recently_viewed` (Sprint 8) + enquiries; today the parent
 * passes a seed snapshot.
 */
export function TopNeighborhoods({ rows }: { rows: Row[] }) {
  const max = rows.reduce((m, r) => Math.max(m, r.views), 0) || 1;

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <Eyebrow>Top neighborhoods · 30 days</Eyebrow>
      <h3
        className="serif text-[18px] mt-1 leading-tight"
        style={{ letterSpacing: "-0.01em" }}
      >
        Where attention is concentrated.
      </h3>
      <div className="mt-5 flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.slug}>
            <div className="flex items-baseline justify-between mb-1 text-[12.5px]">
              <span className="text-bz-ink-2">{r.name}</span>
              <span className="mono text-bz-muted">
                <span className="text-bz-ink">{r.views.toLocaleString()}</span>{" "}
                views · {r.enquiries} enq
              </span>
            </div>
            <div className="h-2 rounded-full bg-bz-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-bz-ink"
                style={{ width: `${Math.max(3, (r.views / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
