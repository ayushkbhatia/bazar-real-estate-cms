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
