import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";

type Entry = {
  id: string;
  actor: string;
  action: string;
  target: string;
  targetHref?: string;
  ago: string;
};

/**
 * Sprint 7a: recent activity feed on the admin dashboard. Sprint 9 wires
 * this to `audit_log` query — the placeholder structure shown below
 * matches the live shape so the swap is mechanical.
 */
export function ActivityFeed({ entries }: { entries: Entry[] }) {
  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <Eyebrow>Recent activity</Eyebrow>
          <h2
            className="serif text-[18px] mt-1 leading-tight"
            style={{ letterSpacing: "-0.01em" }}
          >
            Latest team actions.
          </h2>
        </div>
        <Link
          href="/admin/audit-log"
          className="text-[12.5px] text-bz-muted hover:text-bz-ink-2"
        >
          Full log →
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="text-[13px] text-bz-muted">
          No activity yet — actions appear here as they happen.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex gap-3 text-[13px] py-2 border-b border-bz-border last:border-b-0"
            >
              <span className="inline-flex w-7 h-7 rounded-full bg-bz-surface-2 text-bz-ink-2 items-center justify-center text-[10.5px] font-medium flex-shrink-0">
                {e.actor
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-bz-ink leading-snug">
                  <span className="font-medium">{e.actor}</span>{" "}
                  <span className="text-bz-ink-2">{e.action}</span>{" "}
                  {e.targetHref ? (
                    <Link
                      href={e.targetHref}
                      className="text-bz-ink-2 underline underline-offset-2 hover:text-bz-accent"
                    >
                      {e.target}
                    </Link>
                  ) : (
                    <span className="text-bz-ink-2">{e.target}</span>
                  )}
                </div>
                <div className="text-[11px] text-bz-muted mt-0.5">{e.ago}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
