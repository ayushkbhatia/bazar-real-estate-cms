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
  Email__c: string | null;
  Phone__c: string | null;
  Description__c: string;
};

/**
 * Stand-ins for when the CRM will not accept an empty value.
 *
 * The 23 Sept revision marks `Email__c`, `Phone__c` and `Country_Code__c` as
 * Required. It describes that as "the API contract for the website
 * integration", which may or may not mean the fields carry Salesforce's
 * field-level Required flag — and that flag rejects an update that nulls
 * them, which would stop PDPL erasure reaching the CRM entirely. We cannot
 * see the org's field metadata to know which it is.
 *
 * So these exist as a fallback, not a default. `.invalid` is reserved by RFC
 * 2606 and can never resolve, so the address cannot be mailed even by
 * accident, and neither value carries any personal data — which is what
 * erasure actually requires. It is the same substitution already made for
 * `Name__c` and `Description__c`; nulling was only ever the more complete
 * option where the schema allowed it.
 */
const REDACTED_EMAIL = "redacted@bazar.invalid";
const REDACTED_PHONE = "0000000000";

/**
 * The fields carrying personal data, and the values that neutralise them.
 *
 ── Country_Code__c is deliberately left alone ──────────────────────────
 * It was being nulled, and then substituted with "+0" when the null was
 * refused. Both were wrong: the field is a restricted picklist and neither
 * an empty value nor "+0" is on it, so the scrub AND its fallback would have
 * failed — erasure would simply never have completed in the CRM.
 *
 * Leaving it is also the better answer on the merits. A dialling code shared
 * by millions of people identifies nobody once the name is a pseudonym, the
 * address is gone and the number is zeroes.
 *
 * `Lead_Source__c`, `Inquiry_Type__c` and `Property_Reference__c` are
 * untouched for the same sort of reason: "a website lead about BAZ-AD-04891 wanting to buy"
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
    Description__c: REDACTION_NOTICE,
  };
}

/** The same erasure, expressed without nulls. See REDACTED_EMAIL above. */
export function buildErasureFallbackPayload(
  pseudonym: string,
): LeadErasurePayload {
  return {
    Name__c: pseudonym,
    Email__c: REDACTED_EMAIL,
    Phone__c: REDACTED_PHONE,
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
  const path = `sobjects/${leadObjectName()}/${encodeURIComponent(externalId)}`;

  try {
    await salesforceRequest(path, {
      method: "PATCH",
      body: buildErasurePayload(pseudonym),
    });
    return { ok: true };
  } catch (err) {
    // The org enforces Required on the fields we just tried to empty. Erase
    // them by substitution instead — the obligation is to remove the personal
    // data, not specifically to write NULL.
    if (
      err instanceof SalesforceError &&
      err.errorCode === "REQUIRED_FIELD_MISSING"
    ) {
      try {
        await salesforceRequest(path, {
          method: "PATCH",
          body: buildErasureFallbackPayload(pseudonym),
        });
        return { ok: true };
      } catch (fallbackErr) {
        if (fallbackErr instanceof SalesforceError) {
          return {
            ok: false,
            retryable: fallbackErr.retryable,
            message: fallbackErr.errorCode
              ? `${fallbackErr.errorCode}: ${fallbackErr.message}`
              : fallbackErr.message,
          };
        }
        return {
          ok: false,
          retryable: true,
          message:
            fallbackErr instanceof Error
              ? fallbackErr.message
              : String(fallbackErr),
        };
      }
    }

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
