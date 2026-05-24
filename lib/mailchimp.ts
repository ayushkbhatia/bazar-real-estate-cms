/**
 * Sprint 13 — Mailchimp newsletter subscribe / unsubscribe.
 *
 * No first-party SDK is needed; Mailchimp's marketing API is REST +
 * Basic Auth using `any:<api_key>`. Falls back to no-op when env vars
 * are absent so the newsletter signup flow remains usable in dev
 * (subscribers land in the Bazar `newsletter_subscribers` table; cron
 * syncs them to Mailchimp once keys are wired).
 *
 * Datacenter discovery: the API key ends with `-us21` (or similar).
 * Set MAILCHIMP_DC explicitly so we don't have to parse the key.
 */

import { createHash } from "node:crypto";
import { env, isMailchimpConfigured } from "@/lib/env";

type MailchimpStatus = "subscribed" | "unsubscribed" | "pending" | "cleaned";

type SubscribeInput = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  tags?: string[];
  /** When true (default), uses 'pending' to send the double-opt-in email. */
  doubleOptIn?: boolean;
};

function apiBase(): string | null {
  if (!env.MAILCHIMP_DC) return null;
  return `https://${env.MAILCHIMP_DC}.api.mailchimp.com/3.0`;
}

function authHeader(): string | null {
  if (!env.MAILCHIMP_API_KEY) return null;
  // Mailchimp uses Basic Auth with username 'any' (literal).
  const b64 = Buffer.from(`any:${env.MAILCHIMP_API_KEY}`).toString("base64");
  return `Basic ${b64}`;
}

/** MD5 of the lower-cased email — Mailchimp uses this as the subscriber id. */
function subscriberHash(email: string): string {
  return createHash("md5").update(email.toLowerCase()).digest("hex");
}

/** Subscribe an email. Idempotent (PUT semantics). */
export async function subscribeToNewsletter(
  input: SubscribeInput,
): Promise<{ ok: boolean; reason?: string }> {
  if (!isMailchimpConfigured) {
    return { ok: false, reason: "Mailchimp not configured" };
  }
  const base = apiBase();
  const auth = authHeader();
  if (!base || !auth) return { ok: false, reason: "Missing env" };
  const url = `${base}/lists/${env.MAILCHIMP_LIST_ID}/members/${subscriberHash(
    input.email,
  )}`;
  const status: MailchimpStatus = input.doubleOptIn === false
    ? "subscribed"
    : "pending";
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({
        email_address: input.email,
        status_if_new: status,
        status,
        merge_fields: {
          FNAME: input.firstName ?? "",
          LNAME: input.lastName ?? "",
        },
        tags: input.tags ?? [],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: `${res.status} ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** Flip status to 'unsubscribed' (the Mailchimp-friendly term for
 *  opt-out without deleting the record). */
export async function unsubscribeFromNewsletter(
  email: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!isMailchimpConfigured)
    return { ok: false, reason: "Mailchimp not configured" };
  const base = apiBase();
  const auth = authHeader();
  if (!base || !auth) return { ok: false, reason: "Missing env" };
  const url = `${base}/lists/${env.MAILCHIMP_LIST_ID}/members/${subscriberHash(email)}`;
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({ status: "unsubscribed" }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: `${res.status} ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** Verify a Mailchimp webhook signature against the shared secret.
 *  Mailchimp doesn't sign webhooks; the convention is to authenticate
 *  via a secret in the webhook URL path. We mirror that — caller
 *  passes the `?secret=...` query param and we compare against env. */
export function verifyMailchimpWebhook(presented: string | null): boolean {
  if (!env.MAILCHIMP_WEBHOOK_SECRET || !presented) return false;
  return presented === env.MAILCHIMP_WEBHOOK_SECRET;
}
