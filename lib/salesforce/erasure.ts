import "server-only";
import { salesforceRequest, SalesforceError } from "./client";
import { leadObjectName } from "./leads";

/**
 * PDPL right-to-erasure, applied to the copy of the subject that lives in
 * Salesforce.
 *
 * ── Pseudonymise, do not delete ──────────────────────────────────────────
 * This mirrors `anonymise_by_email` (migration 0067) exactly, and for the
 * same reason: rows on AML-relevant tables are kept with their inline PII
 * wiped, so the 7-year reconstruction duty under UAE AML rules still holds.
 * A lead in the client's CRM is the same record under the same duty.
 *
 * Doing something *different* in Salesforce than in Postgres would be the
 * indefensible option — either the retention basis holds for both or it
 * holds for neither. Deleting is also destructive in a system this product
 * does not own: a `DELETE` on a lead cascades to whatever the sales team has
 * attached to it, and Salesforce's Recycle Bin only holds it for 15 days.
 *
 * If the client's DPO ever decides hard deletion is required, it is a
 * one-verb change here — `DELETE sobjects/Lead__c/<id>` — not a redesign.
 */

/** Byte-for-byte the string migration 0067 writes into `messages.body`. */
export const REDACTION_NOTICE = "[redacted at the data subject's request]";

/**
 * Its own type rather than a reuse of `LeadPayload`, because the two carry
 * opposite intent. A create omits what it does not know; an erasure has to
 * say "this field is now empty" out loud, and `undefined` would be dropped by
 * JSON.stringify and silently leave the old value in place.
 */
export type LeadErasurePayload = {
  Name__c: string;
  Email__c: null;
  Phone__c: null;
  Country_Code__c: null;
  Description__c: string;
};

/**
 * The fields carrying personal data, and the values that neutralise them.
 *
 * `Lead_Source__c`, `Inquiry_Type__c` and `Property_Reference__c` are
 * deliberately untouched: "a website lead about BAZ-AD-04891 wanting to buy"
 * identifies nobody once the name, address and phone are gone, and it is the
 * commercial fact the retention basis exists to preserve.
 *
 * `null` is how the REST API blanks a nillable field — the SOAP-era
 * `fieldsToNull` array has no equivalent here and is not needed.
 */
export function buildErasurePayload(pseudonym: string): LeadErasurePayload {
  return {
    Name__c: pseudonym,
    Email__c: null,
    Phone__c: null,
    Country_Code__c: null,
    Description__c: REDACTION_NOTICE,
  };
}

export type ScrubResult =
  | { ok: true }
  | { ok: false; retryable: boolean; message: string };

/**
 * Pseudonymise one `Lead__c` record in place.
 *
 * A record that is already gone counts as erased: if the sales team deleted
 * it by hand, or a sandbox was refreshed out from under us, the obligation is
 * discharged and retrying forever would be wrong. So a 404 — Salesforce's
 * NOT_FOUND / ENTITY_IS_DELETED — resolves as success rather than an error
 * the operator has to interpret.
 */
export async function scrubLead(
  externalId: string,
  pseudonym: string,
): Promise<ScrubResult> {
  try {
    await salesforceRequest(
      `sobjects/${leadObjectName()}/${encodeURIComponent(externalId)}`,
      { method: "PATCH", body: buildErasurePayload(pseudonym) },
    );
    return { ok: true };
  } catch (err) {
    if (err instanceof SalesforceError) {
      if (
        err.status === 404 ||
        err.errorCode === "ENTITY_IS_DELETED" ||
        err.errorCode === "NOT_FOUND"
      ) {
        return { ok: true };
      }
      return {
        ok: false,
        retryable: err.retryable,
        message: err.errorCode
          ? `${err.errorCode}: ${err.message}`
          : err.message,
      };
    }
    return {
      ok: false,
      retryable: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
