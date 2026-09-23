import "server-only";
import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

/**
 * Where a swallowed error goes.
 *
 * This codebase catches a great deal on purpose — the audit write that must
 * not block the operation it records, the submission log that must not turn a
 * captured lead into an error screen, eight cron routes that answer a
 * scheduler nobody watches. Each of those ended in `Sentry.captureException`,
 * and production has never had a DSN, so each was a silent drop.
 *
 * What those call sites actually need is not the clever half of an APM. They
 * pass an error and some context and want it remembered, grouped, and shown
 * to a human. That is a table, a hash and an admin screen, and this product
 * already owns all three.
 *
 * ── Sentry is not removed, it is demoted ─────────────────────────────────
 * If a DSN is ever set, every report is forwarded as well as stored. That
 * keeps the decision reversible at no cost: turn it on for a week to chase
 * something gnarly, turn it off again, and nothing in the call sites changes.
 *
 * ── This function may not throw ──────────────────────────────────────────
 * It runs inside `catch` blocks whose whole purpose is that the caller
 * survives. An error reporter that can itself fail the request it is
 * reporting on is worse than none. Every path here is guarded, and the last
 * resort is `console.error`, which on Vercel lands in the function logs.
 */

export type ReportInput = {
  /** Where it happened: "cron/salesforce-lead-sync", "forms/record". */
  source: string;
  level?: "error" | "warning";
  /** Structured extras — ids, counts, the enquiry involved. */
  context?: Record<string, unknown>;
};

/**
 * Collapse the variable parts of a message so the same failure groups.
 *
 * A cron failing all night on different rows produces "lead a04X failed",
 * "lead a04Y failed", "lead a04Z failed". Fingerprinting the raw text makes
 * 288 rows nobody reads; normalising first makes one row with a count of 288,
 * which is the number that actually tells you something.
 *
 * Exported for the spec — the grouping rule is the whole value of this file,
 * and it deserves to be asserted directly.
 */
export function normaliseMessage(message: string): string {
  return message
    .toLowerCase()
    // UUIDs, then Salesforce-shaped ids, then any long hex run.
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      "<id>",
    )
    .replace(/\b[a-z0-9]{15,18}\b/g, "<id>")
    .replace(/\b[0-9a-f]{12,}\b/g, "<id>")
    // Quoted values: "BAZ-AD-04891", 'Thursday 4:30 pm'.
    .replace(/'[^']*'/g, "<v>")
    .replace(/"[^"]*"/g, "<v>")
    // Numbers last, so this cannot eat the digits inside the patterns above
    // before they have had their turn. Not `\b\d+\b`: a word boundary needs a
    // non-word character after the digits, so "30s", "500ms" and "4.5MB" —
    // which is most of what a timeout or a size limit actually says — slipped
    // through and fingerprinted as different problems.
    .replace(/\d+(?:[.,]\d+)*/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stable across deploys and machines — it must be, or grouping resets. */
export function fingerprintOf(source: string, message: string): string {
  return createHash("sha256")
    .update(`${source}::${normaliseMessage(message)}`)
    .digest("hex")
    .slice(0, 32);
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err).slice(0, 500);
  } catch {
    return String(err);
  }
}

function stackOf(err: unknown): string | null {
  // Trimmed rather than stored whole: the frames that matter are at the top,
  // and the rest is node_modules.
  if (err instanceof Error && err.stack) {
    return err.stack.split("\n").slice(0, 12).join("\n");
  }
  return null;
}

/**
 * Record a problem. Never throws, never blocks on failure.
 *
 * Returns nothing on purpose: no caller should branch on whether reporting
 * worked, and offering the choice invites a `catch` around the reporter.
 */
export async function reportError(
  err: unknown,
  input: ReportInput,
): Promise<void> {
  const message = messageOf(err).slice(0, 2000);
  const level = input.level ?? "error";

  // Forward first, so a Sentry that is configured still sees the event even
  // if the database write is the thing that is broken.
  if (env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN) {
    try {
      Sentry.captureException(err, {
        level,
        tags: { source: input.source },
        contexts: { report: (input.context ?? {}) as Record<string, unknown> },
      });
    } catch {
      // A broken forward must not cost us the local record.
    }
  }

  try {
    const admin = createAdminClient();
    if (!admin) {
      console.error(`[${input.source}] ${message}`, input.context ?? {});
      return;
    }

    const fingerprint = fingerprintOf(input.source, message);
    const stack = stackOf(err);
    const context = {
      ...(input.context ?? {}),
      ...(stack ? { stack } : {}),
    };

    // One statement for both the first sighting and the 288th. `count` is
    // incremented in the database rather than read-then-written, so two cron
    // invocations racing on the same failure cannot lose an occurrence.
    const { error } = await admin.rpc("record_error_event", {
      p_fingerprint: fingerprint,
      p_source: input.source,
      p_level: level,
      p_message: message,
      p_context: context as never,
    });

    if (error) {
      // The table not existing is the expected state between merging this and
      // applying 0134; it is not worth shouting about, and the console still
      // carries the original problem.
      console.error(`[${input.source}] ${message}`, input.context ?? {});
      if (error.code !== "42P01" && error.code !== "PGRST202") {
        console.error("[observability] could not record:", error.message);
      }
    }
  } catch (reporterFailure) {
    // Last resort. On Vercel this is the function log, which is the backstop
    // the whole design assumes when the database itself is unreachable.
    console.error(`[${input.source}] ${message}`, input.context ?? {});
    console.error("[observability] reporter threw:", reporterFailure);
  }
}

/**
 * Record a problem that is not an exception — a lead given up on, an erasure
 * that cannot complete. Sentry called this `captureMessage`; the distinction
 * matters only in that there is no stack to keep.
 */
export async function reportIssue(
  message: string,
  input: ReportInput,
): Promise<void> {
  await reportError(new Error(message), input);
}

/**
 * Stamp a job's heartbeat.
 *
 * Called by every cron on every run, success or failure. It is what makes
 * "the scheduler is dead" detectable without anything having to fire: an
 * admin opening the health page sees a job whose last run was hours ago.
 *
 * Best-effort like the rest of this file — a heartbeat that fails must not
 * fail the job it is measuring.
 */
export async function recordHeartbeat(
  job: string,
  outcome: { ok: boolean; detail?: string | null },
): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    await admin.rpc("record_cron_heartbeat", {
      p_job: job,
      p_ok: outcome.ok,
      p_detail: outcome.detail ?? null,
    });
  } catch {
    // Silent: the job's own result is what matters.
  }
}
