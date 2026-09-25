import type { Database } from "@/db/types";
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
 *   · website    — the value is there but means nothing to us yet (a location
 *                  with no area, a developer we do not list); an admin maps it
 *                  once and every listing using it follows.
 *   · wait       — nothing to do; photos are still being copied.
 */

type PropertyType = Database["public"]["Enums"]["property_type"];
type PropertyMode = Database["public"]["Enums"]["property_mode"];
type PropertyForm = Database["public"]["Enums"]["property_form"];
type PropertySegment = Database["public"]["Enums"]["property_segment"];
type PropertyFurnishing = Database["public"]["Enums"]["property_furnishing"];
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
  location?: string;
  developer?: string;
  agent?: { email: string | null; name: string | null; id: string | null };
};

export type AreaLookup = {
  id: string;
  name: string;
  slug: string;
  kind: AreaKind;
  parent_id: string | null;
};

export type Lookups = {
  areas: AreaLookup[];
  developers: { id: string; name: string }[];
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

/** The columns the sync owns on a Salesforce listing. Everything not named
 *  here — slug, reference, SEO, card labels, the short description, featured
 *  flags — belongs to the website and is never touched after creation. */
export type SyncedFields = {
  title: string;
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
  geo: { lat: number; lng: number } | null;
  price_aed: number;
  area_id: string | null;
  sub_community_id: string | null;
  building_id: string | null;
  developer_id: string | null;
  amenities: string[];
  listing_permit_no: string | null;
  listing_permit_expires_at: string | null;
  /** Only when the CRM wrote one. Otherwise the website's own twin — an
   *  editor's, or the translator's — is left exactly as it is. */
  title_ar?: string;
  description_ar?: string;
  /** Only when resolved. An unmapped CRM agent never clears the advisor an
   *  editor put on the listing. */
  assigned_agent_id?: string;
};

/**
 * The columns an editor cannot change on a Salesforce listing, because the
 * next sync would change them back. Arabic twins and the advisor are only the
 * CRM's when it supplies them, so they are not listed; see `SyncedFields`.
 */
export const SALESFORCE_OWNED_COLUMNS = [
  "title",
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
  "geo",
  "price_aed",
  "area_id",
  "sub_community_id",
  "building_id",
  "developer_id",
  "amenities",
  "listing_permit_no",
  "listing_permit_expires_at",
] as const satisfies readonly (keyof SyncedFields)[];

export type ListingPlan = {
  /** Enough to be a row at all: `properties` has NOT NULL title, mode, type
   *  and price. A listing short of that lives only on the mirror. */
  fields: SyncedFields | null;
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
 * `Property_Type_Bayut_Picklist__c` — Bayut's vocabulary, the richer of the
 * two type fields and the only one with villas and townhouses in it. `null`
 * means "no honest equivalent": a whole residential floor is not an
 * apartment, and filing it as one would put it in front of the wrong buyer.
 */
const BAYUT_TYPES: Record<string, TypeMapping> = {
  villa: { type: "villa" },
  apartments: { type: "apartment" },
  apartment: { type: "apartment" },
  townhouse: { type: "townhouse" },
  penthouse: { type: "penthouse" },
  "hotel apartments": { type: "hotel_apartment" },
  "hotel apartment": { type: "hotel_apartment" },
  "residential plot": { type: "land", segment: "residential" },
  "residential building": { type: "building", segment: "residential" },
  offices: { type: "office", segment: "commercial" },
  office: { type: "office", segment: "commercial" },
  shops: { type: "retail", segment: "commercial" },
  showroom: { type: "retail", segment: "commercial" },
  "commercial building": { type: "building", segment: "commercial" },
  "commercial villa": { type: "commercial_villa", segment: "commercial" },
  "commercial floor": { type: "office", segment: "commercial" },
  "commercial plot": { type: "land", segment: "commercial" },
  "industrial land": { type: "land", segment: "commercial" },
  "mixed use land": { type: "land", segment: "commercial" },
  warehouse: { type: "commercial", segment: "commercial" },
  factory: { type: "commercial", segment: "commercial" },
  "labour camp": { type: "commercial", segment: "commercial" },
  "other commercial": { type: "commercial", segment: "commercial" },
  "residential floor": null,
  "villa compound": null,
  "bulk units": null,
};

/**
 * `Property_Type__c` — added in v1.2 of the guide as the website's type field,
 * a restricted picklist with villas, townhouses and commercial types in it.
 * Read first; the two older fields are fallbacks for records nobody has
 * re-typed. "Other" has no honest equivalent and holds the listing.
 */
const WEBSITE_TYPES: Record<string, TypeMapping> = {
  apartment: { type: "apartment" },
  villa: { type: "villa" },
  townhouse: { type: "townhouse" },
  penthouse: { type: "penthouse" },
  land: { type: "land" },
  plot: { type: "land" },
  office: { type: "office", segment: "commercial" },
  retail: { type: "retail", segment: "commercial" },
  showroom: { type: "retail", segment: "commercial" },
  warehouse: { type: "commercial", segment: "commercial" },
  "full building": { type: "building" },
  other: null,
};

/** `PropertyType__c` — the CRM's own list, used when Bayut's is blank. It has
 *  no villa at all; the sandbox files a villa as "Duplex" here and "Villa" in
 *  the Bayut field, which is why Bayut's is read first. */
const CRM_TYPES: Record<string, TypeMapping> = {
  apartment: { type: "apartment" },
  penthouse: { type: "penthouse" },
  "hotel apartment": { type: "hotel_apartment" },
  duplex: { type: "apartment" },
  villa: { type: "villa" },
  townhouse: { type: "townhouse" },
  "full floor": null,
  "half floor": null,
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

const PROJECT_TYPE_FORMS: Record<string, PropertyForm> = {
  "off plan": "off_plan",
  secondary: "resale",
};

const FURNISHINGS: Record<string, PropertyFurnishing> = {
  unfurnished: "unfurnished",
  "partly furnished": "semi",
  "semi furnished": "semi",
  // v1.2 renamed the picklist value, without the space.
  semifurnished: "semi",
  "fully furnished": "fully",
  furnished: "fully",
};

/**
 * `Amenities__c` speaks Property Finder's vocabulary; the website's taxonomy
 * is its own. Most terms match once apostrophes and hyphens are ignored
 * ("Maids Room" is "Maid’s Room"). These are the ones that don't. The target
 * is looked up in the live taxonomy, so a label an editor renames degrades to
 * "unmapped" in the notes rather than writing a word the taxonomy no longer
 * has.
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

const EMIRATE_NAMES = [
  "abu dhabi",
  "dubai",
  "sharjah",
  "ajman",
  "umm al quwain",
  "ras al khaimah",
  "fujairah",
  "uae",
  "united arab emirates",
];

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
 * `Location__c` is free text — "Yas Island, Abu Dhabi" in the sandbox. The
 * comma-separated parts are tried most-specific first, the emirate words are
 * dropped, and a part matches an area by name or slug, sub-communities before
 * areas. Only a single unambiguous match counts: guessing between two areas
 * would publish a listing in the wrong place, which is worse than holding it.
 *
 * `Emirate__c`, when set, must agree with the area's emirate. The site's area
 * tree is Abu Dhabi only today, so a Dubai listing stays unmapped until an
 * admin decides where it belongs — never silently filed under Abu Dhabi.
 */
export function resolveLocation(
  location: string,
  emirate: string | null,
  lookups: Lookups,
): ResolvedArea | null {
  const byId = new Map(lookups.areas.map((a) => [a.id, a]));

  const mapped = lookups.mappings.location.get(locationKey(location));
  if (mapped) {
    const area = byId.get(mapped);
    return area ? placeOf(area, byId) : null;
  }

  const wantEmirate = emirate ? normKey(emirate) : null;
  const inEmirate = (a: AreaLookup) => {
    if (!wantEmirate) return true;
    const root = rootEmirate(a, byId);
    return !!root && normKey(root.name) === wantEmirate;
  };

  const parts = location
    .split(/[,/|]/)
    .map(normKey)
    .filter((p) => p && !EMIRATE_NAMES.includes(p));
  const whole = normKey(location);
  if (whole && !parts.includes(whole)) parts.push(whole);

  const loose = (s: string) => s.replace(AREA_SUFFIXES, "");
  const candidates = lookups.areas.filter(
    (a) => a.kind !== "emirate" && inEmirate(a),
  );

  for (const part of parts) {
    for (const strict of [true, false]) {
      const hit = (a: AreaLookup) => {
        const name = normKey(a.name);
        const slug = normKey(a.slug);
        return strict
          ? name === part || slug === part
          : loose(name) === loose(part) || loose(slug) === loose(part);
      };
      for (const kind of ["building", "sub_community", "area"] as const) {
        const hits = candidates.filter((a) => a.kind === kind && hit(a));
        if (hits.length === 1) return placeOf(hits[0], byId);
        if (hits.length > 1) return null;
      }
    }
  }
  return null;
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
    } else {
      unmapped.push(v);
    }
  }
  return { mapped, unmapped };
}

function typeOf(s: ListingSnapshot): { mapping: TypeMapping | undefined; source: string | null } {
  if (s.websiteType) {
    const m = WEBSITE_TYPES[normKey(s.websiteType)];
    if (m !== undefined) return { mapping: m, source: s.websiteType };
  }
  if (s.bayutType) {
    const m = BAYUT_TYPES[normKey(s.bayutType)];
    if (m !== undefined) return { mapping: m, source: s.bayutType };
  }
  if (s.crmType) {
    return { mapping: CRM_TYPES[normKey(s.crmType)], source: s.crmType };
  }
  return { mapping: undefined, source: s.bayutType };
}

function formOf(s: ListingSnapshot): PropertyForm | null {
  if (s.projectStatus) {
    const f = PROJECT_STATUS_FORMS[normKey(s.projectStatus)];
    if (f) return f;
  }
  if (s.projectType) {
    const f = PROJECT_TYPE_FORMS[normKey(s.projectType)];
    if (f) return f;
  }
  return null;
}

/**
 * The CRM description is plain text; the website stores HTML (the editor is
 * Tiptap). Escaped, so nothing in a CRM field can become markup on a public
 * page, then split into paragraphs on blank lines.
 */
export function plainTextToHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return esc
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function priceFor(s: ListingSnapshot, notes: Note[], holds: Hold[]): number | null {
  if (s.offering === "Sale") {
    if (s.listingPrice) return s.listingPrice;
    if (s.propertyPrice) {
      notes.push({
        code: "price_from_property",
        message:
          "The listing has no Price__c, so the price is PropertyPrice__c from the Property record.",
      });
      return s.propertyPrice;
    }
    return null;
  }

  // Rent. The website shows yearly rent, as the Abu Dhabi market quotes it.
  const freq = s.rentFrequency ? normKey(s.rentFrequency) : null;
  if (freq && freq !== "yearly") {
    if (s.yearlyRent) {
      notes.push({
        code: "rent_from_yearly",
        message: `Rent is quoted ${s.rentFrequency?.toLowerCase()} in Salesforce; the website shows the yearly figure from Yearly__c.`,
      });
      return s.yearlyRent;
    }
    holds.push({
      code: "rent_not_yearly",
      fix: "salesforce",
      message: `Rent is quoted ${s.rentFrequency?.toLowerCase()} and the website shows yearly rent. Fill Yearly__c on the Property.`,
    });
    return null;
  }
  const price = s.listingPrice ?? s.yearlyRent ?? s.propertyPrice;
  if (price && !freq) {
    notes.push({
      code: "rent_frequency_blank",
      message: "Rent_Frequency__c is blank, so the price is shown as yearly rent.",
    });
  }
  return price;
}

function isPastDate(isoDate: string, now: Date): boolean {
  const [y, m, d] = isoDate.split("-").map(Number);
  const expiry = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return expiry < today;
}

/**
 * The CRM's location as one string, most specific part first, without
 * repeats: "The Canopies, Dubai Hills Estate, Dubai". Snapshots from before
 * v1.2 have only `location`, and still work.
 */
export function locationText(s: Pick<ListingSnapshot, "location" | "community" | "subCommunity">): string | null {
  const parts: string[] = [];
  for (const v of [s.subCommunity, s.community, s.location]) {
    if (!v) continue;
    for (const piece of v.split(",").map((x) => x.trim()).filter(Boolean)) {
      if (!parts.some((p) => normKey(p) === normKey(piece))) parts.push(piece);
    }
  }
  return parts.length ? parts.join(", ") : null;
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
      message: "Neither Price__c on the listing nor PropertyPrice__c on the Property is filled in.",
    });
  } else if (price != null) {
    const low = s.offering === "Sale" ? price < 50_000 : price < 5_000;
    if (low) {
      notes.push({ code: "price_low", message: `AED ${price.toLocaleString("en")} looks low for a ${s.offering === "Sale" ? "sale" : "yearly rent"}.` });
    }
  }

  // What it is.
  const { mapping, source } = typeOf(s);
  let type: PropertyType | null = null;
  let segmentHint: PropertySegment | undefined;
  if (mapping) {
    type = mapping.type;
    segmentHint = mapping.segment;
    if (source && normKey(source) === "duplex") {
      notes.push({ code: "duplex", message: "PropertyType__c is Duplex, shown on the website as an apartment." });
    }
  } else if (source) {
    holds.push({
      code: "unsupported_type",
      fix: "salesforce",
      message: `The website has no equivalent for the property type "${source}".`,
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

  // Where. Sub-community, community, then area: most specific first, which
  // is the order resolveLocation tries the comma-separated parts in.
  let place: ResolvedArea = { area_id: null, sub_community_id: null, building_id: null };
  const where = locationText(s);
  if (!where) {
    holds.push({
      code: "no_location",
      fix: "salesforce",
      message: "Community__c, Sub_Community__c and Location__c on the Property are all blank.",
    });
  } else {
    const resolved = resolveLocation(where, s.emirate, lookups);
    if (resolved && resolved.area_id) {
      place = resolved;
    } else {
      unresolved.location = where;
      holds.push({
        code: "unmapped_location",
        fix: "website",
        message: `"${where}" does not match an area on the website. Choose one on the Salesforce listings screen; every listing with this location follows.`,
      });
    }
  }
  if (s.lat == null || s.lng == null) {
    notes.push({ code: "no_pin", message: "Latitude__c/Longitude__c are blank or outside the UAE, so there is no map pin." });
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

  // Who sells it. Optional: a listing with no advisor still publishes.
  let agentId: string | null = null;
  if (s.agent) {
    agentId = resolveAgent(s.agent, lookups);
    if (!agentId) {
      unresolved.agent = { email: s.agent.email, name: s.agent.name, id: s.agent.id };
      notes.push({
        code: "unmapped_agent",
        message: `${s.agent.name ?? s.agent.email ?? "The assigned agent"} is not a staff member on the website, so the listing shows no advisor.`,
      });
    }
  } else {
    notes.push({ code: "no_agent", message: "No agent is assigned in Salesforce." });
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

  const { mapped: amenities, unmapped } = mapAmenities(s.amenities, lookups.amenityLabels);
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
      message: "The Property has no photos in Listing_Images__c, Listing_Image_URLs__c or Main_Image_URL__c.",
    });
  }

  const fields: SyncedFields | null =
    s.title && s.title.length >= 3 && mode && type && price != null
      ? {
          title: s.title.slice(0, 160),
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
          geo: s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null,
          price_aed: price,
          area_id: place.area_id,
          sub_community_id: place.sub_community_id,
          building_id: place.building_id,
          developer_id: developerId,
          amenities,
          listing_permit_no: s.permitNumber,
          listing_permit_expires_at: s.permitExpiresOn,
          ...(s.titleAr ? { title_ar: s.titleAr.slice(0, 160) } : {}),
          ...(s.descriptionAr ? { description_ar: plainTextToHtml(s.descriptionAr) } : {}),
          ...(agentId ? { assigned_agent_id: agentId } : {}),
        }
      : null;

  return {
    fields,
    holds,
    notes,
    unresolved,
    images: { cover: s.cover, gallery: s.gallery, floorPlan: s.floorPlan },
  };
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
