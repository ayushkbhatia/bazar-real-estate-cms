/**
 * Recognising one person across enquiries.
 *
 * Email is exact (intake lower-cases it everywhere but the valuation gate).
 * Phone is harder: intake stores numbers as typed ("+971 50 123 4567"), as
 * normalised ("+971501234567") or with a trunk zero ("050 123 4567"), so a
 * string match finds almost nothing. What every spelling of one UAE number
 * shares is its last nine digits — the national number — and for a foreign
 * number nine trailing digits in common is still one subscriber.
 *
 * Pure, so the pattern the database runs can be tested here in JavaScript: a
 * POSIX `~` pattern built from digits, `\D*` and `$` means the same thing in
 * both engines.
 */

/** Fewer digits than this identifies no one. */
const MIN_PHONE_DIGITS = 7;

/** How many trailing digits two spellings of one number must share. */
const TAIL = 9;

/** A phone's digits, or null when there are too few to identify anyone. */
export function phoneDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= MIN_PHONE_DIGITS ? digits : null;
}

/** The trailing digits every spelling of this number shares. */
export function phoneTail(digits: string): string {
  return digits.slice(-TAIL);
}

/**
 * A pattern matching any stored spelling that ends in these digits, whatever
 * separators sit between them. Built from digits alone, so nothing to escape.
 */
export function phonePattern(tail: string): string {
  return `${tail.split("").join("\\D*")}\\D*$`;
}

/** Whether two stored phone strings are one number. */
export function samePhone(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  return Boolean(da && db && phoneTail(da) === phoneTail(db));
}

/** Whether two stored addresses are one mailbox. */
export function sameEmail(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ea = a?.trim().toLowerCase();
  const eb = b?.trim().toLowerCase();
  return Boolean(ea && eb && ea === eb);
}
