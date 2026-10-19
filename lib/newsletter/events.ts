import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend's delivery events, as its webhook reports them (docs/NEWSLETTER.md,
 * "Delivery events"): verifying the signature, and reducing the payload to
 * the four things `newsletter_record_email_event()` (0164) needs.
 *
 * Kept free of `server-only` and of the database so the spec can drive both
 * halves directly; the route does the I/O.
 */

/**
 * How far a signed timestamp may sit from our clock. Resend signs with Svix,
 * whose own libraries allow five minutes either way; past that, a captured
 * request replayed later is refused.
 */
export const SIGNATURE_TOLERANCE_S = 5 * 60;

export type SignatureHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

/**
 * Check a Svix signature: HMAC-SHA256 over `${id}.${timestamp}.${body}`,
 * keyed by the base64 part of the `whsec_…` secret, compared against each
 * `v1,<base64>` entry in the signature header (there are several while a
 * secret is being rotated). Written out rather than pulled from `svix`, which
 * is only a transitive dependency here, and a dozen lines of crypto are easier
 * to read than to pin.
 */
export function verifyResendSignature(
  body: string,
  headers: SignatureHeaders,
  secret: string,
  now: Date = new Date(),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !secret) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) return false;
  if (Math.abs(now.getTime() / 1000 - sentAt) > SIGNATURE_TOLERANCE_S) {
    return false;
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest();

  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export type EmailEvent = {
  type: "delivered" | "bounced" | "complained";
  /** The id Resend returned when the message was sent (`resend_id`). */
  emailId: string;
  recipients: string[];
  /** Bounces only: Resend's `bounce.type` was "Permanent". */
  permanent: boolean;
  at: string;
};

const HANDLED = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
} as const;

/**
 * The event, or null for anything this does not act on — another event type
 * (the webhook may be subscribed to more than these three), or a payload
 * missing the message id. Null is answered 200: retrying it would not help.
 */
export function parseEmailEvent(payload: unknown): EmailEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const { type, created_at, data } = payload as {
    type?: unknown;
    created_at?: unknown;
    data?: {
      email_id?: unknown;
      to?: unknown;
      created_at?: unknown;
      bounce?: { type?: unknown };
    };
  };
  if (typeof type !== "string" || !(type in HANDLED)) return null;
  if (!data || typeof data.email_id !== "string" || !data.email_id) {
    return null;
  }

  const recipients = Array.isArray(data.to)
    ? data.to.filter((r): r is string => typeof r === "string")
    : [];
  const stamp = typeof created_at === "string" ? created_at : null;
  const at =
    stamp && !Number.isNaN(Date.parse(stamp))
      ? stamp
      : new Date().toISOString();

  return {
    type: HANDLED[type as keyof typeof HANDLED],
    emailId: data.email_id,
    recipients,
    permanent:
      typeof data.bounce?.type === "string" &&
      data.bounce.type.toLowerCase() === "permanent",
    at,
  };
}
