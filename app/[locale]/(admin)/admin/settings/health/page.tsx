import { Eyebrow } from "@/components/brand/eyebrow";
import {
  listOpenErrors,
  listHeartbeats,
  isStale,
  staleAfterMinutes,
  SCHEDULED_JOBS,
  type Heartbeat,
} from "@/lib/queries/health";
import { ResolveButton } from "./_resolve-button";

export const dynamic = "force-dynamic";

function ago(iso: string, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

type JobRow = { job: string; hb: Heartbeat | null; stale: boolean };

/**
 * The health screen.
 *
 * Pull-based on purpose. A digest email is itself a scheduled job, so if the
 * scheduler dies the thing that would tell you dies with it. This page asks
 * the question at the moment someone looks, and needs nothing to have fired:
 * a job whose last stamp is older than three of its own intervals is late,
 * and a job that has never stamped at all shows as never run.
 */
export default async function AdminSettingsHealthPage() {
  const now = new Date();
  const [errors, heartbeats] = await Promise.all([
    listOpenErrors(),
    listHeartbeats(),
  ]);

  const byJob = new Map(heartbeats.map((h) => [h.job, h]));
  const jobs: JobRow[] = SCHEDULED_JOBS.map((job) => {
    const hb = byJob.get(job) ?? null;
    return { job, hb, stale: hb ? isStale(hb, now) : true };
  });

  const late = jobs.filter((j) => j.stale).length;
  const failing = jobs.filter((j) => j.hb && !j.hb.last_ok).length;

  return (
    <div className="flex flex-col gap-10">
      <header className="max-w-[860px]">
        <Eyebrow>Health</Eyebrow>
        <h1
          className="serif text-[32px] mt-2 font-normal leading-tight"
          style={{ letterSpacing: "-0.018em" }}
        >
          What broke, and what stopped running.
        </h1>
        <p className="mt-3 text-[14px] text-bz-muted leading-relaxed">
          Errors are grouped: one row per distinct problem, with a count of how
          often it has happened. Scheduled jobs stamp this page on every run,
          so a job that has gone quiet shows as late here without anything
          needing to send you a message.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Eyebrow>Scheduled jobs</Eyebrow>
          <span className="text-[11.5px] text-bz-muted">
            {late > 0 ? `${late} late` : "all on schedule"}
            {failing > 0 ? ` · ${failing} failing` : ""}
          </span>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {jobs.map(({ job, hb, stale }) => (
            <li
              key={job}
              className="rounded-lg border border-bz-border bg-bz-surface p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="mono text-[12.5px] text-bz-ink">{job}</span>
                <span
                  className={`text-[10px] mono px-2 py-0.5 rounded uppercase tracking-wider ${
                    !hb
                      ? "bg-bz-surface-2 text-bz-muted"
                      : stale || !hb.last_ok
                        ? "bg-red-100 text-red-800"
                        : "bg-bz-accent/15 text-bz-accent"
                  }`}
                >
                  {!hb ? "never run" : stale ? "late" : hb.last_ok ? "ok" : "failing"}
                </span>
              </div>
              <div className="mt-2 text-[11.5px] text-bz-muted">
                {hb ? (
                  <>
                    Last run {ago(hb.last_run_at, now)}
                    {stale
                      ? ` · expected every ${staleAfterMinutes(job)}m or sooner`
                      : ""}
                    {hb.consecutive_failures > 0
                      ? ` · ${hb.consecutive_failures} consecutive failures`
                      : ""}
                  </>
                ) : (
                  "No run recorded. Either the schedule has never fired, or CRON_SECRET is unset."
                )}
              </div>
              {hb?.last_detail ? (
                <div className="mt-1.5 text-[11px] text-bz-ink-2 mono break-words">
                  {hb.last_detail.slice(0, 200)}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Eyebrow>Open errors</Eyebrow>
          <span className="text-[11.5px] text-bz-muted">
            {errors.length === 0
              ? "nothing outstanding"
              : `${errors.length} open`}
          </span>
        </div>

        {errors.length === 0 ? (
          <p className="rounded-lg border border-bz-border bg-bz-surface p-6 text-[13px] text-bz-muted">
            Nothing has been reported. Errors land here from the cron jobs, the
            audit log, the form handlers and the Salesforce push — anywhere the
            code catches a problem and carries on.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {errors.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-bz-border bg-bz-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="mono text-[11px] px-1.5 py-0.5 rounded bg-bz-bg border border-bz-border text-bz-ink-2">
                        {e.source}
                      </span>
                      {e.count > 1 ? (
                        <span className="text-[11px] text-bz-muted">
                          ×{e.count}
                        </span>
                      ) : null}
                      <span className="text-[11px] text-bz-muted">
                        {ago(e.last_seen_at, now)}
                        {e.count > 1
                          ? ` · first ${ago(e.first_seen_at, now)}`
                          : ""}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] text-bz-ink break-words">
                      {e.message}
                    </p>
                  </div>
                  <ResolveButton id={e.id} />
                </div>
                {Object.keys(e.context ?? {}).length > 0 ? (
                  <details className="mt-3">
                    <summary className="text-[11.5px] text-bz-muted cursor-pointer">
                      Context
                    </summary>
                    <pre className="mt-2 text-[11px] mono text-bz-ink-2 whitespace-pre-wrap break-words bg-bz-bg border border-bz-border rounded p-2.5 overflow-x-auto">
                      {JSON.stringify(e.context, null, 2).slice(0, 4000)}
                    </pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
