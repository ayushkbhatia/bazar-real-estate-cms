/**
 * The daily operations digest.
 *
 * /admin/settings/health answers "what broke?" the moment someone looks. This
 * is the half that does not wait to be asked.
 *
 * ── It is silent on a quiet day ──────────────────────────────────────────
 * A digest that arrives every morning saying "all clear" teaches its readers
 * to delete it unread, and the one morning it matters it is deleted unread
 * too. So nothing is sent unless there is something to report. An arrival
 * always means there is something to read, which is the only property that
 * makes an alert worth having.
 *
 * ── It cannot report on itself ───────────────────────────────────────────
 * This is a cron reporting on crons: if the scheduler dies, so does the thing
 * that would tell you. That circularity is why `cron_heartbeats` exists and
 * why the health page is pull-based — a job that has stopped stamping shows
 * as late the moment an admin opens the page, with nothing having to fire.
 * This route is the convenience, not the guarantee.
 *
 * Runs at 07:00, after the overnight jobs (02:00 Meilisearch, 03:00
 * embeddings, 06:00 permits) so it can report on the night they just had.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import { reportError, recordHeartbeat } from "@/lib/observability";
import { healthDigestEmail } from "@/lib/content-assets/system-emails";
import { sendEmail } from "@/lib/email";
import {
  isStale,
  staleAfterMinutes,
  neverRunIsMeaningful,
  SCHEDULED_JOBS,
} from "@/lib/queries/health";
import type { Database } from "@/db/types";

const JOB = "health-digest";

/** Errors first seen or seen again inside this window are "the last day". */
const WINDOW_HOURS = 24;

/** Enough to tell the story; the page has the rest. */
const MAX_LINES = 12;

function adminClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Service-role Supabase not configured");
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function ago(iso: string, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

/**
 * Every active admin's address.
 *
 * Resolved once. `auth.admin.getUserById` is a round trip per call, and the
 * escalation cron learned the hard way what putting one inside a loop costs.
 */
async function adminEmails(
  admin: ReturnType<typeof adminClient>,
): Promise<string[]> {
  const { data: staff } = await admin
    .from("staff")
    .select("user_id")
    .eq("status", "active")
    .eq("role", "admin");

  const out: string[] = [];
  for (const row of staff ?? []) {
    const { data } = await admin.auth.admin.getUserById(row.user_id);
    const email = data?.user?.email;
    if (email) out.push(email);
  }
  return out;
}

export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, reason: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, reason: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "no supabase" });
  }

  const admin = adminClient();
  const now = new Date();

  try {
    const since = new Date(now.getTime() - WINDOW_HOURS * 3_600_000).toISOString();

    const [{ data: errors, error: errErr }, { data: beats, error: beatErr }] =
      await Promise.all([
        admin
          .from("error_events")
          .select("source, message, count, last_seen_at")
          .is("resolved_at", null)
          .gte("last_seen_at", since)
          .order("last_seen_at", { ascending: false })
          .limit(MAX_LINES),
        admin
          .from("cron_heartbeats")
          .select("job, last_run_at, last_ok, consecutive_failures, last_detail"),
      ]);
    if (errErr) throw errErr;
    if (beatErr) throw beatErr;

    const errorLines = (errors ?? []).map(
      (e) =>
        `${e.source}${e.count > 1 ? ` ×${e.count}` : ""} — ${String(e.message).slice(0, 140)}`,
    );

    const byJob = new Map((beats ?? []).map((b) => [b.job, b]));

    // "Never run" is only meaningful once the scheduler has demonstrably
    // fired at least once.
    //
    // On the morning after a deploy the daily jobs have not come round yet —
    // post-valuation-nurture runs at 08:00, an hour AFTER this — so reporting
    // them would mail every admin about a job that is simply not due. A
    // digest that cries wolf on day one teaches its readers to ignore it,
    // which is the one thing it cannot afford. The health page still shows
    // them as never run: an admin who goes looking deserves the whole truth,
    // and there the absence is information rather than an interruption.
    // The oldest stamp is how long the scheduler has demonstrably been
    // running. A job with no heartbeat is only worth reporting once that
    // exceeds its own cadence — otherwise a deploy at 14:00 makes every daily
    // job look dead until its hour comes round.
    const oldest = (beats ?? [])
      .map((b) => b.last_run_at)
      .sort()[0] ?? null;

    const jobLines: string[] = [];
    for (const job of SCHEDULED_JOBS) {
      const hb = byJob.get(job);
      if (!hb) {
        if (neverRunIsMeaningful(job, oldest, now)) {
          jobLines.push(`${job} — has never run`);
        }
      } else if (isStale(hb, now)) {
        jobLines.push(
          `${job} — last run ${ago(hb.last_run_at, now)}, expected every ${staleAfterMinutes(job)}m`,
        );
      } else if (!hb.last_ok) {
        jobLines.push(
          `${job} — failing${hb.consecutive_failures > 1 ? `, ${hb.consecutive_failures} in a row` : ""}: ${String(hb.last_detail ?? "").slice(0, 120)}`,
        );
      }
    }

    // Nothing to say. See the docblock: this silence is the feature.
    if (errorLines.length === 0 && jobLines.length === 0) {
      await recordHeartbeat(JOB, { ok: true, detail: "quiet — nothing to report" });
      return NextResponse.json({ ok: true, sent: 0, quiet: true });
    }

    const recipients = await adminEmails(admin);
    if (recipients.length === 0) {
      // Worth surfacing rather than shrugging: an org with no reachable admin
      // has no path for any of this to reach a person.
      await reportError(new Error("No active admin has an email address"), {
        source: "cron/health-digest",
        level: "warning",
      });
      await recordHeartbeat(JOB, { ok: false, detail: "no admin recipients" });
      return NextResponse.json({ ok: true, sent: 0, reason: "no recipients" });
    }

    const tpl = await healthDigestEmail({
      errorLines,
      jobLines,
      errorCount: errorLines.length,
      jobCount: jobLines.length,
    });

    let sent = 0;
    for (const to of recipients) {
      const res = await sendEmail({
        to,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
      if (res.status === "ok") sent += 1;
    }

    await recordHeartbeat(JOB, {
      ok: true,
      detail: `sent ${sent} · ${errorLines.length} errors, ${jobLines.length} jobs`,
    });
    return NextResponse.json({
      ok: true,
      sent,
      errors: errorLines.length,
      jobs: jobLines.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await reportError(err, { source: "cron/health-digest" });
    await recordHeartbeat(JOB, { ok: false, detail: message });
    console.error("[cron/health-digest]", message);
    return NextResponse.json({ ok: false, reason: message }, { status: 500 });
  }
}
