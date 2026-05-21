/**
 * WhatsApp deep-link helpers.
 *
 * The wa.me URL scheme is `https://wa.me/<international-number>` with an
 * optional `?text=<url-encoded message>`. The number must be digits only
 * (no `+`, no spaces, no parentheses). Browsers and the WhatsApp app are
 * both case-insensitive on the URL, so the encoding is the only thing
 * that needs to be precise.
 *
 * Two env vars expose the official Bazar numbers:
 *   · NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER  — general advisor handoff
 *   · NEXT_PUBLIC_WHATSAPP_MORTGAGE_NUMBER — pre-approval queue
 *
 * Both default to a UAE placeholder until real numbers land via Vercel
 * env. Production deploys should override.
 */

import { env } from "@/lib/env";

const PLACEHOLDER_NUMBER = "+971501234567";

/** Strip everything that isn't a digit. wa.me wants no `+`. */
function normaliseNumber(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).replace(/\D+/g, "");
}

/**
 * Build a wa.me URL for a given number, optionally prefilling a message.
 *
 * Returns `null` (not the empty string and not "wa.me/") when the input
 * isn't usable — callers should branch on that to fall back to /contact
 * or a tel: link.
 */
export function buildWhatsAppLink(
  number: string | null | undefined,
  message?: string | null,
): string | null {
  const digits = normaliseNumber(number);
  // WhatsApp's own validation: minimum 7 digits, max 15 (E.164).
  if (digits.length < 7 || digits.length > 15) return null;
  const base = `https://wa.me/${digits}`;
  if (!message || message.trim() === "") return base;
  // encodeURIComponent handles emoji, line breaks (LF → %0A), and
  // every reserved char correctly. wa.me prefills the chat composer
  // verbatim from the decoded `text` parameter.
  return `${base}?text=${encodeURIComponent(message)}`;
}

/** The advisor number from env, falling back to the placeholder. */
export function getAdvisorWhatsAppNumber(): string {
  return env.NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER || PLACEHOLDER_NUMBER;
}

/** The mortgage-team number from env, falling back to the placeholder. */
export function getMortgageWhatsAppNumber(): string {
  return env.NEXT_PUBLIC_WHATSAPP_MORTGAGE_NUMBER || PLACEHOLDER_NUMBER;
}

/** Convenience: advisor link + optional message. Null if both env + arg empty. */
export function buildAdvisorWhatsAppLink(message?: string | null): string | null {
  return buildWhatsAppLink(getAdvisorWhatsAppNumber(), message);
}

/** Convenience: mortgage link + optional message. Null if both env + arg empty. */
export function buildMortgageWhatsAppLink(
  message?: string | null,
): string | null {
  return buildWhatsAppLink(getMortgageWhatsAppNumber(), message);
}
