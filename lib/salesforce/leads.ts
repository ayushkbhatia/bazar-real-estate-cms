import "server-only";
import { env } from "@/lib/env";
import type { Database } from "@/db/types";
import { salesforceRequest, SalesforceError } from "./client";
import { splitPhone, SALESFORCE_COUNTRY_CODES } from "./phone";

type EnquirySource = Database["public"]["Enums"]["enquiry_source"];
type PropertyMode = Database["public"]["Enums"]["property_mode"];

/**
 * The object name is configurable because `Lead__c` is a custom object in the
 * client's org, and custom objects get renamed. An env var is a redeploy; a
 * hard-coded name is a redeploy plus a code review.
 */
const DEFAULT_LEAD_OBJECT = "Lead__c";
const DEFAULT_EXTERNAL_ID_FIELD = "External_ID__c";

export function leadObjectName(): string {
  return env.SALESFORCE_LEAD_OBJECT || DEFAULT_LEAD_OBJECT;
}

/**
 * The External ID field, which the 23 Sept revision of the vendor doc
 * confirms exists: `External_ID__c`, Text(254), External ID, Unique.
 *
 * Defaulted rather than left to an env var. A blank env var would silently
 * fall back to POST — at-least-once delivery, duplicate leads on any retry —
 * and nothing about the system would say so. Defaulting inverts that: in an
 * org that genuinely lacks the field the PATCH fails loudly with
 * INVALID_FIELD on the first lead and the reason lands in `crm_last_error`.
 * A loud failure beats silent duplication.
 *
 * The env var remains, for an org that renamed the field.
 */
export function leadExternalIdField(): string {
  return env.SALESFORCE_LEAD_EXTERNAL_ID_FIELD || DEFAULT_EXTERNAL_ID_FIELD;
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
 * The real field lengths, read from a describe of the object.
 *
 * These were guesses until 24 Sept — 255 everywhere, on the assumption of
 * Salesforce text defaults, because neither vendor doc gave them. Two of
 * them were wrong and would have failed records with STRING_TOO_LONG:
 * `Email__c` is 80, not 255, and `Phone__c` is 40. An address over 80
 * characters is unusual but entirely legal, and it would have lost that lead
 * permanently rather than truncating it.
 */
const MAX_NAME = 255;
const MAX_EMAIL = 80;
const MAX_PHONE = 40;
const MAX_REFERENCE = 255;
const MAX_DESCRIPTION = 131072;

function clamp(value: string | null | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * ── The two restricted picklists ────────────────────────────────────────
 *
 * The 23 Sept revision finally gives their value sets, and both fields are
 * now **Required**. That inverts the rule the first version of this file was
 * written under. Before, an unmappable value could be omitted and left blank
 * for an advisor to fix; now omitting it fails the whole record with
 * REQUIRED_FIELD_MISSING. So every branch below has to terminate in a real
 * value, and where the truth is genuinely not one of the options, a stated
 * default is used rather than a guess dressed up as a mapping.
 */
export const INQUIRY_TYPES = ["Buy", "Sell", "Rent"] as const;
export const LEAD_SOURCES = [
  "Facebook",
  "Advertisement",
  "Webinar",
  "Website",
  "Newspaper",
  "Walk In",
  "Property Finder",
  "Bayut",
  "Others",
] as const;

export type InquiryType = (typeof INQUIRY_TYPES)[number];
export type LeadSourceValue = (typeof LEAD_SOURCES)[number];

/**
 * Where none of Buy/Sell/Rent is true.
 *
 * A general "tell me about your services" enquiry is not a purchase, and a
 * property-management enquiry is the opposite of all three — the person
 * already owns the property and wants it run for them. Neither has a value in
 * this picklist, and the field cannot be left empty, so they land on Buy: the
 * most common intent on a sales-led marketplace, and the least surprising
 * thing for an advisor to find and correct.
 *
 * Worth telling Levarus. A fourth value ("Other", or "Manage") would remove
 * the need to state a wrong answer confidently. Until then this constant is
 * the one place the compromise lives.
 */
const INQUIRY_TYPE_FALLBACK: InquiryType = "Buy";

/**
 * The visitor's own declared intent, which is the strongest signal available:
 * they picked it, rather than it being inferred from which page they were on.
 * Stored in `enquiries.inferred_constraints.intent` (see the public enquiry
 * action) and drawn from ENQUIRY_INTENTS in lib/schemas/enquiry.ts.
 *
 * `invest` is a purchase. `manage` is the case the picklist has no word for.
 */
const INTENT_INQUIRY_TYPE: Record<string, InquiryType> = {
  buy: "Buy",
  sell: "Sell",
  rent: "Rent",
  invest: "Buy",
};

/** The listing's own commercial mode, where a listing is attached. */
const MODE_INQUIRY_TYPE: Record<PropertyMode, InquiryType | null> = {
  buy: "Buy",
  rent: "Rent",
  // Off-plan is a purchase — the unit is being sold, it just is not built yet.
  off_plan: "Buy",
  // `commercial` conflates for-sale and for-lease in one mode, so the listing
  // alone cannot say which. Left null so intent or source decides instead of
  // this coin-flipping.
  commercial: null,
};

/**
 * Sources that carry an intent of their own regardless of any listing.
 *
 * A valuation request and the /services/sell wizard are both sellers — this
 * is the half of the business that "Sell" exists for, and before the picklist
 * was published these leads were going out labelled as buyers.
 */
const SOURCE_INQUIRY_TYPE: Partial<Record<EnquirySource, InquiryType>> = {
  valuation: "Sell",
  list_property: "Sell",
  // A mortgage enquiry is someone financing a purchase.
  mortgage: "Buy",
  // "Register your interest" on a development — off-plan, so a purchase.
  development_interest: "Buy",
  brochure: "Buy",
};

/**
 * Precedence: what the visitor said, then what they were looking at, then
 * what kind of form it was, then the stated fallback.
 *
 * Intent outranks the listing deliberately. Someone on a for-sale listing who
 * ticked "rent" means it; reading the page's mode over their answer would
 * file them as a buyer.
 */
export function inquiryTypeFor(
  intent: string | null,
  mode: PropertyMode | null,
  source: EnquirySource,
): InquiryType {
  const fromIntent = intent ? INTENT_INQUIRY_TYPE[intent] : undefined;
  if (fromIntent) return fromIntent;
  if (mode) {
    const fromMode = MODE_INQUIRY_TYPE[mode];
    if (fromMode) return fromMode;
  }
  return SOURCE_INQUIRY_TYPE[source] ?? INQUIRY_TYPE_FALLBACK;
}

/**
 * `Lead_Source__c` — which channel the person arrived through.
 *
 * The picklist has entries for Facebook, Property Finder and Bayut, all of
 * which Bazar actually uses. None of them is mapped here yet, and that is
 * deliberate rather than an oversight: no lead in the database has ever come
 * through those paths. The Meta Lead Ads importer exists on an unmerged
 * branch and its `meta_leads` table is empty in production, so there is no
 * observed row shape to map from, and inventing the join now would be writing
 * an untested branch against a schema that may still change.
 *
 * WhatsApp is the one real non-website channel today, and the picklist has no
 * word for it — "Others" is more honest than claiming the website.
 */
const SOURCE_LEAD_SOURCE: Partial<Record<EnquirySource, LeadSourceValue>> = {
  whatsapp_inbound: "Others",
};

export function leadSourceFor(source: EnquirySource): LeadSourceValue {
  return SOURCE_LEAD_SOURCE[source] ?? "Website";
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
  /** `inferred_constraints.intent` — what the visitor said they wanted. */
  intent: string | null;
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

  set("Name__c", clamp(row.name, MAX_NAME));
  set("Email__c", clamp(row.email, MAX_EMAIL));
  set("Description__c", buildDescription(row));

  // Both picklists are Required, and both always resolve to a real value —
  // no branch of either mapping can return undefined.
  payload.Lead_Source__c = leadSourceFor(row.source);
  payload.Inquiry_Type__c = inquiryTypeFor(
    row.intent,
    row.property_mode,
    row.source,
  );

  const phone = splitPhone(row.phone);
  if (phone) {
    // `Country_Code__c` is a restricted picklist of 206 values, which no
    // vendor doc mentioned. A code outside it fails the whole record, so an
    // unmatched one is left unset — `missingRequiredFields` then refuses the
    // lead locally with a reason, instead of spending a round trip to be
    // told the same thing less clearly.
    const bare = phone.countryCode.replace(/^\+/, "");
    if (SALESFORCE_COUNTRY_CODES.has(bare)) {
      payload.Country_Code__c = phone.countryCode;
    }
    // The national part keeps its own field either way: a blocked lead is
    // still readable in the CMS, and no digits are thrown away.
    set("Phone__c", clamp(phone.national, MAX_PHONE));
  }

  // "pass this value when enquiry about property" — so a general contact-form
  // lead sends no reference at all rather than an empty string.
  const reference = clamp(row.property_reference, MAX_REFERENCE);
  if (reference) payload.Property_Reference__c = reference;

  return payload;
}

/**
 * The fields the 23 Sept revision marks **Required**.
 *
 * `Name__c` is not listed here even though it is required: `enquiries.name`
 * is NOT NULL with a two-character minimum in the zod schema, so it cannot be
 * absent. The two picklists are not listed either — their mappings are total.
 * What is left is the genuinely at-risk set.
 */
const REQUIRED_FIELDS = ["Email__c", "Phone__c", "Country_Code__c"] as const;

/** Prefix that marks a failure this side decided, with no call made. */
export const LOCAL_BLOCK_PREFIX = "Blocked locally";

/**
 * Refuse to send a payload Salesforce is certain to reject.
 *
 * This site has always asked for email **or** phone — `lib/schemas/enquiry.ts`
 * enforces exactly that, and 279 of the 772 leads in production have no phone
 * number. Against the new contract every one of those is a guaranteed
 * REQUIRED_FIELD_MISSING, which is a non-retryable 400: five wasted round
 * trips, a burnt slice of the org's daily API allocation, and an error the
 * operator has to decode to discover it was never going to work.
 *
 * Checking first turns that into one honest local answer. The row still ends
 * up `failed`, which is accurate — it did not reach the CRM — but
 * `crm_last_error` names the missing field instead of echoing a remote error,
 * and no call is made.
 *
 * These leads are recoverable in one statement the moment Levarus relax the
 * requirement; docs/SALESFORCE.md carries it.
 */
export function missingRequiredFields(payload: LeadPayload): string[] {
  return REQUIRED_FIELDS.filter((f) => {
    const value = payload[f];
    return typeof value !== "string" || value.trim() === "";
  });
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
  const externalIdField = leadExternalIdField();

  const missing = missingRequiredFields(payload);
  if (missing.length > 0) {
    return {
      ok: false,
      retryable: false,
      message: `${LOCAL_BLOCK_PREFIX}: Salesforce requires ${missing.join(", ")}, and this enquiry has none. Not sent.`,
      errorCode: "REQUIRED_FIELD_MISSING",
    };
  }

  try {
    if (externalIdField) {
      // Upsert. The UUID rides in the URL, not the body — Salesforce infers
      // the external id from the path, which is what the vendor's own example
      // request does.
      //
      // Two success shapes: 201 with `created: true` for a new record, 200
      // with `created: false` for an update. Both carry the record id. (A
      // Salesforce upsert-update can also answer 204 with no body at all,
      // which the vendor doc does not mention; falling back to the enquiry id
      // keeps that case from looking like a failure.)
      const res = await salesforceRequest<{ id?: string; created?: boolean }>(
        `sobjects/${object}/${externalIdField}/${encodeURIComponent(row.id)}`,
        { method: "PATCH", body: payload },
      );
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
