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

/** Shape of the JSON archive returned by /account/data-export. */
export type DataExportPayload = {
  generated_at: string;
  account: Record<string, unknown> | null;
  saved_properties: Array<Record<string, unknown>>;
  saved_searches: Array<Record<string, unknown>>;
  enquiries: Array<Record<string, unknown>>;
  viewings: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  newsletter_subscription: Record<string, unknown> | null;
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
  viewings?: Array<Record<string, unknown>>;
  messages?: Array<Record<string, unknown>>;
  newsletter_subscription?: Record<string, unknown> | null;
  now?: () => Date;
}): DataExportPayload {
  const now = (input.now ?? (() => new Date()))().toISOString();

  return {
    generated_at: now,
    account: input.account,
    saved_properties: input.saved_properties ?? [],
    saved_searches: input.saved_searches ?? [],
    enquiries: input.enquiries ?? [],
    viewings: input.viewings ?? [],
    messages: input.messages ?? [],
    newsletter_subscription: input.newsletter_subscription ?? null,
    notes: [
      "This archive contains every personal-data field Bazar holds about your account at the moment of generation.",
      "KYC documents tied to closed transactions are retained for 7 years under UAE AML rules and are excluded from this export.",
      "Audit-log rows are also excluded — they are non-PII and required for compliance.",
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
