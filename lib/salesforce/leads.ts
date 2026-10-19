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
  /** The page the lead came from: the listing for a listing enquiry, the
   *  project for a project enquiry, else the page the form sat on. Lead API
   *  v1.1 (1 Oct 2026); Levarus's website lead assignment reads it. Replaced
   *  `Property_Reference__c`, removed from Lead__c on 13 Oct 2026. */
  Website_Listing_URL__c?: string;
  /** Restricted picklist, Lead API v1.1: "Arabic" or "Arabic & English".
   *  See PREFERRED_LANGUAGE. */
  Preferred_Languages__c?: string;
  /** A mortgage request's service: "Fast Pre-Approval (24-hour)" or
   *  "Mortgage Consultancy" — a restricted picklist of exactly those two,
   *  created 19 Oct 2026. Optional: while the integration user cannot write
   *  it, the lead goes without and the description still says which. See
   *  OPTIONAL_LEAD_FIELDS. */
  Mortgage_Service__c?: string;
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
export const MAX_NAME = 255;
export const MAX_EMAIL = 80;
const MAX_PHONE = 40;
export const MAX_URL = 255;
export const MAX_DESCRIPTION = 131072;

export function clamp(value: string | null | undefined, max: number): string | undefined {
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
export const INQUIRY_TYPES = ["Buy", "Sell", "Rent", "Other"] as const;
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
 * already owns the property and wants it run for them. Until 19 Oct 2026 the
 * picklist had no word for either and they were filed as Buy; Levarus then
 * added "Other" at Bazar's request.
 */
const INQUIRY_TYPE_FALLBACK: InquiryType = "Other";

/**
 * The visitor's own declared intent, which is the strongest signal available:
 * they picked it, rather than it being inferred from which page they were on.
 * Stored in `enquiries.inferred_constraints.intent` (see the public enquiry
 * action) and drawn from ENQUIRY_INTENTS in lib/schemas/enquiry.ts.
 *
 * `invest` is a purchase. `manage` is none of the three: the owner wants the
 * property run for them.
 */
const INTENT_INQUIRY_TYPE: Record<string, InquiryType> = {
  buy: "Buy",
  sell: "Sell",
  rent: "Rent",
  invest: "Buy",
  manage: "Other",
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

/**
 * `Preferred_Languages__c` — a restricted picklist of "Arabic" and
 * "Arabic & English", and nothing for English alone. The only signal this
 * site has is the language the visitor used it in, so an Arabic visitor is
 * "Arabic", and an English one sends nothing rather than claiming they speak
 * Arabic: asked of Levarus on 19 Oct 2026 to add "English". When they do,
 * it is one line here.
 */
export const PREFERRED_LANGUAGES = ["Arabic", "Arabic & English"] as const;
const PREFERRED_LANGUAGE: Record<string, (typeof PREFERRED_LANGUAGES)[number]> = {
  ar: "Arabic",
};

export function preferredLanguageFor(locale: string | null | undefined): string | undefined {
  return locale ? PREFERRED_LANGUAGE[locale] : undefined;
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
  /** The listing's slug, so a listing enquiry can link its page even when
   *  no form submission recorded where it was sent from. */
  property_slug?: string | null;
  /**
   * The website's own reference, when the listing came FROM Salesforce. Then
   * `property_reference` carries the CRM's listing name (LST-00003) — the
   * one thing a CRM user can look up — and this goes in the description so
   * the advisor can still find the page the visitor was on.
   */
  website_reference?: string | null;
  /** The page the visitor sent the form from, absolute
   *  (`https://www.bazarrealestate.ae/ar/p/…`). Sent as
   *  `Website_Listing_URL__c` and repeated in the description. */
  page_url?: string | null;
  /** The project, when the enquiry was about one (a brochure request on a
   *  project page). */
  project_name?: string | null;
  project_slug?: string | null;
};

/**
 * The page an enquiry was sent from, as a link an advisor can open: the first
 * site-relative path its form submissions recorded (`form_submissions.
 * source_path`), on the site's own origin. Anything that is not a path is
 * ignored rather than linked.
 */
export function leadPageUrl(paths: readonly (string | null)[], siteUrl: string | undefined): string | null {
  const path = paths.find((p): p is string => !!p && p.startsWith("/") && !p.startsWith("//"));
  if (!path) return null;
  return `${siteOrigin(siteUrl)}${path}`;
}

export function siteOrigin(siteUrl: string | undefined): string {
  return (siteUrl ?? "https://www.bazarrealestate.ae").replace(/\/+$/, "");
}

/**
 * `Website_Listing_URL__c`. Levarus assign website leads by it (19 Oct 2026),
 * so every lead carries one where the site knows a page:
 *
 * - a listing enquiry: the page it was sent from, else the listing's own
 *   page — a listing dialog that records no submission still links it;
 * - a project enquiry: likewise, the project's page;
 * - anything else: the page the form sat on (`/buy`, `/tools/valuation`).
 */
export function websiteListingUrl(row: LeadSourceRow, siteUrl: string | undefined): string | undefined {
  const origin = siteOrigin(siteUrl);
  const fallback = row.property_slug
    ? `${origin}/p/${row.property_slug}`
    : row.project_slug
      ? `${origin}/developments/${row.project_slug}`
      : null;
  return clamp(row.page_url ?? fallback, MAX_URL);
}

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
  if (row.page_url) meta.push(`Page: ${row.page_url}`);
  // The reference has no field of its own on Lead__c any more; the listing
  // URL does, and this says which listing it is in words a CRM user can
  // search for.
  if (row.property_reference) meta.push(`Property: ${row.property_reference}`);
  if (row.project_name) meta.push(`Project: ${row.project_name}`);
  if (row.website_reference) meta.push(`Website listing: ${row.website_reference}`);
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
export function buildLeadPayload(row: LeadSourceRow, siteUrl?: string): LeadPayload {
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

  applyPhone(payload, row.phone);

  // Absent rather than an empty string when no page is known.
  set("Website_Listing_URL__c", websiteListingUrl(row, siteUrl));
  set("Preferred_Languages__c", preferredLanguageFor(row.locale));

  return payload;
}

/**
 * `Country_Code__c` + `Phone__c` from one free-text number, onto a payload.
 * Shared by every kind of lead so the split is made one way.
 */
export function applyPhone(payload: LeadPayload, raw: string | null): void {
  const phone = splitPhone(raw);
  if (!phone) return;
  // `Country_Code__c` is a restricted picklist of 206 values, which no
  // vendor doc mentioned. A code outside it fails the whole record, so an
  // unmatched one is left unset rather than sent and rejected.
  const bare = phone.countryCode.replace(/^\+/, "");
  if (SALESFORCE_COUNTRY_CODES.has(bare)) {
    payload.Country_Code__c = phone.countryCode;
  }
  // The national part keeps its own field either way: no digits are thrown
  // away.
  const national = clamp(phone.national, MAX_PHONE);
  if (national) payload.Phone__c = national;
}

/**
 * The required fields checked before sending.
 *
 * The 23 Sept revision also marks `Phone__c` and `Country_Code__c` Required,
 * but the website's forms ask for email OR phone, and since 13 Oct 2026 a lead
 * without a phone is sent anyway (Bazar's call): Salesforce, not this file,
 * decides whether it can be created, so the day Levarus relax the requirement
 * those leads start arriving with no change here. Until then Salesforce
 * answers REQUIRED_FIELD_MISSING and the row is parked `failed` with its
 * reason. `Name__c` is NOT NULL here and the two picklists are total.
 */
const REQUIRED_FIELDS = ["Email__c"] as const;

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
/**
 * Fields a lead can do without. Each costs at most one extra call, never the
 * lead, when the org refuses it:
 *
 * - `INVALID_FIELD` — no such column: removed, renamed, or hidden from the
 *   integration user;
 * - `INVALID_FIELD_FOR_INSERT_UPDATE` — visible but read-only to it. This is
 *   how `Mortgage_Service__c` arrived on 19 Oct 2026, and before this code
 *   was listed here it failed every mortgage lead outright;
 * - `INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST` — a value the picklist no
 *   longer holds.
 *
 * What each carried is in the description too.
 */
const OPTIONAL_LEAD_FIELDS = [
  "Website_Listing_URL__c",
  "Preferred_Languages__c",
  "Mortgage_Service__c",
] as const;

const DROPPABLE_ERRORS = new Set([
  "INVALID_FIELD",
  "INVALID_FIELD_FOR_INSERT_UPDATE",
  "INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST",
]);

export async function pushLead(row: LeadSourceRow, siteUrl?: string): Promise<PushResult> {
  return pushLeadPayload(row.id, buildLeadPayload(row, siteUrl), "enquiry");
}

/**
 * Upsert one built payload under `externalId` — the row's own uuid, enquiry
 * or mortgage request. `noun` only words the local refusal.
 */
export async function pushLeadPayload(
  externalId: string,
  payload: LeadPayload,
  noun: string,
): Promise<PushResult> {
  const object = leadObjectName();
  const externalIdField = leadExternalIdField();

  const missing = missingRequiredFields(payload);
  if (missing.length > 0) {
    return {
      ok: false,
      retryable: false,
      message: `${LOCAL_BLOCK_PREFIX}: Salesforce requires ${missing.join(", ")}, and this ${noun} has none. Not sent.`,
      errorCode: "REQUIRED_FIELD_MISSING",
    };
  }

  // A field the org does not have — renamed, removed, its access withdrawn,
  // not created yet — must not lose the lead. Send it again without; what it
  // carried is in the description too. Only fields in OPTIONAL_LEAD_FIELDS,
  // each at most once.
  let current = payload;
  let result = await send(externalId, object, externalIdField, current);
  for (let i = 0; i < OPTIONAL_LEAD_FIELDS.length && !result.ok; i++) {
    const failed = result;
    // The client appends the error's `fields` to the message, so a picklist
    // rejection — whose text names the field's label, not its API name —
    // still names the field here.
    const dropped = failed.errorCode && DROPPABLE_ERRORS.has(failed.errorCode)
      ? OPTIONAL_LEAD_FIELDS.find((f) => f in current && failed.message.includes(f))
      : undefined;
    if (!dropped) break;
    const rest = { ...current };
    delete rest[dropped];
    current = rest;
    result = await send(externalId, object, externalIdField, current);
  }
  return result;
}

async function send(
  externalId: string,
  object: string,
  externalIdField: string | null,
  payload: LeadPayload,
): Promise<PushResult> {
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
        `sobjects/${object}/${externalIdField}/${encodeURIComponent(externalId)}`,
        { method: "PATCH", body: payload },
      );
      return { ok: true, id: res?.id ?? externalId };
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
