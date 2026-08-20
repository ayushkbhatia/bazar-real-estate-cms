import { z } from "zod";

export const NEWSLETTER_SOURCES = [
  "insights_header",
  "insights_article",
  "homepage",
  "account",
  "footer",
] as const;

export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];

export const newsletterSignupSchema = z.object({
  email: z.string().email("Enter a valid email").max(254),
  source: z.enum(NEWSLETTER_SOURCES).default("insights_header"),
  /**
   * The locale the visitor subscribed in. Same contract as `enquirySchema`:
   * constrained, because the column carries a check from migration 0100, and
   * defaulted rather than rejected so a bad value costs the attribution and
   * not the subscriber.
   */
  locale: z.enum(["en", "ar"]).default("en"),
});

export type NewsletterSignupInput = z.infer<typeof newsletterSignupSchema>;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A URL-safe random token. */
export function generateConfirmationToken(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
