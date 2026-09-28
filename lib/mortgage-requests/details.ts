/**
 * The applicant's details (W2): the rules, the normalisers the inputs use
 * while someone types, and the zod schema the submit endpoint validates with.
 * One module for both sides, so the browser can't accept what the server then
 * refuses (docs/mortgage/frontend/W2-personal-details, "Fields").
 *
 * Rule codes, not messages: the browser maps a code to copy in
 * messages/en/mortgage.json, analytics reports the code (never the value),
 * and the server answers a 422 with the field so W3/W5 can send the
 * applicant back to it.
 */

import { z } from "zod";
import { dubaiDateKey, dubaiDayStart } from "./dubai-time";
import { EMPLOYMENT_TYPES } from "./documents";

export const SERVICES = ["consultancy", "pre_approval"] as const;
export type Service = (typeof SERVICES)[number];

export const RESIDENCIES = ["uae_national", "uae_resident_expat"] as const;
export type Residency = (typeof RESIDENCIES)[number];

/** Where an application started. Matches the `mortgage_entry_point` enum (0138). */
export const ENTRY_POINTS = [
  "home",
  "calculator_preapproval",
  "calculator_advisor",
  "property_detail",
  "services_menu",
  "consult_invite",
  "direct",
] as const;
export type EntryPoint = (typeof ENTRY_POINTS)[number];

export const DETAIL_FIELDS = [
  "residency",
  "employmentType",
  "fullName",
  "dateOfBirth",
  "mobile",
  "email",
] as const;
export type DetailField = (typeof DETAIL_FIELDS)[number];

export type DetailRule =
  | "required"
  | "too_short"
  | "too_long"
  | "characters"
  | "not_a_date"
  | "not_in_past"
  | "too_old"
  | "not_mobile"
  | "landline"
  | "invalid";

// ── Full name ────────────────────────────────────────────────────

/** Latin or Arabic letters (with their marks), spaces, hyphens and apostrophes. */
const NAME_CHARACTERS = /^[\p{Script=Latin}\p{Script=Arabic}\p{M}' ’-]+$/u;

/** Trimmed, with runs of spaces collapsed: what is stored and shown back. */
export function normaliseName(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function nameRule(raw: string): DetailRule | null {
  const name = normaliseName(raw);
  if (!name) return "required";
  if ([...name].length < 2) return "too_short";
  if ([...name].length > 100) return "too_long";
  if (!NAME_CHARACTERS.test(name)) return "characters";
  return null;
}

// ── Date of birth ────────────────────────────────────────────────

/**
 * What the date field shows while someone types: digits only, with " / "
 * inserted after the day and the month. "14031990" → "14 / 03 / 1990".
 */
export function maskDob(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join(" / ");
}

/**
 * "14 / 03 / 1990", "14/3/1990", "14-03-1990" or an autofilled "1990-03-14"
 * → "1990-03-14". Null when it isn't a real calendar date.
 */
export function parseDob(raw: string): string | null {
  const text = raw.trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const dmy = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/.exec(text);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (dmy) {
    [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * A real date before today in Dubai. Age limits aren't designed (D22); the
 * only floor is 1900, so a mistyped year ("0199") is caught as a typo.
 */
export function dobRule(raw: string, now: Date = new Date()): DetailRule | null {
  if (!raw.trim()) return "required";
  const iso = parseDob(raw);
  if (!iso) return "not_a_date";
  if (Number(iso.slice(0, 4)) < 1900) return "too_old";
  const today = dubaiDateKey(dubaiDayStart(now.getTime()));
  if (iso >= today) return "not_in_past";
  return null;
}

// ── Mobile ───────────────────────────────────────────────────────

/**
 * The nine national digits from whatever was typed or pasted: strips a
 * leading +971, 00971 or 971, a trunk 0, spaces, dashes, dots and brackets.
 * "+971 (0)50-218 4417" → "502184417".
 */
export function mobileDigits(raw: string): string {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+971")) digits = digits.slice(4);
  else if (digits.startsWith("00971")) digits = digits.slice(5);
  else if (digits.startsWith("971") && digits.length > 10) digits = digits.slice(3);
  digits = digits.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 9);
}

/** How the field shows the digits while typing: "502184417" → "50 218 4417". */
export function maskMobile9(raw: string): string {
  const digits = mobileDigits(raw);
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 9)].filter(Boolean).join(" ");
}

export function mobileRule(raw: string): DetailRule | null {
  const digits = mobileDigits(raw);
  if (!digits) return "required";
  // A UAE landline: 2 Abu Dhabi, 3 Al Ain, 4 Dubai, 6 Sharjah/Ajman/UAQ, 7 RAK, 9 Fujairah.
  if (/^[234679]/.test(digits)) return "landline";
  if (!/^5\d{8}$/.test(digits)) return "not_mobile";
  return null;
}

/** "50 218 4417" → "+971502184417", or null. */
export function toE164(raw: string): string | null {
  return mobileRule(raw) === null ? `+971${mobileDigits(raw)}` : null;
}

// ── Email ────────────────────────────────────────────────────────

const EMAIL_SHAPE = z.string().email().max(254);

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function emailRule(raw: string): DetailRule | null {
  const email = normaliseEmail(raw);
  if (!email) return "required";
  return EMAIL_SHAPE.safeParse(email).success ? null : "invalid";
}

// ── The whole form ───────────────────────────────────────────────

/** What W2 holds while someone types (the store's `details`). */
export type DetailsDraft = {
  residency?: Residency;
  employmentType?: (typeof EMPLOYMENT_TYPES)[number];
  fullName?: string;
  /** As typed, "14 / 03 / 1990"; parsed on validation. */
  dateOfBirth?: string;
  /** The national digits as typed, "50 218 4417". */
  mobileNational?: string;
  email?: string;
};

/** What the API takes, and what W3/W4/W7 show. */
export type Details = {
  residency: Residency;
  employmentType: (typeof EMPLOYMENT_TYPES)[number];
  fullName: string;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  /** E.164, "+971502184417" */
  mobile: string;
  email: string;
};

export type DetailsResult =
  | { ok: true; details: Details }
  | { ok: false; errors: Partial<Record<DetailField, DetailRule>> };

/** Every rule at once, in the form's order, as W2 checks on Continue. */
export function validateDetails(draft: DetailsDraft, now: Date = new Date()): DetailsResult {
  const errors: Partial<Record<DetailField, DetailRule>> = {};
  if (!draft.residency) errors.residency = "required";
  if (!draft.employmentType) errors.employmentType = "required";
  const name = nameRule(draft.fullName ?? "");
  if (name) errors.fullName = name;
  const dob = dobRule(draft.dateOfBirth ?? "", now);
  if (dob) errors.dateOfBirth = dob;
  const mobile = mobileRule(draft.mobileNational ?? "");
  if (mobile) errors.mobile = mobile;
  const email = emailRule(draft.email ?? "");
  if (email) errors.email = email;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    details: {
      residency: draft.residency!,
      employmentType: draft.employmentType!,
      fullName: normaliseName(draft.fullName!),
      dateOfBirth: parseDob(draft.dateOfBirth!)!,
      mobile: toE164(draft.mobileNational!)!,
      email: normaliseEmail(draft.email!),
    },
  };
}

/** The first field with an error, in the form's order: where focus goes. */
export function firstInvalidField(errors: Partial<Record<DetailField, DetailRule>>): DetailField | null {
  return DETAIL_FIELDS.find((f) => errors[f]) ?? null;
}

/**
 * The server's schema for the same details, already normalised by the
 * browser. Each refinement reuses the rule above, so both sides agree; the
 * issue's path is the field W3 and W5 send the applicant back to.
 */
export function detailsSchema(now: () => Date = () => new Date()) {
  const rule = (check: (value: string) => DetailRule | null) => (value: string, ctx: z.RefinementCtx) => {
    const failed = check(value);
    if (failed) ctx.addIssue({ code: "custom", message: failed });
  };
  return z.object({
    residency: z.enum(RESIDENCIES),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    fullName: z.string().max(400).superRefine(rule(nameRule)).transform(normaliseName),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "not_a_date")
      .superRefine(rule((v) => dobRule(v, now()))),
    mobile: z.string().regex(/^\+9715\d{8}$/, "not_mobile"),
    email: z.string().max(400).transform(normaliseEmail).superRefine(rule(emailRule)),
  });
}
