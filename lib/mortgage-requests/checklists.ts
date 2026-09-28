/**
 * Review checks per document kind (docs/mortgage/SPEC.md §2.3) — data, not
 * code, so the mortgage team's list can change without a schema change.
 * `mortgage_documents.checks` stores `{ [key]: boolean }` against these keys,
 * and `mortgage_documents.recorded` the fields staff type for pricing.
 *
 * Only the salary certificate and the 12-month statements are designed (C3,
 * C4). The other four are SPEC's proposals, pending the Head of mortgages
 * (decision D21), and are marked `proposed`.
 *
 * Labels are the CMS's words, verbatim from docs/mortgage/cms. The CMS is
 * English by policy, so they live here rather than in a message catalogue.
 */

import type { DocKind } from "./documents";

export type Check = { key: string; label: string };

export type RecordedField = {
  key: string;
  label: string;
  /** aed: a whole AED amount · month: "YYYY-MM" · text: free text */
  type: "aed" | "month" | "text";
};

export type Checklist = {
  status: "designed" | "proposed";
  checks: readonly Check[];
  /** Figures recorded for pricing (C3's "Record for pricing"). */
  recorded: readonly RecordedField[];
};

export const CHECKLISTS: Record<DocKind, Checklist> = {
  salary_certificate: {
    status: "designed",
    checks: [
      { key: "name_matches", label: "Name matches the application" },
      { key: "addressed_to_bank", label: "Addressed to a bank" },
      { key: "issued_recently", label: "Issued within the last 30 days" },
      { key: "signed_and_stamped", label: "Signed and stamped by the employer" },
      { key: "salary_stated", label: "Monthly salary stated" },
    ],
    recorded: [
      { key: "monthly_gross_aed", label: "Monthly gross salary", type: "aed" },
      { key: "employed_since", label: "Employed since", type: "month" },
      { key: "employer", label: "Employer", type: "text" },
    ],
  },
  bank_statements_12m: {
    status: "designed",
    checks: [
      { key: "holder_matches", label: "Account holder matches the trade licence" },
      { key: "issued_by_bank", label: "Issued by the bank" },
      { key: "covers_period", label: "Covers the last 12 months" },
    ],
    recorded: [],
  },
  emirates_id: {
    status: "proposed",
    checks: [
      { key: "name_matches", label: "Name matches" },
      { key: "front_and_back", label: "Front and back included" },
      { key: "not_expired", label: "Not expired" },
    ],
    recorded: [],
  },
  passport: {
    status: "proposed",
    checks: [
      { key: "name_matches", label: "Name matches" },
      { key: "photo_page_legible", label: "Photo page legible" },
      { key: "not_expired", label: "Not expired" },
    ],
    recorded: [],
  },
  trade_license: {
    status: "proposed",
    checks: [
      { key: "valid_current", label: "Valid / current" },
      { key: "applicant_named", label: "Applicant named on the licence" },
    ],
    recorded: [],
  },
  bank_statements_3m: {
    status: "proposed",
    checks: [
      { key: "holder_matches", label: "Account holder matches the applicant" },
      { key: "issued_by_bank", label: "Issued by the bank" },
      { key: "covers_period", label: "Covers the last 3 months" },
    ],
    recorded: [],
  },
};

export type CheckValues = Readonly<Record<string, boolean>> | null | undefined;

/** The checks for `kind` not yet ticked, in display order. */
export function missingChecks(kind: DocKind, values: CheckValues): string[] {
  return CHECKLISTS[kind].checks
    .filter((check) => values?.[check.key] !== true)
    .map((check) => check.key);
}

/** "Accept document" is enabled only when every check is ticked (SPEC §2.3). */
export function checksComplete(kind: DocKind, values: CheckValues): boolean {
  return missingChecks(kind, values).length === 0;
}
