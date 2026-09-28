/**
 * The pre-approval message the adviser starts from (C5; the design's text is
 * a sample and the default isn't specified, CMS-6). Built from the lead offer
 * and the other pre-approvals, in the sample's words: the lead bank by its
 * name, the others as the team calls them, and a close that counts them. Only
 * one bank: the message doesn't mention others (C5, edge cases).
 */

import { cmsT } from "./cms-strings";

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

export type OfferForMessage = {
  bankName: string;
  /** "FAB", "Mashreq" (banks.ts `bankLabel`). */
  bankLabel: string;
  amountAed: number;
  ratePct: number;
  rateType: "fixed" | "variable";
  fixedYears: number | null;
  /** "YYYY-MM-DD". */
  validUntil: string;
};

/** "AED 2,150,000". */
export function formatAed(amount: number): string {
  return `AED ${Math.round(amount).toLocaleString("en-US")}`;
}

/** 3.99 → "3.99", 4.2 → "4.2", 4 → "4". */
export function formatRate(pct: number): string {
  return String(Math.round(pct * 1000) / 1000);
}

/** "2026-11-21" → "21 November 2026". */
export function formatLongDateWords(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** Whole days from `today` to `date`, both "YYYY-MM-DD". */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function preApprovalMessage(
  lead: OfferForMessage,
  others: readonly OfferForMessage[],
  names: { applicantFirstName: string; adviserFirstName: string },
): string {
  const leadSentence =
    lead.rateType === "fixed" && lead.fixedYears
      ? t("c5.template.leadFixed", {
          bank: lead.bankName,
          amount: formatAed(lead.amountAed),
          rate: formatRate(lead.ratePct),
          years: lead.fixedYears,
          validUntil: formatLongDateWords(lead.validUntil),
        })
      : t("c5.template.leadVariable", {
          bank: lead.bankName,
          amount: formatAed(lead.amountAed),
          rate: formatRate(lead.ratePct),
          validUntil: formatLongDateWords(lead.validUntil),
        });
  const also = others.map((o) => t("c5.template.also", { bank: o.bankLabel, amount: formatAed(o.amountAed) }));
  const opening = [t("c5.template.opening", { firstName: names.applicantFirstName }), leadSentence, ...also].join(" ");
  const close = t("c5.template.close", { count: 1 + others.length });
  return [opening, names.adviserFirstName ? `${close} ${names.adviserFirstName}` : close].join("\n\n");
}
