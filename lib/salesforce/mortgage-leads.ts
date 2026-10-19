import "server-only";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import type { EntryPoint, Residency, Service } from "@/lib/mortgage-requests/details";
import type { EmploymentType } from "@/lib/mortgage-requests/documents";
import { formatAed } from "@/lib/mortgage-requests/format";
import {
  applyPhone,
  clamp,
  MAX_DESCRIPTION,
  MAX_EMAIL,
  MAX_NAME,
  MAX_URL,
  preferredLanguageFor,
  pushLeadPayload,
  siteOrigin,
  type LeadPayload,
  type PushResult,
} from "./leads";

/**
 * A mortgage request → one `Lead__c` record (migration 0160).
 *
 * Bazar's brief, 14 Oct 2026: the mortgage requests show up in Salesforce as
 * leads, with the basic details and no documents, and the CRM says which
 * service the applicant chose. So a lead carries who they are and how to
 * reach them, the service, and the request's reference and profile — and
 * nothing from the file itself: no document, upload, consent or date of
 * birth. The mortgage team works the file in /admin/mortgages; the
 * description links there.
 *
 * Same object, same upsert, same queue semantics as an enquiry
 * (`pushLeadPayload`); the request's uuid is the External ID, and the two
 * tables' uuids cannot collide.
 */

/** The service as the CRM shows it. The site calls the pre-approval "Fast
 *  Pre-Approval" and badges it "Within 24 hours"; the CRM gets both. */
export const MORTGAGE_SERVICE_CRM_LABEL: Record<Service, string> = {
  pre_approval: "Fast Pre-Approval (24-hour)",
  consultancy: "Mortgage Consultancy",
};

const RESIDENCY_KEY: Record<Residency, "residency.uaeNational" | "residency.expat"> = {
  uae_national: "residency.uaeNational",
  uae_resident_expat: "residency.expat",
};

const EMPLOYMENT_KEY: Record<EmploymentType, "employment.salaried" | "employment.businessOwner"> = {
  salaried: "employment.salaried",
  business_owner: "employment.businessOwner",
};

const ENTRY_KEY = {
  home: "entry.home",
  calculator_preapproval: "entry.calculatorPreapproval",
  calculator_advisor: "entry.calculatorAdvisor",
  property_detail: "entry.propertyDetail",
  services_menu: "entry.servicesMenu",
  consult_invite: "entry.consultInvite",
  direct: "entry.direct",
} as const satisfies Record<EntryPoint, string>;

/** The request columns this mapper reads, joined to what they point at. */
export type MortgageLeadRow = {
  id: string;
  reference: string;
  service: Service;
  full_name: string;
  email: string;
  mobile_e164: string;
  residency: Residency;
  employment_type: EmploymentType;
  /** W2's optional desired property price, whole AED (0163). */
  property_price_aed?: number | null;
  entry_point: EntryPoint;
  /** The listing the applicant started from, if any: the CRM's own name for
   *  it when it came from Salesforce, else our reference. */
  property_reference: string | null;
  property_slug: string | null;
  /** The consultation a Fast Pre-Approval was invited from. */
  parent_reference: string | null;
  /** The site language the applicant used (`mortgage_requests.locale`). */
  locale?: string | null;
};

/**
 * The walkthrough samples (BZM-26-9xxx) are made with applicants at
 * example.com, a domain reserved by RFC 2606 that no real person can hold.
 * They are skipped, never sent.
 */
export function isSampleMortgageRequest(email: string): boolean {
  return /@example\.com$/i.test(email.trim());
}

export function buildMortgageDescription(row: MortgageLeadRow, siteUrl: string | undefined): string | undefined {
  const lines = [
    `Mortgage request: ${MORTGAGE_SERVICE_CRM_LABEL[row.service]}`,
    `Reference: ${row.reference}`,
    `Residency: ${cmsT(RESIDENCY_KEY[row.residency])}`,
    `Employment: ${cmsT(EMPLOYMENT_KEY[row.employment_type])}`,
    `Started from: ${cmsT(ENTRY_KEY[row.entry_point])}`,
  ];
  if (row.property_price_aed) lines.push(`Desired property price: ${formatAed(row.property_price_aed)}`);
  if (row.property_reference) lines.push(`Property: ${row.property_reference}`);
  if (row.parent_reference) lines.push(`Follows consultation: ${row.parent_reference}`);
  lines.push(`Mortgage file: ${siteOrigin(siteUrl)}/admin/mortgages/${row.reference}`);
  lines.push(`Bazar mortgage request: ${row.id}`);
  return clamp(lines.join("\n"), MAX_DESCRIPTION);
}

/** Pure. Absent fields are absent, as in `buildLeadPayload`. */
export function buildMortgageLeadPayload(row: MortgageLeadRow, siteUrl: string | undefined): LeadPayload {
  const payload: LeadPayload = {
    // A mortgage applicant is financing a purchase, and the request came
    // through the website's own form.
    Lead_Source__c: "Website",
    Inquiry_Type__c: "Buy",
    Mortgage_Service__c: MORTGAGE_SERVICE_CRM_LABEL[row.service],
  };
  const name = clamp(row.full_name, MAX_NAME);
  if (name) payload.Name__c = name;
  const email = clamp(row.email, MAX_EMAIL);
  if (email) payload.Email__c = email;
  applyPhone(payload, row.mobile_e164);
  const description = buildMortgageDescription(row, siteUrl);
  if (description) payload.Description__c = description;
  if (row.property_slug) {
    const url = clamp(`${siteOrigin(siteUrl)}/p/${row.property_slug}`, MAX_URL);
    if (url) payload.Website_Listing_URL__c = url;
  }
  const language = preferredLanguageFor(row.locale);
  if (language) payload.Preferred_Languages__c = language;
  return payload;
}

export function pushMortgageLead(row: MortgageLeadRow, siteUrl: string | undefined): Promise<PushResult> {
  return pushLeadPayload(row.id, buildMortgageLeadPayload(row, siteUrl), "mortgage request");
}
