/**
 * What a set of sends adds up to (docs/mortgage/SECURITY-REVIEW.md SR-25): a
 * bank with two package inboxes was reached when both were, not when one was,
 * and a send that was skipped — email switched off, as it is locally and on a
 * dry run — reached no one, so it can't read as sent.
 */

export type SendStatus = "sent" | "skipped" | "failed";

/**
 * - `sent`: every inbox got it.
 * - `partial`: some did, some didn't.
 * - `skipped`: none did, because email is switched off.
 * - `failed`: none did, and at least one send failed (or there was nowhere to send).
 */
export type SendOutcome = "sent" | "partial" | "skipped" | "failed";

export function sendOutcome(statuses: readonly SendStatus[]): SendOutcome {
  if (statuses.length === 0) return "failed";
  if (statuses.every((s) => s === "sent")) return "sent";
  if (statuses.some((s) => s === "sent")) return "partial";
  if (statuses.every((s) => s === "skipped")) return "skipped";
  return "failed";
}
