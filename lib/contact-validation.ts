/**
 * What a real name and a real phone number look like, for every public form.
 *
 * Written on 2 Nov 2026, when a browser-driven bot filed 96 "List your
 * property" leads on the home page in a day, one every few minutes:
 *
 *   name   lQ9hkvs0wF ZbQVUokJcp          two random ten-character tokens
 *   phone  +971 +17664744917              a US number typed after +971
 *   email  someone-real@outlook.com       the same victim's address, again
 *
 * It stepped round the honeypot and the fill-time floor (`lib/forms/spam.ts`),
 * so every one of them was acknowledged by email — to a stranger, up to thirty
 * times — and pushed to Salesforce. The fields themselves were never checked
 * beyond "two characters" and "five characters".
 *
 * These rules are a visible error, never a silent drop: a real person who
 * trips one reads what to change and sends again. That is the line
 * `lib/forms/spam.ts` draws against gibberish scoring — a heuristic that
 * quietly discards a client is the worse bug — and it is why nothing here
 * guesses at whether a well-formed name is "real". What it refuses is what no
 * name has (digits, symbols, a ten-letter run of random capitals) and a number
 * that cannot be dialled in the country it claims.
 *
 * Isomorphic: the form renderer runs it in the browser for instant feedback,
 * every intake schema runs it again on the server, where it counts.
 */

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import type { RefinementCtx } from "zod";

// ── names ────────────────────────────────────────────────────────

/** Letters in any script (Arabic included) and their marks, plus the joiners names use. */
const NAME_CHARS = /^[\p{L}\p{M}\s'’.\-]+$/u;
const DIGIT = /\p{Nd}/u;
const LETTER = /\p{L}/gu;

/**
 * A Latin word whose capitals say it was generated, not typed.
 *
 * "McDonald", "DeAndre", "MacArthur", "O'Brien", "JOHN" are all fine: one
 * capital inside a word is a name, and all capitals is someone with caps lock.
 * What no name does is start in lower case and turn upper half-way
 * ("kzidRYKLAA"), or carry three or more capitals inside a mixed-case word
 * ("ZbQVUokJcp"). Letters straight after an apostrophe or hyphen are a new
 * word for this purpose ("d'Artagnan", "Al-Hashimi").
 */
function looksGenerated(word: string): boolean {
  return word
    .split(/['’\-.]/)
    .filter((part) => /^[A-Za-z]{4,}$/.test(part))
    .some((part) => {
      const lower = part.toLowerCase();
      const upper = part.toUpperCase();
      if (part === lower || part === upper) return false;
      const inner = part.slice(1);
      const innerCaps = inner.replace(/[^A-Z]/g, "").length;
      if (part[0] === part[0]!.toLowerCase() && innerCaps > 0) return true;
      return innerCaps >= 3;
    });
}

/**
 * Why a name can't be accepted, or null when it can.
 *
 * Blank is not this function's business: whether the box is required is the
 * form's rule, so an empty string passes here and is caught there.
 */
export function nameIssue(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return null;
  if (DIGIT.test(name)) return "Names can't contain numbers";
  if (!NAME_CHARS.test(name)) return "Use letters only in your name";
  if ((name.match(LETTER) ?? []).length < 2) return "Enter your full name";
  if (name.length > 80) return "That name is too long";
  if (name.split(" ").some(looksGenerated)) return "Check your name — it doesn't look right";
  return null;
}

// ── phone numbers ────────────────────────────────────────────────

/**
 * Arabic-Indic (٠–٩) and Persian (۰–۹) digits as ASCII.
 *
 * An Arabic keyboard types them, and a visitor on /ar did: "+٩٧١٥٥٨٥٦٨٧٢٨" is
 * a perfectly good UAE mobile. Read, not refused.
 */
export function asciiDigits(value: string): string {
  return value.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) =>
    String((d.charCodeAt(0) & 0xf) % 10),
  );
}

/** Digits, and the punctuation people put between them. */
const PHONE_CHARS = /^[\d\s()+.\-]+$/;

/** A number that is one digit or two over and over is a placeholder, not a line. */
function isFiller(digits: string): boolean {
  return new Set(digits).size <= 2;
}

function valid(text: string, country?: CountryCode): boolean {
  const parsed = parsePhoneNumberFromString(text, country);
  return Boolean(parsed?.isValid()) && !isFiller(parsed!.nationalNumber);
}

/**
 * The ways one number may honestly be typed, best guess first.
 *
 * People type the trunk zero they dial at home ("+971" then "050 123 4567")
 * and sometimes the code again ("+971" then "971 50 123 4567"). Both are still
 * the one number, so both are tried before the number is refused.
 */
function candidates(dial: string, national: string): string[] {
  const code = dial.replace(/^\+/, "");
  const digits = national.replace(/\D/g, "");
  const out = [digits];
  if (digits.startsWith("0")) out.push(digits.slice(1));
  if (digits.startsWith(`00${code}`)) out.push(digits.slice(2 + code.length));
  else if (digits.startsWith(code)) out.push(digits.slice(code.length));
  return out.map((n) => `+${code}${n}`);
}

/**
 * Why a phone number can't be accepted, or null when it can.
 *
 * Takes what the forms store: either the dial-code picker's "+971 50 123 4567"
 * (code, a space, the rest as typed) or one free-text box, which is read as
 * international when it starts with + or 00 and as a UAE number otherwise.
 * Every number is checked against the length and leading digits of the
 * country its code belongs to — nine digits after +971, ten after +1.
 *
 * Blank passes, as for names: requiredness belongs to the form.
 */
export function phoneIssue(raw: string): string | null {
  const value = asciiDigits(raw).trim();
  if (!value) return null;
  if (!PHONE_CHARS.test(value)) return "Use digits only in the phone number";

  const picked = /^(\+\d{1,4})\s+(.*)$/.exec(value);
  if (picked) {
    const dial = picked[1]!;
    let national = picked[2]!.trim();
    // A second code typed after the one picked: "+971 +1 766 474 4917". Fine
    // when it repeats the picked code; otherwise the visitor meant another
    // country, and has to say so in the list.
    if (national.startsWith("+")) {
      const compact = national.replace(/[^\d+]/g, "");
      if (!compact.startsWith(dial)) {
        return "Pick the country code from the list, then enter the rest of the number without it";
      }
      national = compact.slice(dial.length);
    }
    if (national.includes("+")) return "Use digits only in the phone number";
    if (candidates(dial, national).some((c) => valid(c))) return null;
    return `That isn't a valid ${dial} number — check the number of digits`;
  }

  if (value.indexOf("+") > 0) return "Use digits only in the phone number";
  const international = value.startsWith("+")
    ? value
    : value.startsWith("00")
      ? `+${value.slice(2)}`
      : null;
  if (international) {
    if (valid(international)) return null;
    // "+971 050…" typed into one box: the trunk zero after the code.
    const zero = /^(\+\d{1,3})[\s\-.()]*0(.*)$/.exec(international);
    if (zero && valid(`${zero[1]}${zero[2]}`)) return null;
    return "That isn't a valid phone number — check the country code and the number of digits";
  }
  if (valid(value, "AE")) return null;
  return "That isn't a valid UAE number — add the country code if it's from elsewhere";
}

// ── as zod refinements ───────────────────────────────────────────

/** `.superRefine(refineName)` on any name box. */
export function refineName(value: string, ctx: RefinementCtx): void {
  const issue = nameIssue(value);
  if (issue) ctx.addIssue({ code: "custom", message: issue });
}

/** `.superRefine(refinePhone)` on any phone box. */
export function refinePhone(value: string, ctx: RefinementCtx): void {
  const issue = phoneIssue(value);
  if (issue) ctx.addIssue({ code: "custom", message: issue });
}
