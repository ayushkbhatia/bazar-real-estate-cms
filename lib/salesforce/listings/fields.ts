/**
 * What the listing sync reads from Salesforce, and nothing else.
 *
 * An explicit allowlist, never `FIELDS(ALL)` and never the guide's step 4
 * (`GET /sobjects/Listing__c/<id>`), which returns every field the integration
 * user can see — including `OwnerName__c` and `Owner_Contact__c`, the seller's
 * name and phone number. The website has no use for either, and a copy of
 * them here would make this database a processor of personal data it never
 * needed. They are listed below only so a test can prove they stay out.
 *
 * Since version 1.3 of the guide (Levarus, 5 Oct 2026) the list IS the
 * guide's step-2 query, field for field — the feed Salesforce committed to,
 * built from Bazar's v1.1 requirements. Three things it settled:
 *
 *  - Placement is `Area__c` / `Sub_Area__c`, restricted picklists holding the
 *    website's own area names. `Community__c` and `Sub_Community__c` stay in
 *    Salesforce for the portals and are not part of this feed.
 *  - The advisor comes only from the Property's Assigned Agent, whose API
 *    name is `Agent_Name__c`. The listing's own `Assigned_Agent__c` is not
 *    the source.
 *  - The write-back URL field is `Website_Listing_URL__c`; earlier guides
 *    called it `Website_URL__c`.
 *
 * The fallbacks the sync read before v1.3 (`PropertyType__c`, the Bayut type,
 * `OfferingType__c`, `Purpose__c`, `Project_Type__c`, `PropertyPrice__c`,
 * `Published_Date__c`) are gone with them: each stood in for a field that is
 * now required or restricted in Salesforce, and reading a field outside the
 * contract only means a health-page alarm the day its access is tidied away.
 *
 * Quirks the guide does document, and the sync relies on: `Rooms__c` and
 * `Bathrooms__c` are string picklists ("Studio", "1"…), `Latitude__c` /
 * `Longitude__c` are strings, `Listing_Image_URLs__c` is comma-separated and
 * the photos CRM users upload live in the rich-text `Listing_Images__c`. The
 * permit expiry's doubled suffix (`Permit_Expiry_Date_c__c`) is the org's.
 */

/** `Property_Listing__c` — the listing: the offer and its status. */
export const LISTING_FIELDS = [
  "Id",
  "Name",
  "LastModifiedDate",
  "Website_Status__c",
  "Website_Listing_URL__c",
  "Website_Error__c",
  "Website_Published_Date__c",
  "Listing_Status__c",
  "Sale_Rent__c",
  "Price__c",
  "Expired_Date__c",
  "Published_Platform__c",
  "Property__c",
] as const;

/** `Listing__c` — the property, read through `Property__r`. */
export const PROPERTY_FIELDS = [
  "Id",
  "Name",
  "LastModifiedDate",
  "PropertyText__c",
  "Title__c",
  "Title_Arabic__c",
  "Bathrooms__c",
  "Rooms__c",
  "Emirate__c",
  "Location__c",
  "Area__c",
  "Sub_Area__c",
  "Category__c",
  "Property_Type__c",
  "PropertySizeSqft__c",
  "Plot_Size__c",
  "FurnishingType__c",
  "Handover_Date__c",
  "Short_Description__c",
  "Short_Description_Arabic__c",
  "Description__c",
  "Description_Arabic__c",
  "Tenure__c",
  "Year_Built__c",
  "Rent_Frequency__c",
  "Yearly__c",
  "Property_Status__c",
  "NoOfParkingSpaces__c",
  "FloorNumber__c",
  "View__c",
  "View_Arabic__c",
  "Orientation__c",
  "Orientation_Arabic__c",
  "Service_Charge_Sqft__c",
  "Amenities__c",
  "Website_Amenities__c",
  "Exclusive__c",
  "Vacant_On_Transfer__c",
  "Project__c",
  "ProjectStatus__c",
  "Developer__c",
  "PermitType__c",
  "RERAPermitNumber__c",
  "Permit_Expiry_Date_c__c",
  "Latitude__c",
  "Longitude__c",
  "Main_Image_URL__c",
  "Cover_Page_Image__c",
  "Listing_Images__c",
  "Listing_Image_URLs__c",
  "Floor_Plans__c",
  "URLLink360__c",
  "VideoTourURL__c",
  // The Assigned Agent lookup itself: the User's id, which is what an admin's
  // mapping is keyed on when the User's email is not readable.
  "Agent_Name__c",
] as const;

/** Read through `Property__r.Project__r` (the Project record). */
export const PROPERTY_PROJECT_FIELDS = ["Name"] as const;

/** Read through `Property__r.Agent_Name__r` (a User) — the advisor. */
export const PROPERTY_AGENT_FIELDS = ["Name", "Email"] as const;

/**
 * Never selected. Exported for the test that proves it, and for the next
 * person who wonders why the owner is not on the admin screen.
 */
export const NEVER_READ = ["OwnerName__c", "Owner_Contact__c", "UnitNumber__c", "LandNumber__c", "Comments__c"] as const;

/**
 * Fields Salesforce still has that v1.3 of the guide takes out of the website
 * feed. Not read, so a test can hold the line: the portals' communities and
 * the listing-level agent must never creep back in as a second source.
 */
export const NOT_IN_WEBSITE_FEED = [
  "Community__c",
  "Sub_Community__c",
  "Assigned_Agent__c",
  "Website_URL__c",
] as const;

/**
 * Without these the sweep means nothing, so a describe that hides one of them
 * fails the run rather than quietly reading around it.
 */
export const REQUIRED_LISTING_FIELDS: ReadonlySet<string> = new Set([
  "Id",
  "Name",
  "Website_Status__c",
  "Property__c",
]);

export type FieldVisibility = {
  listing: ReadonlySet<string>;
  property: ReadonlySet<string>;
};

/**
 * The SELECT list, optionally narrowed to what a describe says the
 * integration user can read. One field the org hides would otherwise fail the
 * whole query with INVALID_FIELD; narrowing lets every other listing keep
 * syncing while the missing field is reported.
 */
export function selectList(visible?: FieldVisibility): string {
  const listing = LISTING_FIELDS.filter((f) => !visible || visible.listing.has(f));
  const property = PROPERTY_FIELDS.filter(
    (f) => !visible || visible.property.has(f),
  ).map((f) => `Property__r.${f}`);
  const project =
    !visible || visible.property.has("Project__c")
      ? PROPERTY_PROJECT_FIELDS.map((f) => `Property__r.Project__r.${f}`)
      : [];
  const agent =
    !visible || visible.property.has("Agent_Name__c")
      ? PROPERTY_AGENT_FIELDS.map((f) => `Property__r.Agent_Name__r.${f}`)
      : [];
  return [...listing, ...property, ...project, ...agent].join(", ");
}

/**
 * The `Website_Status__c` values that mean "on the website".
 *
 * Absence from the sweep is half the evidence for taking a listing down, so a
 * listing moved from Published to Republished must not read as withdrawn.
 * Deactivated and Deleted are the two that mean off.
 */
export const LIVE_WEBSITE_STATUSES = ["Published", "Republished"] as const;

export function isLiveWebsiteStatus(v: string | null | undefined): boolean {
  return !!v && (LIVE_WEBSITE_STATUSES as readonly string[]).includes(v);
}

/**
 * Every listing live on the website, per the CRM.
 *
 * Ordered by Id, not by the guide's `LastModifiedDate DESC`: a sweep that
 * runs to several pages must not see a record twice, or miss one, because it
 * was edited between two pages. Recency means nothing to a full sweep.
 */
export function sweepSoql(visible?: FieldVisibility): string {
  const statuses = LIVE_WEBSITE_STATUSES.map((v) => `'${v}'`).join(", ");
  return `SELECT ${selectList(visible)} FROM Property_Listing__c WHERE Website_Status__c IN (${statuses}) ORDER BY Id`;
}

/** Salesforce ids are 15 or 18 alphanumerics. Anything else never reaches a
 *  SOQL string — ids are interpolated, so this is the injection guard. */
export const SF_ID_RE = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

function idList(ids: readonly string[]): string {
  const safe = ids.filter((id) => SF_ID_RE.test(id));
  return safe.map((id) => `'${id}'`).join(", ");
}

/** The status of listings missing from the sweep — the evidence a withdrawal
 *  needs. */
export function statusSoql(ids: readonly string[]): string | null {
  const list = idList(ids);
  if (!list) return null;
  return `SELECT Id, Website_Status__c, Listing_Status__c FROM Property_Listing__c WHERE Id IN (${list})`;
}

/** Deleted listings among `ids` — run through `queryAll`, which is the only
 *  endpoint that sees the recycle bin. */
export function deletedSoql(ids: readonly string[]): string | null {
  const list = idList(ids);
  if (!list) return null;
  return `SELECT Id FROM Property_Listing__c WHERE IsDeleted = true AND Id IN (${list})`;
}

/** The raw record shape, as far as we read it. Every field may be absent: a
 *  field the org hides is simply not in the SELECT. */
export type SfUser = { Name?: string | null; Email?: string | null } | null;

export type SfPropertyRecord = {
  Id?: string | null;
  Name?: string | null;
  LastModifiedDate?: string | null;
  PropertyText__c?: string | null;
  Title__c?: string | null;
  Title_Arabic__c?: string | null;
  Bathrooms__c?: string | null;
  Rooms__c?: string | null;
  Emirate__c?: string | null;
  Location__c?: string | null;
  Area__c?: string | null;
  Sub_Area__c?: string | null;
  Category__c?: string | null;
  Property_Type__c?: string | null;
  PropertySizeSqft__c?: number | null;
  Plot_Size__c?: number | null;
  FurnishingType__c?: string | null;
  Handover_Date__c?: string | null;
  Short_Description__c?: string | null;
  Short_Description_Arabic__c?: string | null;
  Description__c?: string | null;
  Description_Arabic__c?: string | null;
  Tenure__c?: string | null;
  Year_Built__c?: number | string | null;
  Rent_Frequency__c?: string | null;
  Yearly__c?: number | null;
  Property_Status__c?: string | null;
  NoOfParkingSpaces__c?: number | null;
  FloorNumber__c?: string | null;
  View__c?: string | null;
  View_Arabic__c?: string | null;
  Orientation__c?: string | null;
  Orientation_Arabic__c?: string | null;
  Service_Charge_Sqft__c?: number | null;
  Amenities__c?: string | null;
  Website_Amenities__c?: string | null;
  Exclusive__c?: boolean | null;
  Vacant_On_Transfer__c?: boolean | null;
  Project__c?: string | null;
  Project__r?: { Name?: string | null } | null;
  ProjectStatus__c?: string | null;
  Developer__c?: string | null;
  PermitType__c?: string | null;
  RERAPermitNumber__c?: string | null;
  Permit_Expiry_Date_c__c?: string | null;
  Latitude__c?: string | null;
  Longitude__c?: string | null;
  Main_Image_URL__c?: string | null;
  Cover_Page_Image__c?: string | null;
  Listing_Images__c?: string | null;
  Listing_Image_URLs__c?: string | null;
  Floor_Plans__c?: string | null;
  URLLink360__c?: string | null;
  VideoTourURL__c?: string | null;
  Agent_Name__c?: string | null;
  Agent_Name__r?: SfUser;
};

export type SfListingRecord = {
  Id: string;
  Name?: string | null;
  LastModifiedDate?: string | null;
  Website_Status__c?: string | null;
  Website_Listing_URL__c?: string | null;
  Website_Error__c?: string | null;
  Website_Published_Date__c?: string | null;
  Listing_Status__c?: string | null;
  Sale_Rent__c?: string | null;
  Price__c?: number | null;
  Expired_Date__c?: string | null;
  Published_Platform__c?: string | null;
  Property__c?: string | null;
  Property__r?: SfPropertyRecord | null;
};
