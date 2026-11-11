/**
 * Who a newsletter comes from and where its replies go.
 *
 * The newsletter's own From and Reply-To, stored in `newsletter_settings`
 * (0174) and edited at /admin/newsletter/settings. Every other email the site
 * sends keeps the env's (`RESEND_FROM_ADDRESS`, `RESEND_REPLY_TO`): a password
 * link should not arrive from marketing. A blank column falls back to the env,
 * so an environment without the row sends as it always did.
 *
 * Pure module — the settings form imports the schema on the client.
 */

import { z } from "zod";

export type NewsletterSenderSettings = {
  from_name: string;
  from_address: string;
  reply_to: string;
};

/** What a send carries: a ready From header and a Reply-To. */
export type NewsletterSender = { from: string; replyTo: string };

const address = z.string().trim().toLowerCase().email("Enter an email address, like marketing@bazarrealestate.com.");

export const senderSettingsSchema = z.object({
  from_name: z
    .string()
    .trim()
    .max(80, "Keep the name under 80 characters.")
    .refine((v) => !/[<>"\r\n]/.test(v), "The name can't contain quotes, angle brackets or line breaks."),
  from_address: address,
  reply_to: address,
});

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
 *
 * The newsletter's From is held to the same list (/admin/newsletter/settings):
 * the account has other sites' domains verified too, and a newsletter sent
 * from one of them would have every bounce ignored by the webhook.
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

/**
 * The account's verified domains this site may send from: Resend's list,
 * less every other site's domain on the same account.
 */
export function ownVerifiedDomains(
  verified: readonly string[],
  fromAddress?: string | null,
): string[] {
  const own = ownSenderDomains(fromAddress);
  return verified.filter((d) => isOwnSender(d, own));
}

/** The domain an address sends from: `marketing@bazarrealestate.com` → `bazarrealestate.com`. */
export function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).trim().toLowerCase();
}

/**
 * `Marketing at Bazar Real Estate <marketing@…>`. The name is quoted when it
 * holds a character RFC 5322 reserves (a comma would otherwise split it into
 * two addresses); a plain name goes as it is, which is how most senders look.
 */
export function formatFrom(name: string, email: string): string {
  const n = name.trim();
  if (!n) return email;
  return /[(),.:;@[\]\\]/.test(n) ? `"${n}" <${email}>` : `${n} <${email}>`;
}

/** The stored row over the env's sender, field by field. */
export function resolveNewsletterSender(
  row: Partial<NewsletterSenderSettings> | null | undefined,
  fallback: NewsletterSender,
): NewsletterSender {
  const fromAddress = row?.from_address?.trim();
  const from = fromAddress ? formatFrom(row?.from_name ?? "", fromAddress) : fallback.from;
  return { from, replyTo: row?.reply_to?.trim() || fallback.replyTo };
}
