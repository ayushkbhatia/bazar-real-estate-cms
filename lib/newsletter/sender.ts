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
