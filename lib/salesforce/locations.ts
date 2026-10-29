import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/db/types";
import { isSalesforceConfigured } from "@/lib/env";
import { reportIssue } from "@/lib/observability";
import { salesforceApexRequest, SalesforceError } from "./client";

/**
 * Website areas to Salesforce — Levarus's "Website Locations Sync" API
 * (v1.0, 22 Oct 2026) and its "Website Locations Delete" addition (v1.0,
 * 25 Oct 2026).
 *
 * `Area__c` and `Sub_Area__c` on a Salesforce listing are restricted
 * picklists of the website's own area names, and the listing sync places a
 * listing by matching them (listings/plan.ts). An area added on the website
 * that the picklist lacks is an area no CRM user can file a listing under.
 * This keeps the picklists in step: an add is an UPSERT, a rename a REPLACE,
 * a delete a DELETE — which Salesforce deactivates rather than erases, so an
 * UPSERT of the same name brings it back.
 *
 * Migration 0169's trigger (0172 for deletes) on `areas` writes the events, with the payload
 * fixed at the moment of the change; this file only sends them. Both callers
 * — the area actions straight after a save, and the lead-sync cron for
 * anything that failed — drain the same queue, in order.
 */

export const LOCATIONS_PATH = "properties/website-locations";

/** Per run. Areas change a few times a month; this is a backstop. */
const BATCH_SIZE = 25;

/** As the lead sync: five attempts over roughly twelve hours. */
const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = [1, 5, 25, 120, 600];

/** While one sender has a row in flight, the other leaves it alone. */
const CLAIM_MINUTES = 2;

/**
 * What the trigger stores. A `DELETE` with `subAreas` retires only those
 * sub-areas; without, the area and the sub-areas under it (0172).
 */
export type LocationEventPayload = {
  action: "UPSERT" | "REPLACE" | "DELETE";
  emirate: string | null;
  area: string | null;
  newArea?: string | null;
  subAreas?: string[];
};

/** The request body the API documents. */
export type LocationRequest = {
  action: "UPSERT" | "REPLACE" | "DELETE";
  eventId: string;
  emirate: string;
  area: string;
  newArea?: string;
  subAreas?: string[];
};

/** Our reference for one event, which the API logs as `eventId`. */
export function locationEventId(id: string): string {
  return `WEB-AREA-${id}`;
}

/**
 * The body for one event, or why it cannot be sent. Pure.
 *
 * `emirate` and `area` are required by the API, a DELETE's included: a
 * sub-area is retired from the area named. They are null only when the
 * website's own tree is incomplete — an area with no emirate above it, a
 * sub-area not under an area — and sending would be refused, so the event
 * fails here with the reason instead.
 */
export function buildLocationRequest(
  id: string,
  payload: LocationEventPayload,
): { ok: true; body: LocationRequest } | { ok: false; reason: string } {
  const emirate = payload.emirate?.trim();
  const area = payload.area?.trim();
  if (!emirate) {
    return { ok: false, reason: "The area is not under an emirate on the website, and Salesforce needs one." };
  }
  if (!area) {
    return { ok: false, reason: "The sub-area is not under an area on the website, and Salesforce needs one." };
  }

  const body: LocationRequest = {
    action: payload.action,
    eventId: locationEventId(id),
    emirate,
    area,
  };
  if (payload.action === "REPLACE") {
    const newArea = payload.newArea?.trim();
    if (!newArea) return { ok: false, reason: "A rename with no new name." };
    body.newArea = newArea;
  }
  const subAreas = (payload.subAreas ?? []).map((s) => s.trim()).filter(Boolean);
  if (subAreas.length > 0) body.subAreas = subAreas;
  return { ok: true, body };
}

export type LocationPushResult =
  | { ok: true; response: unknown }
  | { ok: false; retryable: boolean; message: string };

/**
 * One POST. The delete document gives the body — `{ status: "ok", action,
 * area: { result }, subAreas?: [{ result }] }` — and the sync document none,
 * so a 2xx carrying any other `status`, or `success: false`, is read as a
 * refusal rather than trusted. A DELETE whose result is `not_found` is a
 * success: Salesforce no longer lists the value, which is what was asked.
 * The body is kept on the row either way.
 */
export async function pushLocation(body: LocationRequest): Promise<LocationPushResult> {
  try {
    const res = await salesforceApexRequest<unknown>(LOCATIONS_PATH, { method: "POST", body });
    if (res && typeof res === "object" && !Array.isArray(res)) {
      const rec = res as Record<string, unknown>;
      const status = typeof rec.status === "string" ? rec.status.toLowerCase() : null;
      if (rec.success === false || (status && status !== "ok" && status !== "success")) {
        const message = typeof rec.message === "string" ? rec.message : JSON.stringify(res).slice(0, 300);
        return { ok: false, retryable: false, message };
      }
    }
    return { ok: true, response: res };
  } catch (err) {
    if (err instanceof SalesforceError) {
      return {
        ok: false,
        retryable: err.retryable,
        message: err.errorCode ? `${err.errorCode}: ${err.message}` : err.message,
      };
    }
    return { ok: false, retryable: true, message: err instanceof Error ? err.message : String(err) };
  }
}

export type LocationDrainResult = {
  sent: number;
  failed: number;
  /** Waiting for a retry; the queue stops behind it so order holds. */
  waiting: number;
  lastError: string | null;
};

type QueueRow = {
  id: string;
  payload: LocationEventPayload;
  attempts: number;
  next_attempt_at: string;
};

function minutesFromNow(minutes: number, now: number): string {
  return new Date(now + minutes * 60_000).toISOString();
}

/**
 * Send what is pending, oldest first, and stop at the first event that has to
 * wait: an add that has not landed must not be overtaken by its rename.
 *
 * Each event is claimed before it is sent — `attempts` moves on and its
 * next attempt is pushed out — with the old `attempts` as the condition, so
 * the action's drain and the cron's never send the same event twice. An
 * event that cannot succeed (a refused value, an incomplete tree) is failed
 * and reported, and the queue moves past it.
 */
export async function drainLocationEvents(
  admin: SupabaseClient<Database>,
  opts: { now?: () => number } = {},
): Promise<LocationDrainResult> {
  const now = opts.now ?? Date.now;
  const result: LocationDrainResult = { sent: 0, failed: 0, waiting: 0, lastError: null };
  if (!isSalesforceConfigured) return result;

  const { data, error } = await admin
    .from("salesforce_location_events")
    .select("id, payload, attempts, next_attempt_at")
    .eq("state", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) throw error;

  for (const row of (data ?? []) as unknown as QueueRow[]) {
    if (Date.parse(row.next_attempt_at) > now()) {
      result.waiting += 1;
      break;
    }

    const attempts = row.attempts + 1;
    const { data: claimed } = await admin
      .from("salesforce_location_events")
      .update({ attempts, next_attempt_at: minutesFromNow(CLAIM_MINUTES, now()) })
      .eq("id", row.id)
      .eq("state", "pending")
      .eq("attempts", row.attempts)
      .select("id");
    // The other sender has it. Whatever follows it waits too.
    if (!claimed || claimed.length === 0) break;

    const built = buildLocationRequest(row.id, row.payload);
    const outcome: LocationPushResult = built.ok
      ? await pushLocation(built.body)
      : { ok: false, retryable: false, message: built.reason };

    if (outcome.ok) {
      await admin
        .from("salesforce_location_events")
        .update({
          state: "sent",
          sent_at: new Date(now()).toISOString(),
          last_error: null,
          response: (outcome.response ?? null) as Json,
        })
        .eq("id", row.id);
      result.sent += 1;
      continue;
    }

    result.lastError = outcome.message;
    const giveUp = !outcome.retryable || attempts >= MAX_ATTEMPTS;
    const backoff = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
    await admin
      .from("salesforce_location_events")
      .update({
        state: giveUp ? "failed" : "pending",
        last_error: outcome.message,
        next_attempt_at: minutesFromNow(backoff, now()),
      })
      .eq("id", row.id);

    if (!giveUp) {
      result.waiting += 1;
      break;
    }
    result.failed += 1;
    // Area names are the site's own public data; nothing personal here.
    await reportIssue("Salesforce area sync gave up", {
      source: "salesforce/locations",
      context: { event: { id: row.id, attempts, error: outcome.message, ...row.payload } },
    });
  }

  return result;
}
