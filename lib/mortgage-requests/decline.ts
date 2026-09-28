/**
 * Declining a Fast Pre-Approval (decision D19; migration 0147): the reasons,
 * and the message the adviser starts from.
 *
 * The reason is the team's record of why the file failed, kept on the request.
 * The message is the applicant's to read: thanks, the outcome, what it comes
 * down to, what could change it, an open door, and the adviser's first name.
 * It is prefilled from the reason and edited before it goes; "Other" leaves
 * the middle for the adviser to write.
 *
 * "No bank made an offer" is only for a file that went to the banks: the
 * message says it did, so the database refuses it earlier.
 */

import { cmsT } from "./cms-strings";
import type { MortgageStatus } from "./state";

/** Must match `mortgage_decline_reason` in 0147 (the database tests compare them). */
export const DECLINE_REASONS = [
  "income_below_minimum",
  "debt_burden",
  "credit_report",
  "employment_history",
  "age_at_term_end",
  "documents_incomplete",
  "no_bank_offer",
  "other",
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

/** Where a file can be declined from (state.ts has the same rule). */
export const DECLINABLE: readonly MortgageStatus[] = ["new", "in_review", "awaiting_applicant", "with_banks"];

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

const KEY: Record<DeclineReason, string> = {
  income_below_minimum: "incomeBelowMinimum",
  debt_burden: "debtBurden",
  credit_report: "creditReport",
  employment_history: "employmentHistory",
  age_at_term_end: "ageAtTermEnd",
  documents_incomplete: "documentsIncomplete",
  no_bank_offer: "noBankOffer",
  other: "other",
};

export function isDeclineReason(value: unknown): value is DeclineReason {
  return typeof value === "string" && (DECLINE_REASONS as readonly string[]).includes(value);
}

/** The reasons a file in `status` can be declined for, in the order the form lists them. */
export function declineReasonsFor(status: MortgageStatus): readonly DeclineReason[] {
  return status === "with_banks" ? DECLINE_REASONS : DECLINE_REASONS.filter((r) => r !== "no_bank_offer");
}

/** The reason as the team reads it (the form, C2's decision card, the activity log). */
export function declineReasonLabel(reason: DeclineReason): string {
  return t(`decline.reason.${KEY[reason]}`);
}

/** The message the adviser starts from, for this reason. */
export function declineMessage(
  reason: DeclineReason,
  names: { applicantFirstName: string; adviserFirstName: string },
): string {
  const parts = [t("decline.template.opening", { firstName: names.applicantFirstName })];
  if (reason !== "other") {
    parts.push(t(`decline.template.why.${KEY[reason]}`), t(`decline.template.next.${KEY[reason]}`));
  }
  parts.push(t("decline.template.closing"));
  if (names.adviserFirstName) parts.push(names.adviserFirstName);
  return parts.join("\n\n");
}
