/**
 * Pure helpers for the PDPL data-subject-rights flows.
 *
 * Real DB / Resend wiring lives in the data-export / data-deletion server
 * actions. This file is intentionally side-effect-free so it can be
 * unit-tested without a Supabase client.
 */

import type { Database } from "@/db/types";

export type DsrKind = Database["public"]["Enums"]["dsr_kind"];
export type DsrStatus = Database["public"]["Enums"]["dsr_status"];

/** Confirmation links expire after 24h. PDPL allows up to 30 days for a
 *  request, but the confirmation step is supposed to be a quick "yes that
 *  was me" so a short TTL minimises token-theft risk. */
export const DSR_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** 32-byte hex token. ~256 bits of entropy. */
export function generateDsrToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** True if a pending request created at `createdAt` is no longer confirmable. */
export function isTokenExpired(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() > DSR_TOKEN_TTL_MS;
}

/** Shape of the JSON archive built for a data-subject access request. */
export type DataExportPayload = {
  generated_at: string;
  account: Record<string, unknown> | null;
  saved_properties: Array<Record<string, unknown>>;
  saved_searches: Array<Record<string, unknown>>;
  enquiries: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  newsletter_subscription: Record<string, unknown> | null;
  /** Fast Pre-Approval and Mortgage Consultancy requests (docs/mortgage). */
  mortgage_requests: Array<Record<string, unknown>>;
  notes: string[];
};

/**
 * Assemble the archive from already-fetched arrays. Keeping it pure means
 * the unit tests can pass fixtures without needing a live Supabase client.
 */
export function buildDataExport(input: {
  account: Record<string, unknown> | null;
  saved_properties?: Array<Record<string, unknown>>;
  saved_searches?: Array<Record<string, unknown>>;
  enquiries?: Array<Record<string, unknown>>;
  messages?: Array<Record<string, unknown>>;
  newsletter_subscription?: Record<string, unknown> | null;
  /**
   * True when at least one of this subject's enquiries actually reached the
   * client's Salesforce org (migration 0130). An access request has to name
   * the recipients data was disclosed to, and naming a processor that in
   * practice received nothing would be its own inaccuracy — so this is
   * derived from the rows rather than asserted because the integration
   * exists.
   */
  shared_with_crm?: boolean;
  mortgage_requests?: Array<Record<string, unknown>>;
  now?: () => Date;
}): DataExportPayload {
  const now = (input.now ?? (() => new Date()))().toISOString();

  return {
    generated_at: now,
    account: input.account,
    saved_properties: input.saved_properties ?? [],
    saved_searches: input.saved_searches ?? [],
    enquiries: input.enquiries ?? [],
    messages: input.messages ?? [],
    newsletter_subscription: input.newsletter_subscription ?? null,
    mortgage_requests: input.mortgage_requests ?? [],
    notes: [
      "This archive contains every personal-data field Bazar holds about your account at the moment of generation.",
      "The `messages` section includes the full conversation thread with your advisor — `author_kind` identifies whether each message was sent by you (`user`), Bazar (`agent`), or the system (`system`). Advisor replies are included so you have the context of your conversation; if you only want your own messages, filter by `author_kind === 'user'`.",
      "KYC documents tied to closed transactions are retained for 7 years under UAE AML rules and are excluded from this export. Email dpo@bazar.ae to request a separate review of those.",
      "Audit-log rows are required for AML/CFT compliance and excluded from this export; on a deletion request we wipe inline IP and user-agent fields rather than dropping the rows.",
      ...(input.mortgage_requests?.length
        ? [
            "The `mortgage_requests` section lists your Fast Pre-Approval and Mortgage Consultancy requests: your details, consents, each document's status and what was recorded from it, and its files by name and size. The documents themselves aren't in this archive; ask for copies at the address below.",
            ...(input.mortgage_requests.some((r) => Array.isArray(r.shared_with_banks) && r.shared_with_banks.length > 0)
              ? [
                  "With your consent, a request was shared with the partner banks listed under `shared_with_banks` in it. Those banks hold their own copies, which Bazar can't recall or erase; contact them directly, or ask us to.",
                ]
              : []),
          ]
        : []),
      ...(input.shared_with_crm
        ? [
            "Your enquiry was also passed to Salesforce, the customer-relationship platform Bazar uses to manage advisory work, as described in section 4 of our privacy notice. A copy of your name, contact details and enquiry message is held there. It is covered by the same erasure request as everything above.",
          ]
        : []),
      "Questions or corrections: dpo@bazar.ae",
    ],
  };
}

/** Build a Content-Disposition filename like `bazar-data-export-2026-05-22.json`. */
export function exportFilename(date: Date = new Date()): string {
  const iso = date.toISOString().slice(0, 10);
  return `bazar-data-export-${iso}.json`;
}

/** Best-effort byte size of the JSON encoded archive — used for the
 *  dsr_requests.payload audit record. Returns an integer. */
export function approxJsonByteSize(value: unknown): number {
  const json = JSON.stringify(value);
  return new TextEncoder().encode(json).byteLength;
}
