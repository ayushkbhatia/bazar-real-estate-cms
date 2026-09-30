import { redactSecureLinkPaths } from "@/lib/secure-link-redaction";

/**
 * Keeps personal data out of error reports and logs (docs/mortgage SPEC §8:
 * "No PII in logs, Sentry or PostHog"). Error messages are written by
 * libraries and providers, not by us — a unique-violation quotes the value, a
 * mail provider quotes the address it refused — so everything headed for
 * `error_events` (readable by every staff member), the function logs or
 * Sentry passes through here first.
 *
 * It takes out email addresses, phone numbers (UAE numbers however written,
 * and international ones written with a +), Bearer credentials and
 * secure-link tokens (`lib/secure-link-redaction.ts`). Ids, codes and counts
 * stay: they're what makes a report useful, and they identify no one.
 */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// +971 50 123 4567 · 00971501234567 · 971-50-1234567 · 050 123 4567 · +44 7700 900123
const PHONE = /(?:(?:\+|\b00)[1-9][\d\s().-]{7,17}\d|\b971[\s-]?0?5\d(?:[\s-]?\d){7}\b|\b05\d(?:[\s-]?\d){7}\b)/g;
const BEARER = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi;

export function scrubPii(text: string): string {
  if (!text) return text;
  return redactSecureLinkPaths(text).replace(BEARER, "$1 [token]").replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}

/** Keys whose values are personal or secret whatever they hold. */
const SECRET_KEY = /^(e-?mail|email_address|mobile|mobile_e164|phone|telephone|full_?name|first_?name|last_?name|date_of_birth|dob|token|password|secret|authorization|cookie|set-cookie|ip|ip_address)$/i;

/** `scrubPii` through a structure: every string, at any depth; secret-named keys replaced whole. */
export function scrubContext<T>(value: T, depth = 0): T {
  if (depth > 6) return "[…]" as unknown as T;
  if (typeof value === "string") return scrubPii(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => scrubContext(v, depth + 1)) as unknown as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRET_KEY.test(k) && v != null && v !== "" ? "[redacted]" : scrubContext(v, depth + 1),
      ]),
    ) as T;
  }
  return value;
}

/** "k•••@example.com": enough for a log line to be read, not enough to be a record of who. */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 1) return "[email]";
  return `${address[0]}•••${address.slice(at)}`;
}
