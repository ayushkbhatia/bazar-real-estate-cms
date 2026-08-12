import { Eyebrow } from "@/components/brand/eyebrow";
import Link from "next/link";

const STAGES = [
  { key: "new", label: "New" },
  { key: "qualifying", label: "Qualifying" },
  { key: "viewing", label: "Viewing" },
  { key: "offer", label: "Offer" },
  { key: "negotiation", label: "Negotiation" },
] as const;

/**
 * Sprint 7a: 5-stage lead pipeline column chart. Renders inline SVG bars
 * keyed by stage. Counts come from the enquiries query in the dashboard.
 */
export function PipelineBarChart({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const values = STAGES.map((s) => counts[s.key] ?? 0);
  const max = Math.max(1, ...values);
  const totalCount = values.reduce((sum, v) => sum + v, 0);

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <Eyebrow>Lead pipeline · 30 days</Eyebrow>
          <h2
            className="serif text-[20px] mt-2 leading-tight"
            style={{ letterSpacing: "-0.012em" }}
          >
            {totalCount} active leads across {STAGES.length} stages.
          </h2>
        </div>
        <Link
          href="/admin/enquiries"
          className="text-[12.5px] text-bz-muted hover:text-bz-ink-2"
        >
          Open inbox →
        </Link>
      </div>

      <div className="grid grid-cols-5 gap-3 items-end h-[180px]">
        {STAGES.map((s, i) => {
          const value = values[i];
          const heightPct = Math.max(2, (value / max) * 100);
          return (
            <Link
              key={s.key}
              href={`/admin/enquiries?status=${s.key}`}
              className="group flex flex-col items-center gap-2 h-full justify-end"
            >
              <span className="mono text-[11px] text-bz-muted group-hover:text-bz-ink">
                {value}
              </span>
              <div
                className="w-full rounded-t bg-bz-accent group-hover:bg-bz-accent/85 transition-colors"
                style={{ height: `${heightPct}%`, minHeight: "8px" }}
              />
            </Link>
          );
        })}
      </div>
      <div className="grid grid-cols-5 gap-3 mt-3">
        {STAGES.map((s) => (
          <div
            key={s.key}
            className="text-[11px] uppercase tracking-wider text-bz-muted text-center"
          >
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
