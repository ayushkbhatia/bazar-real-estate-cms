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
  /**
   * The domain the message was sent from, lower-cased (`data.from`), or null
   * when the payload carries no readable From. See `isOwnSender`.
   */
  senderDomain: string | null;
};

/**
 * The domains this site sends from. Resend's webhooks belong to the ACCOUNT,
 * not to a domain, and the account Bazar sends through also sends for other
 * sites (Indus Hydraulics, since 2026-11-09 a newsletter of its own on
 * news.indushydraulics.com), so this endpoint receives their delivered,
 * bounced and complained events too. A permanent bounce is acted on by
 * address — it marks a matching subscriber bounced and suppresses the
 * address — so another site's bounce must never reach the database.
 *
 * bazarrealestate.com is the domain verified in Resend today: the env's
 * transactional sender and the newsletter's From (`newsletter_settings`) are
 * both on it, and the newsletter settings only accept a verified domain.
 * bazarrealestate.ae is the site's own domain, listed so that verifying it
 * later doesn't silently drop its bounces. Subdomains of either match.
 * The route also accepts the domain of `RESEND_FROM_ADDRESS`, so a handover
 * that moves the sender to a new domain keeps working (`ownSenderDomains`).
 */
export const SENDER_DOMAINS: readonly string[] = [
  "bazarrealestate.com",
  "bazarrealestate.ae",
];

/**
 * `Name <a@x.com>` or `a@x.com` → `x.com`, lower-cased; null for anything
 * without an address in it.
 */
export function senderDomainOf(from: unknown): string | null {
  if (typeof from !== "string") return null;
  const bracketed = from.match(/<([^>]*)>\s*$/);
  const address = (bracketed ? bracketed[1] : from).trim();
  const at = address.lastIndexOf("@");
  if (at < 0) return null;
  const domain = address.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

/** `SENDER_DOMAINS` plus the domain of the configured From, if it adds one. */
export function ownSenderDomains(fromAddress?: string | null): string[] {
  const domains = [...SENDER_DOMAINS];
  const extra = senderDomainOf(fromAddress);
  if (extra && !domains.includes(extra)) domains.push(extra);
  return domains;
}

/**
 * Whether an event's message was sent by this site: its From domain is one
 * of `siteDomains` or a subdomain of one (`news.example.com` matches
 * `example.com`; `evilexample.com` does not).
 *
 * A null From counts as ours. Resend always sends one, so a missing From is
 * a malformed payload, and dropping a real hard bounce (and mailing a dead
 * address again) costs more than acting on it.
 */
export function isOwnSender(
  senderDomain: string | null,
  siteDomains: string | readonly string[],
): boolean {
  if (senderDomain === null) return true;
  const domain = senderDomain.toLowerCase();
  const sites = typeof siteDomains === "string" ? [siteDomains] : siteDomains;
  return sites.some((site) => {
    const s = site.toLowerCase();
    return s !== "" && (domain === s || domain.endsWith(`.${s}`));
  });
}

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
      from?: unknown;
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
    senderDomain: senderDomainOf(data.from),
  };
}
