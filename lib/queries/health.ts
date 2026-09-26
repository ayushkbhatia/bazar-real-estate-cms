import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What the health screen reads.
 *
 * Service-role throughout. The RLS policies on both tables allow staff to
 * SELECT, so an ordinary client would work — but the page is admin-only and
 * reading through the same client the writers use keeps one story about who
 * touches these tables.
 */

export type ErrorEvent = {
  id: string;
  fingerprint: string;
  source: string;
  level: "error" | "warning";
  message: string;
  context: Record<string, unknown>;
  count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
};

export type Heartbeat = {
  job: string;
  last_run_at: string;
  last_ok: boolean;
  last_detail: string | null;
  consecutive_failures: number;
};

/**
 * How long a job may go unstamped before the page calls it stale.
 *
 * Keyed off each job's own cadence rather than one global number: a job that
 * runs daily at 03:00 is not late at 09:00, and a five-minute job is very
 * late indeed after an hour. The multiplier is generous — three missed runs,
 * or six hours for the daily jobs, so a single slow run never cries wolf.
 */
const EXPECTED_INTERVAL_MINUTES: Record<string, number> = {
  "enquiry-auto-reply": 1,
  "enquiry-escalation": 5,
  "salesforce-lead-sync": 5,
  "salesforce-listing-sync": 15,
  "permit-expiry": 1440,
  "meilisearch-sync": 1440,
  "embeddings-backfill": 1440,
  "post-valuation-nurture": 1440,
  "health-digest": 1440,
};

export function staleAfterMinutes(job: string): number {
  const cadence = EXPECTED_INTERVAL_MINUTES[job] ?? 60;
  return cadence >= 1440 ? cadence + 360 : cadence * 3;
}

export function isStale(hb: Heartbeat, now: Date = new Date()): boolean {
  const age = (now.getTime() - new Date(hb.last_run_at).getTime()) / 60_000;
  return age > staleAfterMinutes(hb.job);
}

/**
 * How long the scheduler must have been running before a job with no
 * heartbeat is worth reporting as "never run".
 *
 * One full cycle of that job's own cadence. Without this, a deploy at 14:00
 * makes every daily job look dead until its hour comes round, and the 07:00
 * digest mails three admins about post-valuation-nurture — which runs at
 * 08:00 and is simply not due yet.
 *
 * The scheduler's age is taken from the OLDEST heartbeat, which is the best
 * available proxy for "when did any of this start running": there is no
 * deploy timestamp in the database, and using the newest would reset the
 * grace period on every run.
 */
export function neverRunIsMeaningful(
  job: string,
  oldestHeartbeat: string | null,
  now: Date = new Date(),
): boolean {
  if (!oldestHeartbeat) return false; // nothing has ever run; say nothing
  const ageMinutes =
    (now.getTime() - new Date(oldestHeartbeat).getTime()) / 60_000;
  return ageMinutes >= (EXPECTED_INTERVAL_MINUTES[job] ?? 60);
}

/**
 * The digest's recipient override, parsed from `HEALTH_DIGEST_RECIPIENTS`.
 *
 * Comma- or whitespace-separated. Anything that is not shaped like an address
 * is dropped rather than thrown on, and the result is lower-cased and
 * de-duplicated. An empty result means "no override": the digest falls back
 * to every active admin, so a blank or mistyped variable never silences it.
 */
export function parseDigestRecipients(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const out = new Set<string>();
  for (const part of raw.split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) out.add(email);
  }
  return [...out];
}

/** Jobs that vercel.json schedules — so a job that has NEVER run is visible
 *  as an absence rather than simply missing from the table. */
export const SCHEDULED_JOBS = Object.keys(EXPECTED_INTERVAL_MINUTES).sort();

export async function listOpenErrors(limit = 100): Promise<ErrorEvent[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("error_events")
    .select(
      "id, fingerprint, source, level, message, context, count, first_seen_at, last_seen_at, resolved_at",
    )
    .is("resolved_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(limit);
  if (error) {
    // The page renders an empty state rather than a 500: a health screen that
    // crashes when the health tables are missing is the least useful possible
    // behaviour.
    console.error("[health] listOpenErrors", error.message);
    return [];
  }
  return (data ?? []) as unknown as ErrorEvent[];
}

export async function listHeartbeats(): Promise<Heartbeat[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("cron_heartbeats")
    .select("job, last_run_at, last_ok, last_detail, consecutive_failures")
    .order("job");
  if (error) {
    console.error("[health] listHeartbeats", error.message);
    return [];
  }
  return (data ?? []) as unknown as Heartbeat[];
}
