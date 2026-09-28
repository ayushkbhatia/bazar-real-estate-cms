/**
 * The consent an applicant gives on W5/W6 before a Fast Pre-Approval
 * (docs/mortgage/SPEC.md §3, `mortgage_consents`; decision D2).
 *
 * The browser sends only `{ given: true, wordingVersion }`. The text stored
 * with the request is looked up here by that version, never taken from the
 * request body, so the record says exactly what the page said. Change the
 * wording by adding a version, never by editing one: every consent row points
 * at the version it was given under.
 *
 * `consent.test.ts` holds each version's text equal to `consent.label` in
 * messages/en/mortgage.json, which is what W5 and W6 render.
 */

export const CONSENT_WORDINGS = {
  // Pending compliance (FE-11 / D2). The page shows "(Consent wording to be
  // confirmed by compliance.)" beside it until a signed-off version replaces it.
  "v0.1":
    "I authorise Bazar Real Estate to share these documents with its partner banks for the sole purpose of obtaining my mortgage pre-approval.",
} as const;

export type ConsentVersion = keyof typeof CONSENT_WORDINGS;

/** The version W5 and W6 show and send. */
export const CURRENT_CONSENT_VERSION: ConsentVersion = "v0.1";

export function isConsentVersion(value: string): value is ConsentVersion {
  return Object.hasOwn(CONSENT_WORDINGS, value);
}
