import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { ArrowRight } from "lucide-react";

type Row = {
  id: string;
  reference: string;
  title: string;
  views: number;
  enquiries: number;
  priceAed: number;
};

/**
 * Sprint 7a (backfilled): "Top listings" card on the admin dashboard.
 * Lists the 5 most-viewed published properties. View counts pull from
 * PostHog in Sprint 13; until then the parent passes 0-views so the
 * card surfaces the listings ordered by recent enquiry count.
 */
export function TopListingsCard({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <Eyebrow>Top listings · 7 days</Eyebrow>
          <h3
            className="serif text-[18px] mt-1 leading-tight"
            style={{ letterSpacing: "-0.01em" }}
          >
            Where attention is going.
          </h3>
        </div>
        <Link
          href="/admin/properties"
          className="text-[12.5px] text-bz-muted hover:text-bz-ink-2"
        >
          All →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-bz-muted">
          No published listings yet. Top-viewed surfaces once Sprint 13
          wires PostHog event ingestion.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/properties/${r.id}`}
                className="flex items-center gap-3 py-1.5 -mx-1 px-1 rounded hover:bg-bz-bg/60 transition-colors"
              >
                <span className="mono text-[11px] text-bz-muted w-[88px] flex-shrink-0">
                  {r.reference}
                </span>
                <span className="text-[13px] text-bz-ink flex-1 truncate">
                  {r.title}
                </span>
                <span className="text-[11.5px] text-bz-muted text-end flex-shrink-0">
                  <span className="mono">{r.views.toLocaleString()}</span> v ·{" "}
                  <span className="mono">{r.enquiries}</span> enq
                </span>
                <ArrowRight
                  size={12}
                  strokeWidth={1.7}
                  className="text-bz-muted flex-shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
