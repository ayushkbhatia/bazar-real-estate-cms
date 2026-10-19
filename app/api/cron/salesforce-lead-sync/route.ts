/**
 * Salesforce lead sync — drains the enquiry and mortgage-request queues into
 * `Lead__c`.
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
import { recordHeartbeat, reportError, reportIssue } from "@/lib/observability";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured, isSalesforceConfigured } from "@/lib/env";
import {
  leadPageUrl,
  pushLead,
  LOCAL_BLOCK_PREFIX,
  type LeadSourceRow,
} from "@/lib/salesforce/leads";
import { drainCrmErasures, drainLeadErasureQueue } from "@/lib/salesforce/erasure-queue";
import {
  isSampleMortgageRequest,
  pushMortgageLead,
  type MortgageLeadRow,
} from "@/lib/salesforce/mortgage-leads";
import type { PushResult } from "@/lib/salesforce/leads";
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
  inferred_constraints: { intent?: string | null } | null;
  crm_attempts: number;
  properties: QueueProperty | QueueProperty[] | null;
  developments: { name: string; slug: string } | { name: string; slug: string }[] | null;
  form_submissions: { source_path: string | null }[] | null;
};

type QueueProperty = {
  reference: string;
  slug: string;
  mode: Database["public"]["Enums"]["property_mode"];
  salesforce_listings:
    | { sf_listing_name: string | null }
    | { sf_listing_name: string | null }[]
    | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

function toLeadRow(row: QueueRow): LeadSourceRow {
  const property = one(row.properties);
  // A listing published from Salesforce is known there by its own name.
  // Sending our BAZ- reference would give the CRM team a number that exists
  // nowhere in their system.
  const crmName = one(property?.salesforce_listings)?.sf_listing_name ?? null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    brief_raw: row.brief_raw,
    source: row.source,
    form_key: row.form_key,
    locale: row.locale,
    intent: row.inferred_constraints?.intent ?? null,
    property_reference: crmName ?? property?.reference ?? null,
    property_mode: property?.mode ?? null,
    website_reference: crmName ? (property?.reference ?? null) : null,
    page_url: leadPageUrl(
      (row.form_submissions ?? []).map((s) => s.source_path),
      env.NEXT_PUBLIC_SITE_URL,
    ),
    project_name: one(row.developments)?.name ?? null,
    project_slug: one(row.developments)?.slug ?? null,
    property_slug: property?.slug ?? null,
  };
}

type MortgageQueueRow = {
  id: string;
  reference: string;
  service: MortgageLeadRow["service"];
  full_name: string;
  email: string;
  mobile_e164: string;
  residency: MortgageLeadRow["residency"];
  employment_type: MortgageLeadRow["employment_type"];
  property_price_aed: number | null;
  entry_point: MortgageLeadRow["entry_point"];
  locale: string;
  crm_attempts: number;
  properties: QueueMortgageProperty | QueueMortgageProperty[] | null;
  parent: { reference: string } | { reference: string }[] | null;
};

type QueueMortgageProperty = {
  reference: string;
  slug: string;
  salesforce_listings:
    | { sf_listing_name: string | null }
    | { sf_listing_name: string | null }[]
    | null;
};

function toMortgageLeadRow(row: MortgageQueueRow): MortgageLeadRow {
  const property = one(row.properties);
  const crmName = one(property?.salesforce_listings)?.sf_listing_name ?? null;
  return {
    id: row.id,
    reference: row.reference,
    service: row.service,
    full_name: row.full_name,
    email: row.email,
    mobile_e164: row.mobile_e164,
    residency: row.residency,
    employment_type: row.employment_type,
    property_price_aed: row.property_price_aed,
    entry_point: row.entry_point,
    property_reference: crmName ?? property?.reference ?? null,
    property_slug: property?.slug ?? null,
    parent_reference: one(row.parent)?.reference ?? null,
    locale: row.locale,
  };
}

type QueueTable = "enquiries" | "mortgage_requests";

type Tally = {
  pushed: number;
  failed: number;
  exhausted: number;
  blocked: number;
  lastError: string | null;
};

/**
 * Write one push's outcome back onto its row. Both queues carry the same six
 * `crm_*` columns (0130, 0160), so one settle serves both.
 */
async function settle(
  admin: ReturnType<typeof adminClient>,
  table: QueueTable,
  id: string,
  attempts: number,
  result: PushResult,
  tally: Tally,
): Promise<void> {
  // Typed through one table: the columns written are identical on both.
  const from = () => admin.from(table as "enquiries");

  if (result.ok) {
    const { data } = await from()
      .update({
        crm_sync_state: "synced",
        crm_external_id: result.id,
        crm_synced_at: new Date().toISOString(),
        crm_attempts: attempts,
        crm_last_error: null,
      })
      .eq("id", id)
      .select("id");
    // Deleted while the push was in flight — a mortgage request erased
    // between this run's select and Salesforce's answer. The record now
    // exists for a subject who asked to be forgotten; queue it for the scrub
    // the delete would have queued.
    if (table === "mortgage_requests" && (data ?? []).length === 0) {
      await admin
        .from("salesforce_lead_erasures")
        .upsert({ sf_record_id: result.id, source: "mortgage_request" }, { onConflict: "sf_record_id", ignoreDuplicates: true });
    }
    tally.pushed += 1;
    return;
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

  await from()
    .update({
      crm_sync_state: giveUp ? "failed" : "pending",
      crm_attempts: attempts,
      crm_last_error: message,
      crm_next_attempt_at: backoffFrom(attempts),
    })
    .eq("id", id);

  // A lead we refused to send says nothing about whether Salesforce is
  // reachable, and letting it set `last_error` would leave the
  // integrations card permanently red while the org is perfectly
  // healthy — a third of this site's leads have no phone number. Counted
  // on its own instead.
  const isLocalBlock = message.startsWith(LOCAL_BLOCK_PREFIX);
  if (isLocalBlock) tally.blocked += 1;
  else tally.lastError = message;

  if (giveUp) {
    tally.exhausted += 1;
    // A lead that will never reach the CRM is worth an alert on its own —
    // the row is safe in Postgres, but the sales team works out of
    // Salesforce and would never know it existed.
    await reportIssue("Salesforce lead push gave up", {
      source: "cron/salesforce-lead-sync",
      context: {
        [table === "enquiries" ? "enquiry" : "mortgage_request"]: { id, attempts, error: message },
      },
    });
  } else {
    tally.failed += 1;
  }
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
  // Records whose row is already gone (mortgage requests, 0160).
  const queued = await drainLeadErasureQueue(admin);
  erasures.scrubbed += queued.scrubbed;
  erasures.remaining += queued.remaining;
  erasures.cleared += queued.cleared;
  erasures.reInquiries.push(...queued.reInquiries);
  erasures.lastError = erasures.lastError ?? queued.lastError;

  // The expected state on preview, on a local machine, and in production
  // until the client's credentials are in Vercel. Not an error: the queue
  // simply accumulates and drains on the first configured run.
  if (!isSalesforceConfigured) {
    // Stamped, not skipped. This is the expected state until the client's
    // credentials reach Vercel, and a job that never stamps is
    // indistinguishable on the health page from a job that has died.
    await recordHeartbeat("salesforce-lead-sync", {
      ok: true,
      detail: "idle — no Salesforce credentials",
    });
    return NextResponse.json({
      ok: true,
      pushed: 0,
      skipped: "no salesforce",
      erasures,
    });
  }

  const tally: Tally = { pushed: 0, failed: 0, exhausted: 0, blocked: 0, lastError: null };
  let skippedSamples = 0;

  try {
    const { data, error } = await admin
      .from("enquiries")
      .select(
        "id, name, email, phone, brief_raw, source, form_key, locale, inferred_constraints, crm_attempts, properties:property_id(reference, slug, mode, salesforce_listings(sf_listing_name)), developments:development_id(name, slug), form_submissions(source_path)",
      )
      .eq("crm_sync_state", "pending")
      .lte("crm_next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;

    const rows = (data ?? []) as unknown as QueueRow[];

    for (const row of rows) {
      const attempts = row.crm_attempts + 1;
      const result = await pushLead(toLeadRow(row), env.NEXT_PUBLIC_SITE_URL);
      await settle(admin, "enquiries", row.id, attempts, result, tally);
    }

    // Mortgage requests (0160), the same way. Oldest first, own batch.
    const { data: mortgageData, error: mortgageError } = await admin
      .from("mortgage_requests")
      .select(
        "id, reference, service, full_name, email, mobile_e164, residency, employment_type, property_price_aed, entry_point, locale, crm_attempts, properties:property_id(reference, slug, salesforce_listings(sf_listing_name)), parent:parent_request_id(reference)",
      )
      .eq("crm_sync_state", "pending")
      .lte("crm_next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (mortgageError) throw mortgageError;

    const mortgageRows = (mortgageData ?? []) as unknown as MortgageQueueRow[];
    for (const row of mortgageRows) {
      if (isSampleMortgageRequest(row.email)) {
        await admin.from("mortgage_requests").update({ crm_sync_state: "skipped" }).eq("id", row.id);
        skippedSamples += 1;
        continue;
      }
      const attempts = row.crm_attempts + 1;
      const result = await pushMortgageLead(toMortgageLeadRow(row), env.NEXT_PUBLIC_SITE_URL);
      await settle(admin, "mortgage_requests", row.id, attempts, result, tally);
    }

    // An outstanding erasure is the more serious of the two failure modes, so
    // it wins the single `last_error` slot the integrations card shows.
    const surfaced = erasures.lastError ?? tally.lastError;
    await recordIntegrationStatus(admin, {
      ok: !surfaced,
      error: surfaced,
    });

    await recordHeartbeat("salesforce-lead-sync", {
      ok: true,
      detail: `pushed ${tally.pushed}, blocked ${tally.blocked}, erasures ${erasures.scrubbed}`,
    });
    return NextResponse.json({
      ok: true,
      considered: rows.length + mortgageRows.length,
      pushed: tally.pushed,
      retrying: tally.failed,
      exhausted: tally.exhausted,
      blocked: tally.blocked,
      skippedSamples,
      erasures,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await reportError(err, { source: "cron/salesforce-lead-sync" });
    await recordHeartbeat("salesforce-lead-sync", {
      ok: false,
      detail: message,
    });
    console.error("[cron/salesforce-lead-sync]", message);
    await recordIntegrationStatus(admin, { ok: false, error: message });
    return NextResponse.json({ ok: false, reason: message }, { status: 500 });
  }
}
