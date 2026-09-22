/**
 * Salesforce lead sync — drains the enquiry queue into `Lead__c`.
 *
 * ── Why a cron and not a call at submit time ─────────────────────────────
 * A lead is the one thing on this site that must never be lost. Calling
 * Salesforce inside the submit action would put a third party's uptime in
 * front of the visitor's confirmation screen: an org in maintenance, a
 * revoked token or a slow login endpoint would turn a captured lead into an
 * error message. So the enquiry is written first and Salesforce is told
 * afterwards, out of band, with retries.
 *
 * The queue needs no enqueue step — `enquiries.crm_sync_state` defaults to
 * 'pending' (migration 0130), so every insert path enrols itself and no
 * future form can be added that forgets to. This route is the only consumer.
 *
 * ── Ordering ─────────────────────────────────────────────────────────────
 * Oldest first, so a backlog drains in the order the leads actually arrived
 * rather than newest-first, which would leave the oldest lead waiting longest.
 *
 * ── Two passes ───────────────────────────────────────────────────────────
 * Erasures run before pushes. `enquiries.crm_erasure_due_at` (migration 0131)
 * marks a subject whose PDPL erasure request reached Postgres but not yet the
 * CRM — normally because Salesforce was unreachable at the moment the admin
 * action ran. That obligation has a legal deadline and a lead does not, so if
 * one pass is going to be cut short by an API limit or the function timeout,
 * it should be the second one.
 */

import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured, isSalesforceConfigured } from "@/lib/env";
import { pushLead, type LeadSourceRow } from "@/lib/salesforce/leads";
import { drainCrmErasures } from "@/lib/salesforce/erasure-queue";
import type { Database } from "@/db/types";

/** Per invocation. Keeps the run inside the function timeout and inside any
 *  sane share of the org's daily API allocation. A backlog drains across
 *  runs; at a five-minute cadence that is 300 leads an hour. */
const BATCH_SIZE = 25;

/** After this many failures a row stops retrying and waits for a human.
 *  Five attempts spans roughly twelve hours of backoff — long enough to ride
 *  out an outage, short enough that a genuinely bad payload is not still
 *  being retried a week later. */
const MAX_ATTEMPTS = 5;

/** 1m, 5m, 25m, 2h, 10h. Index is the attempt number just completed. */
const BACKOFF_MINUTES = [1, 5, 25, 120, 600];

function backoffFrom(attempts: number): string {
  const minutes =
    BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)];
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

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

type QueueRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  brief_raw: string | null;
  source: Database["public"]["Enums"]["enquiry_source"];
  form_key: string | null;
  locale: string;
  crm_attempts: number;
  properties:
    | { reference: string; mode: Database["public"]["Enums"]["property_mode"] }
    | {
        reference: string;
        mode: Database["public"]["Enums"]["property_mode"];
      }[]
    | null;
};

function toLeadRow(row: QueueRow): LeadSourceRow {
  const property = Array.isArray(row.properties)
    ? (row.properties[0] ?? null)
    : row.properties;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    brief_raw: row.brief_raw,
    source: row.source,
    form_key: row.form_key,
    locale: row.locale,
    property_reference: property?.reference ?? null,
    property_mode: property?.mode ?? null,
  };
}

/**
 * Mirror the run onto the integrations row so
 * /admin/settings/integrations shows a last-synced time and the last error
 * without anyone opening Sentry. ADR-0003 names silent cron failure as the
 * known cost of Vercel Cron; this is the cheapest thing that answers "is it
 * running?" for an operator.
 */
async function recordIntegrationStatus(
  admin: ReturnType<typeof adminClient>,
  outcome: { ok: boolean; error?: string | null },
): Promise<void> {
  try {
    await admin.from("integrations").upsert(
      {
        kind: "salesforce",
        status: outcome.ok ? "connected" : "error",
        enabled: true,
        last_synced_at: new Date().toISOString(),
        last_error: outcome.error ?? null,
        last_error_at: outcome.error ? new Date().toISOString() : null,
      },
      { onConflict: "kind" },
    );
  } catch {
    // Status reporting must never be the thing that fails the run.
  }
}

export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, reason: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json(
      { ok: false, reason: "Unauthorized" },
      { status: 401 },
    );
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, pushed: 0, skipped: "no supabase" });
  }

  const admin = adminClient();

  // Erasures first, and above the Salesforce guard rather than below it.
  //
  // Two reasons. A subject who asked to be forgotten outranks a lead waiting
  // to be delivered, so if a run is going to be cut short by an API limit or
  // the function timeout, the work with a legal deadline should be the part
  // that got through. And the drain retires markers on rows that never
  // reached the CRM at all, which needs no credentials — leaving that below
  // the guard would let those rows accumulate for as long as Salesforce is
  // unconfigured, which is precisely today, and turn the "outstanding
  // erasures" triage query into a permanent false alarm.
  const erasures = await drainCrmErasures(admin);

  // The expected state on preview, on a local machine, and in production
  // until the client's credentials are in Vercel. Not an error: the queue
  // simply accumulates and drains on the first configured run.
  if (!isSalesforceConfigured) {
    return NextResponse.json({
      ok: true,
      pushed: 0,
      skipped: "no salesforce",
      erasures,
    });
  }

  let pushed = 0;
  let failed = 0;
  let exhausted = 0;
  let lastError: string | null = null;

  try {
    const { data, error } = await admin
      .from("enquiries")
      .select(
        "id, name, email, phone, brief_raw, source, form_key, locale, crm_attempts, properties:property_id(reference, mode)",
      )
      .eq("crm_sync_state", "pending")
      .lte("crm_next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;

    const rows = (data ?? []) as unknown as QueueRow[];

    for (const row of rows) {
      const attempts = row.crm_attempts + 1;
      const result = await pushLead(toLeadRow(row));

      if (result.ok) {
        await admin
          .from("enquiries")
          .update({
            crm_sync_state: "synced",
            crm_external_id: result.id,
            crm_synced_at: new Date().toISOString(),
            crm_attempts: attempts,
            crm_last_error: null,
          })
          .eq("id", row.id);
        pushed += 1;
        continue;
      }

      // A non-retryable error — a rejected picklist, a field that is too long,
      // a required field the doc never named — will fail identically forever.
      // Park it now so an operator sees the real reason rather than an
      // attempt counter, and so the org's API allocation is not spent
      // rediscovering it four more times.
      const giveUp = !result.retryable || attempts >= MAX_ATTEMPTS;
      const message = result.errorCode
        ? `${result.errorCode}: ${result.message}`
        : result.message;

      await admin
        .from("enquiries")
        .update({
          crm_sync_state: giveUp ? "failed" : "pending",
          crm_attempts: attempts,
          crm_last_error: message,
          crm_next_attempt_at: backoffFrom(attempts),
        })
        .eq("id", row.id);

      lastError = message;
      if (giveUp) {
        exhausted += 1;
        // A lead that will never reach the CRM is worth an alert on its own —
        // the enquiry is safe in Postgres, but the sales team works out of
        // Salesforce and would never know it existed.
        Sentry.captureMessage("Salesforce lead push gave up", {
          level: "error",
          tags: { cron: "salesforce-lead-sync" },
          contexts: {
            enquiry: { id: row.id, attempts, error: message },
          },
        });
      } else {
        failed += 1;
      }
    }

    // An outstanding erasure is the more serious of the two failure modes, so
    // it wins the single `last_error` slot the integrations card shows.
    const surfaced = erasures.lastError ?? lastError;
    await recordIntegrationStatus(admin, {
      ok: !surfaced,
      error: surfaced,
    });

    return NextResponse.json({
      ok: true,
      considered: rows.length,
      pushed,
      retrying: failed,
      exhausted,
      erasures,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: "salesforce-lead-sync" } });
    console.error("[cron/salesforce-lead-sync]", message);
    await recordIntegrationStatus(admin, { ok: false, error: message });
    return NextResponse.json({ ok: false, reason: message }, { status: 500 });
  }
}
