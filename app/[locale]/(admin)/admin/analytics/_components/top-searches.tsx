import { Eyebrow } from "@/components/brand/eyebrow";
import { Search } from "lucide-react";

type Search = {
  query: string;
  count: number;
};

/**
 * Sprint 7h (backfilled): top-searches card for /admin/analytics.
 * Meilisearch logs queries in Sprint 12 — until then we surface the
 * parent's deterministic seed list.
 */
export function TopSearches({ rows }: { rows: Search[] }) {
  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <Eyebrow>Top searches</Eyebrow>
      <h3
        className="serif text-[18px] mt-1 leading-tight"
        style={{ letterSpacing: "-0.01em" }}
      >
        What buyers are typing.
      </h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-[13px] text-bz-muted">
          No queries logged yet — Sprint 12 wires Meilisearch.
        </p>
      ) : (
        <ol className="mt-4 flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <li
              key={r.query}
              className="flex items-center gap-3 text-[13px] py-1"
            >
              <span className="mono text-[10.5px] text-bz-muted w-4 flex-shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Search
                size={11}
                strokeWidth={1.7}
                className="text-bz-muted flex-shrink-0"
              />
              <span className="text-bz-ink flex-1 truncate">{r.query}</span>
              <span className="mono text-[11px] text-bz-muted">
                {r.count.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
