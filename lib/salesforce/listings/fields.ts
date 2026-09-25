/**
 * What the listing sync reads from Salesforce, and nothing else.
 *
 * An explicit allowlist, never `FIELDS(ALL)` and never the doc's step 4
 * (`GET /sobjects/Listing__c/<id>`), which returns every field the integration
 * user can see — including `OwnerName__c` and `Owner_Contact__c`, the seller's
 * name and phone number. The website has no use for either, and a copy of
 * them here would make this database a processor of personal data it never
 * needed. They are listed below only so a test can prove they stay out.
 *
 * Field names are from a live `describe` of the sandbox (24 Sept 2026), not
 * from the integration guide, which is wrong in several places: `Rooms__c` and
 * `Bathrooms__c` are string picklists ("Studio", "1"…), not numbers;
 * `Latitude__c`/`Longitude__c` are strings; `Listing_Image_URLs__c` arrives
 * comma-separated, not semicolon-separated; and the photos CRM users actually
 * upload live in the rich-text `Listing_Images__c`, which the guide omits.
 *
 * Version 1.2 of the guide (25 Sept) added the fields the website asked for:
 * a real permit expiry (`Permit_Expiry_Date_c__c` — the doubled suffix is the
 * org's, not a typo here), community and sub-community, a website-shaped
 * `Property_Type__c`, and three write-back fields on the listing. It also
 * dropped several of ours from its sample query — the Arabic, the uploaded
 * photos, the agent — which still exist and are still read.
 */

/** `Property_Listing__c` — the listing: the offer, its status and its agent. */
export const LISTING_FIELDS = [
  "Id",
  "Name",
  "LastModifiedDate",
  "Website_Status__c",
  "Website_URL__c",
  "Website_Error__c",
  "Listing_Status__c",
  "Sale_Rent__c",
  "Price__c",
  "Published_Date__c",
  "Website_Published_Date__c",
  "Expired_Date__c",
  "Property__c",
  "Assigned_Agent__c",
] as const;

/** Fields read through `Assigned_Agent__r` (a User). */
export const LISTING_AGENT_FIELDS = ["Name", "Email"] as const;

/** `Listing__c` — the property, read through `Property__r`. */
export const PROPERTY_FIELDS = [
  "Id",
  "Name",
  "LastModifiedDate",
  "Title__c",
  "Title_Arabic__c",
  "Description__c",
  "Description_Arabic__c",
  "Location__c",
  "Community__c",
  "Sub_Community__c",
  "Emirate__c",
  "Category__c",
  "Property_Type__c",
  "PropertyType__c",
  "Property_Type_Bayut_Picklist__c",
  "OfferingType__c",
  "Purpose__c",
  "ProjectStatus__c",
  "Project_Type__c",
  "Project_Name__c",
  "Developer__c",
  "Rooms__c",
  "Bathrooms__c",
  "PropertySizeSqft__c",
  "Plot_Size__c",
  "FurnishingType__c",
  "NoOfParkingSpaces__c",
  "FloorNumber__c",
  "Latitude__c",
  "Longitude__c",
  "PropertyPrice__c",
  "Yearly__c",
  "Rent_Frequency__c",
  "Property_Status__c",
  "RERAPermitNumber__c",
  "Permit_Expiry_Date_c__c",
  "PermitType__c",
  "Reference__c",
  "Listing_ID__c",
  "Amenities__c",
  "Main_Image_URL__c",
  "Listing_Image_URLs__c",
  "Listing_Images__c",
  "Cover_Page_Image__c",
  "Floor_Plans__c",
  "VideoTourURL__c",
  "URLLink360__c",
] as const;

/** Fields read through `Property__r.Agent_Name__r` (a User) — the fallback
 *  agent when the listing has none of its own. */
export const PROPERTY_AGENT_FIELDS = ["Name", "Email"] as const;

/**
 * Never selected. Exported for the test that proves it, and for the next
 * person who wonders why the owner is not on the admin screen.
 */
export const NEVER_READ = ["OwnerName__c", "Owner_Contact__c", "UnitNumber__c", "LandNumber__c", "Comments__c"] as const;

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
  const agent =
    !visible || visible.listing.has("Assigned_Agent__c")
      ? LISTING_AGENT_FIELDS.map((f) => `Assigned_Agent__r.${f}`)
      : [];
  const property = PROPERTY_FIELDS.filter(
    (f) => !visible || visible.property.has(f),
  ).map((f) => `Property__r.${f}`);
  const propertyAgent =
    !visible || visible.property.has("Agent_Name__c")
      ? PROPERTY_AGENT_FIELDS.map((f) => `Property__r.Agent_Name__r.${f}`)
      : [];
  return [...listing, ...agent, ...property, ...propertyAgent].join(", ");
}

/**
 * The `Website_Status__c` values that mean "on the website".
 *
 * The guide filters on Published alone, but the picklist also has
 * Republished, and a listing moved from one to the other must not read as
 * withdrawn: absence from the sweep is half the evidence for taking a listing
 * down. Deactivated and Deleted are the two that mean off.
 */
export const LIVE_WEBSITE_STATUSES = ["Published", "Republished"] as const;

export function isLiveWebsiteStatus(v: string | null | undefined): boolean {
  return !!v && (LIVE_WEBSITE_STATUSES as readonly string[]).includes(v);
}

/** Every listing live on the website, per the CRM, in a stable order so the
 *  pages of a large sweep never overlap. */
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
  Title__c?: string | null;
  Title_Arabic__c?: string | null;
  Description__c?: string | null;
  Description_Arabic__c?: string | null;
  Location__c?: string | null;
  Community__c?: string | null;
  Sub_Community__c?: string | null;
  Emirate__c?: string | null;
  Category__c?: string | null;
  Property_Type__c?: string | null;
  PropertyType__c?: string | null;
  Property_Type_Bayut_Picklist__c?: string | null;
  OfferingType__c?: string | null;
  Purpose__c?: string | null;
  ProjectStatus__c?: string | null;
  Project_Type__c?: string | null;
  Project_Name__c?: string | null;
  Developer__c?: string | null;
  Rooms__c?: string | null;
  Bathrooms__c?: string | null;
  PropertySizeSqft__c?: number | null;
  Plot_Size__c?: number | null;
  FurnishingType__c?: string | null;
  NoOfParkingSpaces__c?: number | null;
  FloorNumber__c?: string | null;
  Latitude__c?: string | null;
  Longitude__c?: string | null;
  PropertyPrice__c?: number | null;
  Yearly__c?: number | null;
  Rent_Frequency__c?: string | null;
  Property_Status__c?: string | null;
  RERAPermitNumber__c?: string | null;
  Permit_Expiry_Date_c__c?: string | null;
  PermitType__c?: string | null;
  Reference__c?: string | null;
  Listing_ID__c?: string | null;
  Amenities__c?: string | null;
  Main_Image_URL__c?: string | null;
  Listing_Image_URLs__c?: string | null;
  Listing_Images__c?: string | null;
  Cover_Page_Image__c?: string | null;
  Floor_Plans__c?: string | null;
  VideoTourURL__c?: string | null;
  URLLink360__c?: string | null;
  Agent_Name__r?: SfUser;
};

export type SfListingRecord = {
  Id: string;
  Name?: string | null;
  LastModifiedDate?: string | null;
  Website_Status__c?: string | null;
  Website_URL__c?: string | null;
  Website_Error__c?: string | null;
  Listing_Status__c?: string | null;
  Sale_Rent__c?: string | null;
  Price__c?: number | null;
  Published_Date__c?: string | null;
  Website_Published_Date__c?: string | null;
  Expired_Date__c?: string | null;
  Property__c?: string | null;
  Assigned_Agent__c?: string | null;
  Assigned_Agent__r?: SfUser;
  Property__r?: SfPropertyRecord | null;
};
