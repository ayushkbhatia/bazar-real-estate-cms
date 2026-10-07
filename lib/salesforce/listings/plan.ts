import type { Database } from "@/db/types";
import { plainTextToHtml } from "@/lib/plain-text-html";
import type { ImageRef, ListingSnapshot } from "./snapshot";

/**
 * From a CRM listing to a website listing: what the row would say, and every
 * reason it cannot be published yet.
 *
 * Pure. Given the same snapshot and the same lookups it returns the same plan,
 * which is what lets an admin's mapping or approval re-apply instantly from
 * the stored snapshot instead of waiting for the next sweep.
 *
 * Holds carry `fix` so the admin screen can say who has to act:
 *   · salesforce — the CRM record is missing something; only the CRM team can
 *                  fill it, and the message names the Salesforce field.
 *   · website    — the value is there but means nothing to us yet (an area
 *                  the website does not have, a developer we do not list); an
 *                  admin maps it once and every listing using it follows.
 *   · wait       — nothing to do; photos are still being copied.
 *
 * The field contract is v1.3 of the Published Listings guide (Levarus,
 * 5 Oct 2026), which Salesforce built from Bazar's v1.1 requirements: every
 * fact the listing page shows has a Salesforce field, in values the website
 * recognises, and the messages here name those fields.
 */

type PropertyType = Database["public"]["Enums"]["property_type"];
type PropertyMode = Database["public"]["Enums"]["property_mode"];
type PropertyForm = Database["public"]["Enums"]["property_form"];
type PropertySegment = Database["public"]["Enums"]["property_segment"];
type PropertyFurnishing = Database["public"]["Enums"]["property_furnishing"];
type PropertyTenure = Database["public"]["Enums"]["property_tenure"];
type AreaKind = Database["public"]["Enums"]["area_kind"];

export type HoldCode =
  | "listing_inactive"
  | "property_unavailable"
  | "listing_expired"
  | "permit_expired"
  | "no_title"
  | "no_offering"
  | "no_price"
  | "rent_not_yearly"
  | "no_rent_frequency"
  | "rent_price_mismatch"
  | "no_type"
  | "unsupported_type"
  | "no_sale_form"
  | "no_bedrooms"
  | "no_bathrooms"
  | "no_location"
  | "unmapped_location"
  | "no_developer"
  | "unmapped_developer"
  | "no_permit_number"
  | "no_permit_expiry"
  | "no_photos"
  | "photos_unavailable"
  | "photos_pending"
  | "gate";

export type Hold = {
  code: HoldCode;
  message: string;
  fix: "salesforce" | "website" | "wait";
};

export type Note = { code: string; message: string };

export type Unresolved = {
  /** The listing's `Sub_Area__c, Area__c`, as the admin screen offers it for
   *  mapping. Set when the area is not on the website (the listing is held),
   *  and when only the sub-area is not (the listing is placed in the area). */
  location?: string;
  developer?: string;
  agent?: { email: string | null; name: string | null; id: string | null };
  /** A Project the website has no project page for. Noted, not held: the
   *  listing publishes without the link to its project. */
  project?: string;
};

export type AreaLookup = {
  id: string;
  name: string;
  name_ar?: string | null;
  slug: string;
  kind: AreaKind;
  parent_id: string | null;
};

export type DevelopmentLookup = {
  id: string;
  name: string;
  name_ar: string | null;
  slug: string;
};

export type Lookups = {
  areas: AreaLookup[];
  developers: { id: string; name: string }[];
  /** The website's projects — `developments` — for `Project__r.Name`. */
  developments: DevelopmentLookup[];
  /** Lower-cased email → staff user_id, active staff only. */
  staffByEmail: ReadonlyMap<string, string>;
  /** Active amenity taxonomy labels, as listings store them. */
  amenityLabels: readonly string[];
  /** Admin-resolved answers, keyed by the normalised source value. */
  mappings: {
    location: ReadonlyMap<string, string>;
    developer: ReadonlyMap<string, string>;
    agent: ReadonlyMap<string, string>;
  };
};

/**
 * The columns the sync owns on a Salesforce listing. Everything not named
 * here — slug, reference, SEO, the advisor note, featured flags, the card
 * labels other than the two built-ins — belongs to the website and is never
 * touched after creation.
 */
export type SyncedFields = {
  title: string;
  short_description: string | null;
  description: string | null;
  mode: PropertyMode;
  segment: PropertySegment;
  type: PropertyType;
  property_form: PropertyForm | null;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  plot_ft2: number | null;
  furnishing: PropertyFurnishing | null;
  parking_bays: number | null;
  floor: number | null;
  year_built: number | null;
  tenure: PropertyTenure | null;
  view: string | null;
  orientation: string | null;
  service_charge_per_ft2: number | null;
  geo: { lat: number; lng: number } | null;
  price_aed: number;
  area_id: string | null;
  sub_community_id: string | null;
  building_id: string | null;
  /** Composed from the project and the area, in the house style the live
   *  listings use ("Yas Riva Reserve, Yas Island"), in both languages, from
   *  the website's own names. */
  address_line: string | null;
  address_line_ar: string | null;
  development_id: string | null;
  developer_id: string | null;
  amenities: string[];
  listing_permit_no: string | null;
  listing_permit_expires_at: string | null;
  /**
   * The Arabic twins of CRM-owned English. Present when the CRM wrote the
   * Arabic, or when the English is blank (so the twin is cleared with it — an
   * Arabic view with no English one is a fact the English page does not have).
   * Absent when the CRM wrote the English only: the website's own twin — an
   * editor's, or the translator's — is left exactly as it is.
   */
  title_ar?: string | null;
  short_description_ar?: string | null;
  description_ar?: string | null;
  view_ar?: string | null;
  orientation_ar?: string | null;
  /** Only when resolved. An unmapped CRM agent never clears the advisor an
   *  editor put on the listing. */
  assigned_agent_id?: string;
};

/**
 * The columns an editor cannot change on a Salesforce listing, because the
 * next sync would change them back. The Arabic twins and the advisor are only
 * the CRM's some of the time — see `SyncedFields` and
 * `salesforceTwinColumns` — so they are not listed.
 */
export const SALESFORCE_OWNED_COLUMNS = [
  "title",
  "short_description",
  "description",
  "mode",
  "segment",
  "type",
  "property_form",
  "beds",
  "baths",
  "built_up_ft2",
  "plot_ft2",
  "furnishing",
  "parking_bays",
  "floor",
  "year_built",
  "tenure",
  "view",
  "orientation",
  "service_charge_per_ft2",
  "geo",
  "price_aed",
  "area_id",
  "sub_community_id",
  "building_id",
  "address_line",
  "address_line_ar",
  "development_id",
  "developer_id",
  "amenities",
  "listing_permit_no",
  "listing_permit_expires_at",
] as const satisfies readonly (keyof SyncedFields)[];

/** Each Arabic twin, the snapshot fields it comes from, and the editor's own
 *  length cap (lib/schemas/property.ts) — a synced value the editor's form
 *  would refuse would make every later save of the listing fail. */
const TWINS = [
  { column: "title_ar", english: "title", arabic: "titleAr", max: 160, html: false },
  { column: "short_description_ar", english: "shortDescription", arabic: "shortDescriptionAr", max: 480, html: false },
  { column: "description_ar", english: "description", arabic: "descriptionAr", max: null, html: true },
  { column: "view_ar", english: "view", arabic: "viewAr", max: 150, html: false },
  { column: "orientation_ar", english: "orientation", arabic: "orientationAr", max: 120, html: false },
] as const satisfies readonly {
  column: keyof SyncedFields;
  english: keyof ListingSnapshot;
  arabic: keyof ListingSnapshot;
  max: number | null;
  html: boolean;
}[];

/**
 * The Arabic twins Salesforce owns on this listing right now: the ones it
 * wrote, and the ones whose English it leaves blank. The editor's save guard
 * and the sync both ask this, so they cannot disagree about whose a field is.
 */
export function salesforceTwinColumns(
  s: Pick<ListingSnapshot, (typeof TWINS)[number]["english"] | (typeof TWINS)[number]["arabic"]>,
): string[] {
  return TWINS.filter((t) => !s[t.english] || !!s[t.arabic]).map((t) => t.column);
}

export type CardFlags = {
  /** `Exclusive__c` / `Vacant_On_Transfer__c`. Null when the org hides the
   *  field: the website's own label is then left as it is. */
  exclusive: boolean | null;
  vacant_on_transfer: boolean | null;
};

export type ListingPlan = {
  /** Enough to be a row at all: `properties` has NOT NULL title, mode, type
   *  and price. A listing short of that lives only on the mirror. */
  fields: SyncedFields | null;
  cardFlags: CardFlags;
  holds: Hold[];
  notes: Note[];
  unresolved: Unresolved;
  images: { cover: ImageRef | null; gallery: ImageRef[]; floorPlan: ImageRef | null };
};

// ── vocabulary ──────────────────────────────────────────────────────────

/** Lower-case, accents and apostrophes gone, punctuation to spaces. */
export function normKey(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

type TypeMapping = { type: PropertyType; segment?: PropertySegment } | null;

/**
 * `Property_Type__c` — the restricted website type picklist (guide v1.2,
 * extended in v1.3 with Hotel Apartment and Commercial Villa). "Other" has no
 * honest equivalent and holds the listing; so does a value this table has
 * never seen, which is a picklist value added without telling the website.
 */
const WEBSITE_TYPES: Record<string, TypeMapping> = {
  apartment: { type: "apartment" },
  villa: { type: "villa" },
  townhouse: { type: "townhouse" },
  penthouse: { type: "penthouse" },
  "hotel apartment": { type: "hotel_apartment" },
  "hotel apartments": { type: "hotel_apartment" },
  land: { type: "land" },
  plot: { type: "land" },
  office: { type: "office", segment: "commercial" },
  retail: { type: "retail", segment: "commercial" },
  showroom: { type: "retail", segment: "commercial" },
  warehouse: { type: "commercial", segment: "commercial" },
  "commercial villa": { type: "commercial_villa", segment: "commercial" },
  "full building": { type: "building" },
  building: { type: "building" },
  other: null,
};

const COMMERCIAL_TYPES: ReadonlySet<PropertyType> = new Set([
  "office",
  "retail",
  "commercial",
  "commercial_villa",
]);

/** Types where a bedroom count is part of what is being sold. */
const ROOMED_TYPES: ReadonlySet<PropertyType> = new Set([
  "apartment",
  "villa",
  "penthouse",
  "townhouse",
  "hotel_apartment",
]);

const PROJECT_STATUS_FORMS: Record<string, PropertyForm> = {
  "resale ready to move": "resale",
  "resale off plan": "off_plan",
  "primary ready to move": "ready_new",
  "primary off plan": "off_plan",
};

const FURNISHINGS: Record<string, PropertyFurnishing> = {
  unfurnished: "unfurnished",
  "partly furnished": "semi",
  "semi furnished": "semi",
  // v1.2 spelled the picklist value without the space.
  semifurnished: "semi",
  "fully furnished": "fully",
  furnished: "fully",
};

const TENURES: Record<string, PropertyTenure> = {
  freehold: "freehold",
  leasehold: "leasehold",
  usufruct: "usufruct",
};

/**
 * `Orientation__c` holds the eight compass points as letters ("E" in the v1.3
 * samples) — written out for the page, which shows the word. The Arabic is
 * Salesforce's formula field and is taken as it is.
 */
const COMPASS: Record<string, string> = {
  n: "North",
  north: "North",
  ne: "North-East",
  "north east": "North-East",
  northeast: "North-East",
  e: "East",
  east: "East",
  se: "South-East",
  "south east": "South-East",
  southeast: "South-East",
  s: "South",
  south: "South",
  sw: "South-West",
  "south west": "South-West",
  southwest: "South-West",
  w: "West",
  west: "West",
  nw: "North-West",
  "north west": "North-West",
  northwest: "North-West",
};

/** The rent frequencies that mean the price is already annual. */
const YEARLY = new Set(["yearly", "annual", "annually", "per year", "year"]);

/**
 * `Amenities__c` speaks Property Finder's vocabulary; the website's taxonomy
 * is its own. Most terms match once apostrophes and hyphens are ignored
 * ("Maids Room" is "Maid’s Room"). These are the ones that don't. The target
 * is looked up in the live taxonomy, so a label an editor renames degrades to
 * "unmapped" in the notes rather than writing a word the taxonomy no longer
 * has. `Website_Amenities__c` already uses the website's own words.
 */
const AMENITY_ALIASES: Record<string, string> = {
  "central a c": "Central Air Conditioning",
  "shared pool": "Swimming Pool",
  "shared spa": "Spa",
  "shared gym": "Gym",
  "childrens pool": "Kids’ Pool",
  "childrens play area": "Kids’ Play Area",
  "concierge service": "Concierge",
  "pets allowed": "Pet friendly",
  study: "Study Room",
  "private pool": "Private Swimming Pool",
  "private jacuzzi": "Jacuzzi",
  "built in kitchen": "Fully Fitted Kitchen",
  appliances: "Kitchen Appliances",
  "barbecue area": "BBQ Terraces",
  "lobby in building": "Lobby",
  security: "24/7 Security",
  "view of water": "Waterfront Views",
};

/** `View__c` values whose amenity is named differently in the taxonomy. The
 *  rest match on the word, singular or plural ("Garden View" → "Garden
 *  Views"). A view with no amenity is still shown in the specification. */
const VIEW_AMENITY_ALIASES: Record<string, string> = {
  "skyline view": "Abu Dhabi Skyline Views",
};

/** Words that are part of an area's name on one side and not the other:
 *  "Yas" and "Yas Island", "Masdar" and "Masdar City". */
const AREA_SUFFIXES = /\s+(island|city|community|district)$/;

const DEVELOPER_SUFFIXES =
  /\b(properties|property|developments|development|developers|developer|real estate|realty|group|holdings|holding|pjsc|llc|company|co)\b/g;

export function developerKey(name: string): string {
  return normKey(name).replace(DEVELOPER_SUFFIXES, " ").replace(/\s+/g, " ").trim();
}

export function locationKey(location: string): string {
  return normKey(location);
}

export function agentKey(agent: { email: string | null; id: string | null }): string | null {
  if (agent.email) return agent.email.toLowerCase();
  if (agent.id) return `sf:${agent.id}`;
  return null;
}

/** "Saadiyat Lagoons, Saadiyat Island" — the question the admin screen asks
 *  when a listing's place is not on the website. */
export function areaText(s: Pick<ListingSnapshot, "area" | "subArea">): string | null {
  const parts = [s.subArea, s.area].filter((v): v is string => !!v);
  return parts.length ? parts.join(", ") : null;
}

// ── resolvers ───────────────────────────────────────────────────────────

export type ResolvedArea = {
  area_id: string | null;
  sub_community_id: string | null;
  building_id: string | null;
};

function rootEmirate(area: AreaLookup, byId: Map<string, AreaLookup>): AreaLookup | null {
  let cur: AreaLookup | undefined = area;
  for (let i = 0; cur && i < 8; i++) {
    if (cur.kind === "emirate") return cur;
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return null;
}

function placeOf(area: AreaLookup, byId: Map<string, AreaLookup>): ResolvedArea | null {
  if (area.kind === "area") {
    return { area_id: area.id, sub_community_id: null, building_id: null };
  }
  if (area.kind === "sub_community") {
    const parent = area.parent_id ? byId.get(area.parent_id) : undefined;
    return {
      area_id: parent?.kind === "area" ? parent.id : null,
      sub_community_id: area.id,
      building_id: null,
    };
  }
  if (area.kind === "building") {
    let cur = area.parent_id ? byId.get(area.parent_id) : undefined;
    let sub: string | null = null;
    for (let i = 0; cur && i < 8; i++) {
      if (cur.kind === "sub_community") sub = cur.id;
      if (cur.kind === "area") {
        return { area_id: cur.id, sub_community_id: sub, building_id: area.id };
      }
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return { area_id: null, sub_community_id: sub, building_id: area.id };
  }
  // An emirate is too coarse to be a listing's location.
  return null;
}

/**
 * The one candidate a name means, or nothing. Exact first, by name or slug;
 * then forgiving a missing "Island" or "City" — but only if that still leaves
 * exactly one. Guessing between two would publish a listing in the wrong
 * place, which is worse than holding it.
 */
function uniqueByName(candidates: AreaLookup[], value: string): AreaLookup | null {
  const want = normKey(value);
  const loose = (s: string) => s.replace(AREA_SUFFIXES, "");
  for (const strict of [true, false]) {
    const hits = candidates.filter((a) => {
      const name = normKey(a.name);
      const slug = normKey(a.slug);
      return strict
        ? name === want || slug === want
        : loose(name) === loose(want) || loose(slug) === loose(want);
    });
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return null;
  }
  return null;
}

/**
 * `Area__c` and `Sub_Area__c` (guide v1.3) to the website's area tree.
 *
 * Both are restricted picklists holding the website's own names (Bazar's v1.1
 * Appendix A), so in the normal case this is an exact match: the area among
 * areas, the sub-area among that area's own sub-communities. An admin's
 * mapping wins over the match, for the day a value reaches Salesforce before
 * the website has the area.
 *
 * `Emirate__c`, when set, must agree with the area's emirate — the picklists
 * are dependent in Salesforce, and this keeps them so here. A sub-area the
 * website does not have under that area places the listing in the area and
 * says so (`subAreaMissed`); it is never looked for anywhere else.
 */
export function resolveWebsiteArea(
  area: string,
  subArea: string | null,
  emirate: string | null,
  lookups: Lookups,
): { place: ResolvedArea; subAreaMissed: boolean } | null {
  const byId = new Map(lookups.areas.map((a) => [a.id, a]));
  const mapped = (key: string) => {
    const id = lookups.mappings.location.get(locationKey(key));
    return id ? (byId.get(id) ?? null) : null;
  };

  const whole = areaText({ area, subArea });
  const answered = whole ? mapped(whole) : null;
  if (answered) {
    const place = placeOf(answered, byId);
    return place ? { place, subAreaMissed: false } : null;
  }

  const wantEmirate = emirate ? normKey(emirate) : null;
  const inEmirate = (a: AreaLookup) => {
    if (!wantEmirate) return true;
    const root = rootEmirate(a, byId);
    return !!root && normKey(root.name) === wantEmirate;
  };

  const top =
    mapped(area) ??
    uniqueByName(
      lookups.areas.filter((a) => a.kind === "area" && inEmirate(a)),
      area,
    );
  if (!top) return null;
  const place = placeOf(top, byId);
  if (!place?.area_id) return null;
  if (!subArea || place.sub_community_id) return { place, subAreaMissed: false };

  const sub = uniqueByName(
    lookups.areas.filter((a) => a.kind === "sub_community" && a.parent_id === place.area_id),
    subArea,
  );
  return sub
    ? { place: { ...place, sub_community_id: sub.id }, subAreaMissed: false }
    : { place, subAreaMissed: true };
}

export function resolveDeveloper(name: string, lookups: Lookups): string | null {
  const key = developerKey(name);
  if (!key) return null;
  const mapped = lookups.mappings.developer.get(key);
  if (mapped) {
    return lookups.developers.some((d) => d.id === mapped) ? mapped : null;
  }
  const hits = lookups.developers.filter((d) => developerKey(d.name) === key);
  return hits.length === 1 ? hits[0].id : null;
}

/** `Project__r.Name` to the website's project, by name or slug — Bazar asked
 *  for the Project records to be named as the project pages are. */
export function resolveProject(name: string, lookups: Lookups): DevelopmentLookup | null {
  const key = normKey(name);
  if (!key) return null;
  const hits = lookups.developments.filter((d) => normKey(d.name) === key || normKey(d.slug) === key);
  return hits.length === 1 ? hits[0] : null;
}

export function resolveAgent(
  agent: { email: string | null; id: string | null },
  lookups: Lookups,
): string | null {
  const key = agentKey(agent);
  if (!key) return null;
  return lookups.mappings.agent.get(key) ?? (agent.email ? lookups.staffByEmail.get(agent.email.toLowerCase()) ?? null : null);
}

export function mapAmenities(
  values: readonly string[],
  labels: readonly string[],
): { mapped: string[]; unmapped: string[] } {
  const byKey = new Map<string, string>();
  for (const label of labels) {
    const k = normKey(label);
    if (!byKey.has(k)) byKey.set(k, label);
  }
  const mapped: string[] = [];
  const unmapped: string[] = [];
  for (const v of values) {
    const k = normKey(v);
    const alias = AMENITY_ALIASES[k];
    const label = byKey.get(k) ?? (alias ? byKey.get(normKey(alias)) : undefined);
    if (label) {
      if (!mapped.includes(label)) mapped.push(label);
    } else if (!unmapped.includes(v)) {
      unmapped.push(v);
    }
  }
  return { mapped, unmapped };
}

/** The amenity a view stands for, so nobody has to tick it twice (Bazar's
 *  v1.1, W4). Null when the taxonomy has none. */
export function viewAmenity(view: string, labels: readonly string[]): string | null {
  const key = normKey(view);
  const alias = VIEW_AMENITY_ALIASES[key];
  const singular = (s: string) => s.replace(/s$/, "");
  for (const label of labels) {
    const k = normKey(label);
    if (alias ? k === normKey(alias) : singular(k) === singular(key)) return label;
  }
  return null;
}

function typeOf(s: ListingSnapshot): TypeMapping | undefined {
  return s.websiteType ? WEBSITE_TYPES[normKey(s.websiteType)] : undefined;
}

function formOf(s: ListingSnapshot): PropertyForm | null {
  return s.projectStatus ? (PROJECT_STATUS_FORMS[normKey(s.projectStatus)] ?? null) : null;
}

function aed(n: number): string {
  return `AED ${n.toLocaleString("en")}`;
}

function priceFor(s: ListingSnapshot, notes: Note[], holds: Hold[]): number | null {
  if (s.offering === "Sale") return s.listingPrice;

  // Rent. The website shows yearly rent, as the Abu Dhabi market quotes it,
  // and the guide makes the frequency required for a website rental.
  if (!s.rentFrequency) {
    holds.push({
      code: "no_rent_frequency",
      fix: "salesforce",
      message: "Rent_Frequency__c on the Property is blank. A rental needs it, so the website knows the price is a yearly rent.",
    });
    return s.listingPrice ?? s.yearlyRent;
  }
  if (!YEARLY.has(normKey(s.rentFrequency))) {
    if (s.yearlyRent) {
      notes.push({
        code: "rent_from_yearly",
        message: `Rent is quoted ${s.rentFrequency.toLowerCase()} in Salesforce; the website shows the yearly figure from Yearly__c.`,
      });
      return s.yearlyRent;
    }
    holds.push({
      code: "rent_not_yearly",
      fix: "salesforce",
      message: `Rent is quoted ${s.rentFrequency.toLowerCase()} and the website shows yearly rent. Fill Yearly__c on the Property.`,
    });
    return null;
  }
  if (s.listingPrice && s.yearlyRent && s.listingPrice !== s.yearlyRent) {
    // The production sweep of 1 Oct 2026 found exactly this: a sale price in
    // Price__c on a rental. Publishing either figure would be a guess.
    holds.push({
      code: "rent_price_mismatch",
      fix: "salesforce",
      message: `Price__c (${aed(s.listingPrice)}) and Yearly__c (${aed(s.yearlyRent)}) disagree. For a yearly rental, Price__c is the annual rent.`,
    });
    return s.listingPrice;
  }
  return s.listingPrice ?? s.yearlyRent;
}

function dayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

function today(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function isPastDate(isoDate: string, now: Date): boolean {
  return dayOf(isoDate) < today(now);
}

/**
 * The year the page shows: `Year_Built__c` for a completed home, the year of
 * `Handover_Date__c` for off-plan — the expected completion, per Bazar's v1.0
 * and v1.1 — and a past handover year when a completed home has no year
 * built. Outside 1900–2100 is a typing error, and noted rather than shown.
 */
function yearBuiltOf(s: ListingSnapshot, form: PropertyForm | null, now: Date, notes: Note[]): number | null {
  const handover = s.handoverOn ? Number(s.handoverOn.slice(0, 4)) : null;
  const handedOver = s.handoverOn ? !(dayOf(s.handoverOn) > today(now)) : false;
  const year = form === "off_plan" ? (handover ?? s.yearBuilt) : (s.yearBuilt ?? (handedOver ? handover : null));
  if (year == null) return null;
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    notes.push({ code: "year_out_of_range", message: `${year} is not a year between 1900 and 2100, so no year built is shown.` });
    return null;
  }
  return year;
}

function clip(v: string | null, max: number): string | null {
  return v ? v.slice(0, max).trim() || null : null;
}

/**
 * The address line under the map, in the house style the live listings use —
 * "Yas Riva Reserve, Yas Island", "الغدير جاردنز، أبوظبي" — built only from
 * the website's own names, so the Arabic is the website's Arabic: the project
 * when it has a project page, else the sub-area, then the area.
 */
function addressOf(
  place: ResolvedArea,
  development: DevelopmentLookup | null,
  lookups: Lookups,
): { en: string | null; ar: string | null } {
  const byId = new Map(lookups.areas.map((a) => [a.id, a]));
  const area = place.area_id ? byId.get(place.area_id) : undefined;
  if (!area) return { en: null, ar: null };
  const sub = place.sub_community_id ? byId.get(place.sub_community_id) : undefined;
  const parts: { en: string; ar: string | null }[] = [];
  if (development) parts.push({ en: development.name, ar: development.name_ar });
  else if (sub) parts.push({ en: sub.name, ar: sub.name_ar ?? null });
  if (!parts.some((p) => normKey(p.en) === normKey(area.name))) {
    parts.push({ en: area.name, ar: area.name_ar ?? null });
  }
  return {
    en: clip(parts.map((p) => p.en).join(", "), 200),
    ar: clip(parts.map((p) => p.ar ?? p.en).join("، "), 360),
  };
}

// ── the plan ────────────────────────────────────────────────────────────

export function planListing(s: ListingSnapshot, lookups: Lookups, now: Date): ListingPlan {
  const holds: Hold[] = [];
  const notes: Note[] = [];
  const unresolved: Unresolved = {};

  // Lifecycle first: none of the rest matters for a listing that is over.
  if (s.listingStatus && normKey(s.listingStatus) !== "active") {
    holds.push({
      code: "listing_inactive",
      fix: "salesforce",
      message: `Listing_Status__c is "${s.listingStatus}". Set it to Active, or unpublish the listing.`,
    });
  }
  const status = s.propertyStatus ? normKey(s.propertyStatus) : null;
  if (status === "sold" || status === "rented") {
    holds.push({
      code: "property_unavailable",
      fix: "salesforce",
      message: `The Property is marked ${s.propertyStatus}. Unpublish the listing in Salesforce.`,
    });
  } else if (status === "reserved") {
    notes.push({ code: "reserved", message: "The Property is marked Reserved." });
  }
  if (s.expiresOn && isPastDate(s.expiresOn, now)) {
    holds.push({
      code: "listing_expired",
      fix: "salesforce",
      message: `The listing expired on ${s.expiresOn} (Expired_Date__c).`,
    });
  }
  if (s.platforms.length && !s.platforms.some((p) => normKey(p) === "website")) {
    notes.push({
      code: "platform_without_website",
      message: `Published_Platform__c is "${s.platforms.join("; ")}", without Website — yet the listing is published for the website.`,
    });
  }

  if (!s.title || s.title.length < 3) {
    holds.push({ code: "no_title", fix: "salesforce", message: "Title__c on the Property is blank." });
  }

  // Transaction and completion.
  let mode: PropertyMode | null = null;
  let form: PropertyForm | null = null;
  if (!s.offering) {
    holds.push({
      code: "no_offering",
      fix: "salesforce",
      message: "Sale_Rent__c on the listing is blank, so it is not clear whether this is for sale or to rent.",
    });
  } else if (s.offering === "Rent") {
    mode = "rent";
  } else {
    form = formOf(s);
    mode = form === "off_plan" ? "off_plan" : "buy";
    if (!form) {
      holds.push({
        code: "no_sale_form",
        fix: "salesforce",
        message:
          "ProjectStatus__c on the Property is blank, so the website cannot tell off-plan from ready or resale.",
      });
    }
  }

  const price = s.offering ? priceFor(s, notes, holds) : null;
  if (s.offering && price == null && !holds.some((h) => h.code === "rent_not_yearly")) {
    holds.push({
      code: "no_price",
      fix: "salesforce",
      message:
        s.offering === "Sale"
          ? "Price__c on the listing is blank."
          : "Price__c on the listing and Yearly__c on the Property are both blank.",
    });
  } else if (price != null) {
    const low = s.offering === "Sale" ? price < 50_000 : price < 5_000;
    if (low) {
      notes.push({ code: "price_low", message: `${aed(price)} looks low for a ${s.offering === "Sale" ? "sale" : "yearly rent"}.` });
    }
  }

  // What it is.
  const mapping = typeOf(s);
  let type: PropertyType | null = null;
  let segmentHint: PropertySegment | undefined;
  if (mapping) {
    type = mapping.type;
    segmentHint = mapping.segment;
  } else if (s.websiteType) {
    holds.push({
      code: "unsupported_type",
      fix: "salesforce",
      message: `The website has no equivalent for the property type "${s.websiteType}" (Property_Type__c).`,
    });
  } else {
    holds.push({
      code: "no_type",
      fix: "salesforce",
      message: "Property_Type__c on the Property is blank.",
    });
  }

  const category = s.category ? normKey(s.category) : null;
  const segment: PropertySegment =
    category === "commercial"
      ? "commercial"
      : category === "residential"
        ? "residential"
        : segmentHint ?? (type && COMMERCIAL_TYPES.has(type) ? "commercial" : "residential");

  if (type && ROOMED_TYPES.has(type)) {
    if (s.beds == null) {
      holds.push({ code: "no_bedrooms", fix: "salesforce", message: "Rooms__c on the Property is blank." });
    }
    if (s.baths == null) {
      holds.push({ code: "no_bathrooms", fix: "salesforce", message: "Bathrooms__c on the Property is blank." });
    }
  }
  if (s.sizeSqft == null) {
    notes.push({ code: "no_size", message: "PropertySizeSqft__c is blank, so no size is shown." });
  }

  // Where. Area__c and Sub_Area__c only: Location__c is free text for the
  // CRM team, and the portals' Community__c is not in the website feed.
  let place: ResolvedArea = { area_id: null, sub_community_id: null, building_id: null };
  const where = areaText(s);
  if (!s.area) {
    holds.push({
      code: "no_location",
      fix: "salesforce",
      message: "Area__c on the Property is blank. Choose the website Area.",
    });
  } else {
    const resolved = resolveWebsiteArea(s.area, s.subArea, s.emirate, lookups);
    if (resolved) {
      place = resolved.place;
      if (resolved.subAreaMissed && where) {
        unresolved.location = where;
        notes.push({
          code: "unmapped_sub_area",
          message: `The website has no sub-area "${s.subArea}" in ${s.area}, so the listing is placed in ${s.area}. Map it on the Salesforce listings screen, or ask the Bazar team to add it.`,
        });
      }
    } else if (where) {
      unresolved.location = where;
      holds.push({
        code: "unmapped_location",
        fix: "website",
        message: `"${where}" does not match an area on the website${s.emirate ? ` in ${s.emirate}` : ""}. Choose one on the Salesforce listings screen; every listing with this Area follows.`,
      });
    }
  }
  if (s.lat == null || s.lng == null) {
    notes.push({ code: "no_pin", message: "Latitude__c/Longitude__c are blank or outside the UAE, so there is no map pin." });
  }

  // Which project page it belongs to. Optional: no project, no link.
  let development: DevelopmentLookup | null = null;
  if (s.project?.name) {
    development = resolveProject(s.project.name, lookups);
    if (!development) {
      unresolved.project = s.project.name;
      notes.push({
        code: "unmapped_project",
        message: `The website has no project page called "${s.project.name}" (Project__c), so the listing is not linked to one. Name the Project record as the project page is, or ask the Bazar team to add the project.`,
      });
    }
  }

  // Who built it. The publish gate requires a developer on every listing.
  let developerId: string | null = null;
  if (!s.developer) {
    holds.push({ code: "no_developer", fix: "salesforce", message: "Developer__c on the Property is blank." });
  } else {
    developerId = resolveDeveloper(s.developer, lookups);
    if (!developerId) {
      unresolved.developer = s.developer;
      holds.push({
        code: "unmapped_developer",
        fix: "website",
        message: `"${s.developer}" does not match a developer on the website. Choose one on the Salesforce listings screen, or add the developer first.`,
      });
    }
  }

  // Who sells it: the Property's Assigned Agent. Optional — a listing with no
  // advisor still publishes.
  let agentId: string | null = null;
  if (s.agent) {
    agentId = resolveAgent(s.agent, lookups);
    if (!agentId) {
      unresolved.agent = { email: s.agent.email, name: s.agent.name, id: s.agent.id };
      const who = s.agent.name ?? s.agent.email ?? "The assigned agent";
      notes.push({
        code: "unmapped_agent",
        message: s.agent.email
          ? `${who} is not a staff member on the website, so the listing shows no advisor.`
          : `${who} has no email the integration user can read, so they cannot be matched to the website team. Map them once on the Salesforce listings screen.`,
      });
    }
  } else {
    notes.push({ code: "no_agent", message: "No Assigned Agent on the Property in Salesforce." });
  }

  // The permit. Abu Dhabi's rules, and the website's publish gate.
  if (!s.permitNumber) {
    holds.push({ code: "no_permit_number", fix: "salesforce", message: "RERAPermitNumber__c on the Property is blank." });
  }
  if (!s.permitExpiresOn) {
    holds.push({
      code: "no_permit_expiry",
      fix: "salesforce",
      message: "Permit_Expiry_Date_c__c on the Property is blank.",
    });
  } else if (isPastDate(s.permitExpiresOn, now)) {
    holds.push({
      code: "permit_expired",
      fix: "salesforce",
      message: `The advertising permit expired on ${s.permitExpiresOn} (Permit_Expiry_Date_c__c).`,
    });
  }

  // The facts the specification and the key-fact tiles show.
  const tenure = s.tenure ? (TENURES[normKey(s.tenure)] ?? null) : null;
  if (s.tenure && !tenure) {
    notes.push({ code: "tenure_unknown", message: `Tenure__c "${s.tenure}" is not Freehold, Leasehold or Usufruct, so no tenure is shown.` });
  }
  const yearBuilt = yearBuiltOf(s, form, now, notes);
  let serviceCharge = s.serviceChargeSqft;
  if (serviceCharge != null && (serviceCharge < 0 || serviceCharge > 1_000)) {
    notes.push({
      code: "service_charge_out_of_range",
      message: `Service_Charge_Sqft__c is ${serviceCharge}; the website expects AED per sq ft per year, between 0 and 1,000, so none is shown.`,
    });
    serviceCharge = null;
  }
  const view = clip(s.view, 100);
  const orientation = s.orientation ? clip(COMPASS[normKey(s.orientation)] ?? s.orientation, 80) : null;

  const { mapped, unmapped } = mapAmenities([...s.amenities, ...s.websiteAmenities], lookups.amenityLabels);
  const amenities = [...mapped];
  const fromView = view ? viewAmenity(view, lookups.amenityLabels) : null;
  if (fromView && !amenities.includes(fromView)) amenities.push(fromView);
  if (unmapped.length) {
    notes.push({
      code: "unmapped_amenities",
      message: `No website equivalent for: ${unmapped.join(", ")}.`,
    });
  }

  if (!s.cover && s.gallery.length === 0) {
    holds.push({
      code: "no_photos",
      fix: "salesforce",
      message: "The Property has no photos in Listing_Images__c, Listing_Image_URLs__c, Cover_Page_Image__c or Main_Image_URL__c.",
    });
  }

  const address = addressOf(place, development, lookups);

  // The Arabic twins: Salesforce's when it wrote them, cleared with a blank
  // English, and otherwise the website's own.
  const twins: Partial<SyncedFields> = {};
  for (const t of TWINS) {
    const english = s[t.english] as string | null;
    const arabic = s[t.arabic] as string | null;
    if (!english) twins[t.column] = null;
    else if (arabic) twins[t.column] = t.html ? plainTextToHtml(arabic) : clip(arabic, t.max ?? arabic.length);
  }

  const fields: SyncedFields | null =
    s.title && s.title.length >= 3 && mode && type && price != null
      ? {
          title: s.title.slice(0, 160),
          short_description: clip(s.shortDescription, 320),
          description: s.description ? plainTextToHtml(s.description) : null,
          mode,
          segment,
          type,
          property_form: mode === "rent" ? null : form,
          beds: s.beds ?? 0,
          baths: s.baths ?? 0,
          built_up_ft2: s.sizeSqft != null ? Math.round(s.sizeSqft) : null,
          plot_ft2: s.plotSqft != null ? Math.round(s.plotSqft) : null,
          furnishing: s.furnishing ? FURNISHINGS[normKey(s.furnishing)] ?? null : null,
          parking_bays: s.parking != null && s.parking >= 0 ? Math.round(s.parking) : null,
          floor: s.floor,
          year_built: yearBuilt,
          tenure,
          view,
          orientation,
          service_charge_per_ft2: serviceCharge != null ? Math.round(serviceCharge * 100) / 100 : null,
          geo: s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null,
          price_aed: price,
          area_id: place.area_id,
          sub_community_id: place.sub_community_id,
          building_id: place.building_id,
          address_line: address.en,
          address_line_ar: address.ar,
          development_id: development?.id ?? null,
          developer_id: developerId,
          amenities,
          listing_permit_no: s.permitNumber,
          listing_permit_expires_at: s.permitExpiresOn,
          ...twins,
          ...(agentId ? { assigned_agent_id: agentId } : {}),
        }
      : null;

  return {
    fields,
    cardFlags: { exclusive: s.exclusive, vacant_on_transfer: s.vacantOnTransfer },
    holds,
    notes,
    unresolved,
    images: { cover: s.cover, gallery: s.gallery, floorPlan: s.floorPlan },
  };
}

/**
 * The listing's `flags` with Salesforce's two checkboxes applied, or null when
 * nothing changes.
 *
 * `flags` is a shared bag — card labels an editor ticked, the homepage
 * feature, mortgage eligibility — so only the two built-in labels Salesforce
 * owns are touched: the legacy boolean each one reads from, and its id in
 * `flags.labels`, removed when Salesforce says no, so an editor's tick cannot
 * outlive Salesforce's "not exclusive". See lib/card-labels.ts.
 */
export function applyCardFlags(current: unknown, cardFlags: CardFlags): Record<string, unknown> | null {
  const flags: Record<string, unknown> =
    current && typeof current === "object" && !Array.isArray(current) ? { ...(current as Record<string, unknown>) } : {};
  let changed = false;
  for (const [id, value] of Object.entries(cardFlags) as [keyof CardFlags, boolean | null][]) {
    if (value == null) continue;
    if (flags[id] !== value) {
      flags[id] = value;
      changed = true;
    }
    const labels = Array.isArray(flags.labels) ? (flags.labels as unknown[]) : null;
    if (!value && labels?.includes(id)) {
      flags.labels = labels.filter((l) => l !== id);
      changed = true;
    }
  }
  return changed ? flags : null;
}

// ── the decision ────────────────────────────────────────────────────────

export type ListingState = Database["public"]["Enums"]["salesforce_listing_state"];
type PropertyStatus = Database["public"]["Enums"]["property_status"];

export function decideState(input: {
  sandbox: boolean;
  withdrawn: boolean;
  hidden: boolean;
  holds: readonly Hold[];
  approved: boolean;
  autoPublish: boolean;
}): ListingState {
  if (input.withdrawn) return "withdrawn";
  if (input.sandbox) return "mirror_only";
  if (input.hidden) return "hidden";
  if (input.holds.length > 0) return "held";
  if (!input.approved && !input.autoPublish) return "awaiting_approval";
  return "live";
}

/**
 * The property status a state implies, given where the row is now.
 *
 * Only ever takes a listing down from `published` or puts one up; a draft that
 * is held stays a draft, and a listing the permit-expiry cron archived stays
 * archived until it is live again. Going down is `off_market`, which the
 * listing page answers with a 410 — the honest answer for a listing that is no
 * longer available, and reversible the moment it is.
 */
export function targetStatus(state: ListingState, current: PropertyStatus | null): PropertyStatus {
  if (state === "live") return "published";
  if (current === "published") return "off_market";
  return current ?? "draft";
}
