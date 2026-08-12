import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Trophy } from "lucide-react";

type Row = {
  user_id: string;
  display_name: string;
  title: string | null;
  closedAed: number;
  deals: number;
};

/**
 * Sprint 7h (backfilled): QTD agent leaderboard. Sprint 9 wires the
 * deals-aggregate query; the parent passes a seed snapshot for now.
 */
export function AgentLeaderboard({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <Eyebrow>Agent leaderboard · QTD</Eyebrow>
      <h3
        className="serif text-[18px] mt-1 leading-tight"
        style={{ letterSpacing: "-0.01em" }}
      >
        Who&apos;s closing.
      </h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-[13px] text-bz-muted">
          No closed deals this quarter yet.
        </p>
      ) : (
        <ol className="mt-4 flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={r.user_id}>
              <Link
                href={`/admin/agents/${r.user_id}`}
                className="flex items-center gap-3 py-2 -mx-1 px-1 rounded hover:bg-bz-bg/60 transition-colors"
              >
                <span
                  className={
                    i === 0
                      ? "inline-flex w-6 h-6 rounded-full bg-bz-accent text-bz-accent-fg items-center justify-center flex-shrink-0"
                      : "inline-flex w-6 h-6 rounded-full bg-bz-surface-2 text-bz-muted items-center justify-center text-[11px] mono flex-shrink-0"
                  }
                >
                  {i === 0 ? (
                    <Trophy size={11} strokeWidth={1.7} />
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] text-bz-ink truncate">
                    {r.display_name}
                  </div>
                  {r.title ? (
                    <div className="text-[11.5px] text-bz-muted truncate">
                      {r.title}
                    </div>
                  ) : null}
                </div>
                <div className="text-end flex-shrink-0">
                  <div className="mono text-[13px] text-bz-ink">
                    AED {(r.closedAed / 1_000_000).toFixed(1)}M
                  </div>
                  <div className="text-[11px] text-bz-muted">
                    {r.deals} deals
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
