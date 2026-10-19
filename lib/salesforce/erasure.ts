import "server-only";
import { salesforceRequest, SalesforceError } from "./client";
import { leadObjectName } from "./leads";
import { SF_ID_RE } from "./listings/fields";

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

/**
 * A lead Salesforce took out of `Lead__c` and filed as a Re-Inquiry under an
 * earlier inquiry from the same person — Levarus's duplicate rule (19 Oct
 * 2026: same email and same project). The record we created is deleted two
 * seconds after our upsert, and the personal data lives on in the
 * Re-Inquiry, an object the integration user cannot see. `parent` is the
 * inquiry it sits under (`LD-000032`), when it can be found.
 */
export type ReInquiry = { record: string; parent: string | null };

export type ScrubResult =
  | { ok: true; reInquiry?: ReInquiry }
  | { ok: false; retryable: boolean; message: string };

/**
 * A person deletes a lead hours or days after it arrives; the duplicate
 * trigger deletes it within seconds of its creation (two, on 19 Oct 2026).
 * Two minutes separates the two with room to spare.
 */
const REINQUIRY_WINDOW_MS = 2 * 60_000;

type QueryPage<T> = { records: T[] };
type GoneRecord = { CreatedDate?: string | null; LastModifiedDate?: string | null; IsDeleted?: boolean; Email__c?: string | null };

function soqlString(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function soqlDateTime(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Why a record we created is gone: deleted by the duplicate trigger, or by a
 * person (or long since purged from the recycle bin, which holds a deleted
 * record for fifteen days — past that, the two cannot be told apart).
 *
 * Reads the recycle bin (`queryAll`) and, for a Re-Inquiry, the parent: the
 * live inquiry with the same address that has re-enquiries, else the one
 * whose last re-enquiry is stamped when ours was created. Throws on a
 * failed call, so the caller can keep the erasure outstanding rather than
 * call it done on a guess.
 */
export async function findReInquiry(recordId: string): Promise<ReInquiry | null> {
  if (!SF_ID_RE.test(recordId)) return null;
  const object = leadObjectName();
  const gone = await salesforceRequest<QueryPage<GoneRecord>>(
    `queryAll?q=${encodeURIComponent(
      `SELECT CreatedDate, LastModifiedDate, IsDeleted, Email__c FROM ${object} WHERE Id = '${recordId}'`,
    )}`,
    { method: "GET" },
  );
  const rec = gone?.records?.[0];
  if (!rec?.IsDeleted || !rec.CreatedDate || !rec.LastModifiedDate) return null;
  const created = Date.parse(rec.CreatedDate);
  const deleted = Date.parse(rec.LastModifiedDate);
  if (!(deleted - created <= REINQUIRY_WINDOW_MS)) return null;

  const byEmail = rec.Email__c
    ? `SELECT Name FROM ${object} WHERE Email__c = ${soqlString(rec.Email__c)} AND Re_Enquiry_Count__c > 0 ORDER BY Re_Enquiry_Date_and_Time__c DESC LIMIT 1`
    : null;
  const byTime = `SELECT Name FROM ${object} WHERE Re_Enquiry_Date_and_Time__c >= ${soqlDateTime(created - 60_000)} AND Re_Enquiry_Date_and_Time__c <= ${soqlDateTime(created + REINQUIRY_WINDOW_MS)} LIMIT 1`;
  for (const soql of [byEmail, byTime]) {
    if (!soql) continue;
    const res = await salesforceRequest<QueryPage<{ Name?: string | null }>>(
      `query?q=${encodeURIComponent(soql)}`,
      { method: "GET" },
    );
    const parent = res?.records?.[0]?.Name;
    if (parent) return { record: recordId, parent };
  }
  return { record: recordId, parent: null };
}

/**
 * Pseudonymise one `Lead__c` record in place.
 *
 * A record that is already gone counts as erased: if the sales team deleted
 * it by hand, or a sandbox was refreshed out from under us, the obligation is
 * discharged and retrying forever would be wrong. So a 404 — Salesforce's
 * NOT_FOUND / ENTITY_IS_DELETED — resolves as success rather than an error
 * the operator has to interpret.
 *
 * Except a record the duplicate trigger took: then the personal data was
 * moved, not removed, so the result says so (`reInquiry`) and the caller
 * reports it, instead of calling the erasure done.
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
        try {
          const reInquiry = await findReInquiry(externalId);
          return reInquiry ? { ok: true, reInquiry } : { ok: true };
        } catch (lookupErr) {
          // Gone, but why is unknown. Kept outstanding: a guess of "erased"
          // could leave a Re-Inquiry holding the data with nobody told.
          return {
            ok: false,
            retryable: true,
            message: `Record is gone; could not read why: ${
              lookupErr instanceof Error ? lookupErr.message : String(lookupErr)
            }`,
          };
        }
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
