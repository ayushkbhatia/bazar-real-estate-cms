import "server-only";
import { env } from "@/lib/env";
import type { Database } from "@/db/types";
import { salesforceRequest, SalesforceError } from "./client";
import { splitPhone } from "./phone";

type EnquirySource = Database["public"]["Enums"]["enquiry_source"];
type PropertyMode = Database["public"]["Enums"]["property_mode"];

/**
 * The object name is configurable because `Lead__c` is a custom object in the
 * client's org, and custom objects get renamed. An env var is a redeploy; a
 * hard-coded name is a redeploy plus a code review.
 */
const DEFAULT_LEAD_OBJECT = "Lead__c";

export function leadObjectName(): string {
  return env.SALESFORCE_LEAD_OBJECT || DEFAULT_LEAD_OBJECT;
}

/**
 * The shape the Levarus doc documents, and nothing else.
 *
 * Every field is optional in this type because Salesforce rejects an unknown
 * *value* on a restricted picklist as hard as it rejects an unknown field —
 * so where we cannot map confidently, we omit rather than guess. See
 * `INQUIRY_TYPE` below.
 */
export type LeadPayload = {
  Name__c?: string;
  Country_Code__c?: string;
  Phone__c?: string;
  Email__c?: string;
  Lead_Source__c?: string;
  Description__c?: string;
  Inquiry_Type__c?: string;
  Property_Reference__c?: string;
};

/**
 * Salesforce text fields are `Text(255)` unless someone chose otherwise, and
 * a create that exceeds the length fails the whole record with
 * STRING_TOO_LONG. The doc does not give us the lengths (ask-list item 11),
 * so these are the platform defaults: 255 for a text field, and the long-text
 * ceiling for the description. Both are conservative — being truncated is a
 * better outcome for a lead than being rejected.
 */
const MAX_TEXT = 255;
const MAX_DESCRIPTION = 32000;

function clamp(value: string | null | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * `Lead_Source__c` — the doc's one example value is "Website", which is also
 * the only honest thing we can say: every row this job sends originated on
 * bazar.ae regardless of which form drew it.
 *
 * Which *form* it was is carried in `Description__c` instead, so the detail
 * is not lost while the picklist stays on a value we know exists.
 */
const LEAD_SOURCE = "Website";

/**
 * `Inquiry_Type__c` — a restricted picklist whose full value set we have not
 * been given. "Buy" is the only value the doc evidences.
 *
 * So this map is deliberately incomplete: a `null` means "we do not know what
 * Salesforce calls this, so send nothing". Omitting an optional picklist
 * leaves the field blank on the record; sending an invalid one fails the
 * whole create with INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST and loses the
 * lead. Blank is recoverable, rejected is not.
 *
 * Fill the nulls in when Levarus answers item 10 of the ask list — that is
 * the entire change, no other file moves.
 */
const INQUIRY_TYPE: Record<PropertyMode, string | null> = {
  buy: "Buy",
  rent: null,
  off_plan: null,
  commercial: null,
};

/**
 * Enquiries with no property attached still have an intent — a valuation
 * request is a seller, a mortgage enquiry is a buyer. Same rule as above:
 * only "Buy" is confirmed, so only "Buy" is emitted.
 */
const SOURCE_INQUIRY_TYPE: Partial<Record<EnquirySource, string>> = {
  property_page: "Buy",
};

export function inquiryTypeFor(
  mode: PropertyMode | null,
  source: EnquirySource,
): string | undefined {
  if (mode) return INQUIRY_TYPE[mode] ?? undefined;
  return SOURCE_INQUIRY_TYPE[source];
}

/** The enquiry columns this mapper reads, joined to its property's facts. */
export type LeadSourceRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  brief_raw: string | null;
  source: EnquirySource;
  form_key: string | null;
  locale: string;
  property_reference: string | null;
  property_mode: PropertyMode | null;
};

/**
 * The description is where everything Salesforce has no field for goes.
 *
 * `Lead__c` as documented has seven fields; an enquiry here carries the form
 * it came from, the language the visitor wrote in, a budget range and a
 * timeline. Rather than drop that, it is appended as labelled lines under the
 * visitor's own message — readable to an advisor opening the record, and the
 * enquiry id makes a Salesforce record traceable back to a row in this
 * database, which is the only correlation available until there is a real
 * External ID field.
 */
export function buildDescription(row: LeadSourceRow): string | undefined {
  const lines: string[] = [];
  const message = clamp(row.brief_raw, MAX_DESCRIPTION);
  if (message) lines.push(message);

  const meta: string[] = [];
  if (row.form_key) meta.push(`Form: ${row.form_key}`);
  if (row.locale && row.locale !== "en") meta.push(`Language: ${row.locale}`);
  meta.push(`Bazar enquiry: ${row.id}`);

  if (lines.length && meta.length) lines.push("");
  lines.push(...meta);

  return clamp(lines.join("\n"), MAX_DESCRIPTION);
}

/**
 * Pure. Kept separate from the push so the mapping is unit-testable.
 *
 * Absent fields are *absent* rather than present-and-undefined. JSON.stringify
 * would drop them either way, so this is not about the wire format: it is so
 * that the object logged to Sentry on a failure shows what was actually sent,
 * and so a test can assert "this field was omitted" by looking at the keys.
 */
export function buildLeadPayload(row: LeadSourceRow): LeadPayload {
  const payload: LeadPayload = {};
  const set = <K extends keyof LeadPayload>(
    key: K,
    value: LeadPayload[K] | undefined,
  ) => {
    if (value !== undefined) payload[key] = value;
  };

  set("Name__c", clamp(row.name, MAX_TEXT));
  set("Email__c", clamp(row.email, MAX_TEXT));
  set("Lead_Source__c", LEAD_SOURCE);
  set("Description__c", buildDescription(row));

  const phone = splitPhone(row.phone);
  if (phone) {
    payload.Country_Code__c = phone.countryCode;
    set("Phone__c", clamp(phone.national, MAX_TEXT));
  }

  const inquiryType = inquiryTypeFor(row.property_mode, row.source);
  if (inquiryType) payload.Inquiry_Type__c = inquiryType;

  // "pass this value when enquiry about property" — so a general contact-form
  // lead sends no reference at all rather than an empty string.
  const reference = clamp(row.property_reference, MAX_TEXT);
  if (reference) payload.Property_Reference__c = reference;

  return payload;
}

export type PushResult =
  | { ok: true; id: string }
  | { ok: false; retryable: boolean; message: string; errorCode: string | null };

/**
 * Create (or upsert) one `Lead__c` record.
 *
 * ── On the two verbs ─────────────────────────────────────────────────────
 * With `SALESFORCE_LEAD_EXTERNAL_ID_FIELD` set, this issues
 * `PATCH sobjects/Lead__c/<field>/<enquiry uuid>` — Salesforce's upsert. It
 * is exactly-once by construction: a retry after a timeout matches the
 * existing record and updates it instead of creating a second one.
 *
 * Without it, the only verb available is POST, and a crash between Salesforce
 * committing and us writing `crm_external_id` will duplicate the lead on the
 * next run. That is a real defect and it is not fixable from this side — it
 * needs a field marked External ID on the object, which is ask-list item 9.
 * The upsert path is written and tested now so that the fix is an env var
 * rather than a sprint.
 */
export async function pushLead(row: LeadSourceRow): Promise<PushResult> {
  const payload = buildLeadPayload(row);
  const object = leadObjectName();
  const externalIdField = env.SALESFORCE_LEAD_EXTERNAL_ID_FIELD;

  try {
    if (externalIdField) {
      const res = await salesforceRequest<{ id?: string }>(
        `sobjects/${object}/${externalIdField}/${encodeURIComponent(row.id)}`,
        { method: "PATCH", body: payload },
      );
      // An upsert that updated an existing record answers 204 with no body.
      // There is no new id to record in that case, and the one already on the
      // row is still correct, so the enquiry id stands in as the marker that
      // the push completed.
      return { ok: true, id: res?.id ?? row.id };
    }

    const res = await salesforceRequest<{ id?: string; success?: boolean }>(
      `sobjects/${object}`,
      { method: "POST", body: payload },
    );
    if (!res?.id) {
      return {
        ok: false,
        retryable: true,
        message: "Create returned no record id",
        errorCode: null,
      };
    }
    return { ok: true, id: res.id };
  } catch (err) {
    if (err instanceof SalesforceError) {
      return {
        ok: false,
        retryable: err.retryable,
        message: err.message,
        errorCode: err.errorCode,
      };
    }
    return {
      ok: false,
      retryable: true,
      message: err instanceof Error ? err.message : String(err),
      errorCode: null,
    };
  }
}
