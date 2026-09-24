import { createHash } from "node:crypto";
import type { SfListingRecord, SfPropertyRecord, SfUser } from "./fields";

/**
 * A Salesforce listing, normalised: the CRM's facts in the CRM's vocabulary,
 * with the transport quirks taken out.
 *
 * Deliberately no website interpretation here — "Villa" stays "Villa", it is
 * `plan.ts` that decides that means `villa`. Kept apart so the snapshot can be
 * stored on the mirror row and re-planned later without calling Salesforce:
 * an admin mapping a location, approving a listing or hiding one re-runs the
 * plan from the stored snapshot, instantly.
 *
 * `v` is the snapshot's own schema version. Bump it when the shape changes;
 * every stored hash then differs and each listing is re-applied once.
 */
export const SNAPSHOT_VERSION = 1;

export type ImageRef =
  /** A Salesforce File version — `068…`, downloaded through the REST API. */
  | { kind: "cv"; id: string }
  /** An image pasted straight into a rich-text field (`/servlet/rtaImage`). */
  | { kind: "rta"; field: string; refId: string }
  /** Anywhere else on the web. */
  | { kind: "url"; url: string };

export type ListingSnapshot = {
  v: number;
  listingId: string;
  listingName: string | null;
  propertyId: string | null;
  propertyName: string | null;
  reference: string | null;
  portalListingId: string | null;
  websiteStatus: string | null;
  listingStatus: string | null;
  propertyStatus: string | null;
  /** Listing `Sale_Rent__c`, else the property's `OfferingType__c`, else
   *  `Purpose__c`. Three fields for one fact; the listing's is the offer. */
  offering: "Sale" | "Rent" | null;
  listingPrice: number | null;
  propertyPrice: number | null;
  yearlyRent: number | null;
  rentFrequency: string | null;
  /** `Expired_Date__c`, YYYY-MM-DD. */
  expiresOn: string | null;
  publishedOn: string | null;
  title: string | null;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  location: string | null;
  emirate: string | null;
  category: string | null;
  crmType: string | null;
  bayutType: string | null;
  projectStatus: string | null;
  projectType: string | null;
  projectName: string | null;
  developer: string | null;
  /** "Studio" is 0. */
  beds: number | null;
  baths: number | null;
  sizeSqft: number | null;
  plotSqft: number | null;
  furnishing: string | null;
  parking: number | null;
  floor: number | null;
  lat: number | null;
  lng: number | null;
  permitNumber: string | null;
  permitType: string | null;
  amenities: string[];
  cover: ImageRef | null;
  gallery: ImageRef[];
  floorPlan: ImageRef | null;
  videoUrl: string | null;
  tourUrl: string | null;
  agent: { id: string | null; name: string | null; email: string | null } | null;
  lastModifiedAt: string | null;
};

function text(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r\n?/g, "\n").trim();
  return t.length ? t : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.trim().replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** A positive amount or nothing. A zero price is a blank field, not a gift. */
function amount(v: unknown): number | null {
  const n = num(v);
  return n != null && n > 0 ? n : null;
}

/** `Rooms__c` is a string picklist: "Studio", "1" … "30". */
export function parseRooms(v: unknown): number | null {
  const t = text(v);
  if (!t) return null;
  if (/^studio$/i.test(t)) return 0;
  return /^\d{1,3}$/.test(t) ? Number(t) : null;
}

/** "12" is a floor. "G+2" is a building's height, not a floor number, and is
 *  dropped rather than guessed at. */
function parseFloor(v: unknown): number | null {
  const t = text(v);
  return t && /^-?\d{1,3}$/.test(t) ? Number(t) : null;
}

/**
 * Coordinates arrive as strings. Accept only a pair that parses and lands
 * inside the UAE's bounding box with a margin — a swapped pair (lng, lat) or a
 * zero is worse than no pin, because the map would confidently show the
 * listing in the sea.
 */
export function parseCoordinates(
  latRaw: unknown,
  lngRaw: unknown,
): { lat: number; lng: number } | null {
  const lat = num(latRaw);
  const lng = num(lngRaw);
  if (lat == null || lng == null) return null;
  if (lat < 22 || lat > 27 || lng < 51 || lng > 57) return null;
  return { lat, lng };
}

function isoDate(v: unknown): string | null {
  const t = text(v);
  return t && /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null;
}

function offeringOf(v: unknown): "Sale" | "Rent" | null {
  const t = text(v)?.toLowerCase();
  if (t === "sale") return "Sale";
  if (t === "rent") return "Rent";
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const CONTENT_VERSION_RE = /\/sfc\/servlet\.shepherd\/version\/download\/(068[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?)/;
const RTA_RE = /\/servlet\/rtaImage\?/;

/**
 * One image address, whatever form it came in.
 *
 * Salesforce writes three kinds into these fields: a File link
 * (`/sfc/servlet.shepherd/version/download/068…`, relative or absolute on the
 * org's file host), a pasted rich-text image (`/servlet/rtaImage?…&refid=0EM…`)
 * and plain web URLs. The first two need a session to fetch and are useless as
 * links, but both can be read through the API with our token — so they are
 * turned into references to fetch that way.
 */
export function parseImageAddress(raw: string, field: string): ImageRef | null {
  const src = decodeEntities(raw.trim());
  if (!src || src.startsWith("data:")) return null;

  const cv = src.match(CONTENT_VERSION_RE);
  if (cv) return { kind: "cv", id: cv[1] };

  if (RTA_RE.test(src)) {
    const refId = src.match(/[?&]refid=([a-zA-Z0-9]+)/)?.[1];
    return refId ? { kind: "rta", field, refId } : null;
  }

  if (/^https?:\/\//i.test(src)) {
    try {
      const u = new URL(src);
      return { kind: "url", url: u.toString() };
    } catch {
      return null;
    }
  }
  return null;
}

/** Every `<img src>` in a rich-text field, in document order. */
export function imagesInRichText(html: string | null, field: string): ImageRef[] {
  if (!html) return [];
  const out: ImageRef[] = [];
  for (const m of html.matchAll(/<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const ref = parseImageAddress(m[1] ?? m[2] ?? "", field);
    if (ref) out.push(ref);
  }
  return out;
}

/**
 * A list of URLs in a long-text field.
 *
 * The guide says semicolon-separated; the sandbox has them comma-separated.
 * Commas are also legal inside a URL (Cloudinary puts transformations there:
 * `w_1200,h_800`), so a comma only splits when the next thing is a new
 * `http(s)://`. Semicolons, whitespace and newlines always split.
 */
export function imagesInUrlList(raw: string | null, field: string): ImageRef[] {
  if (!raw) return [];
  return raw
    .split(/[;\s]+|,(?=\s*https?:\/\/)/i)
    .map((part) => part.replace(/^,+|,+$/g, ""))
    .map((part) => parseImageAddress(part, field))
    .filter((r): r is ImageRef => r !== null);
}

export function imageKey(ref: ImageRef, propertyId: string | null): string {
  switch (ref.kind) {
    case "cv":
      return `cv:${ref.id}`;
    case "rta":
      return `rta:${propertyId ?? "?"}:${ref.field}:${ref.refId}`;
    case "url":
      return `url:${createHash("sha256").update(ref.url).digest("hex").slice(0, 40)}`;
  }
}

function dedupe(refs: ImageRef[], propertyId: string | null, skip: Set<string>): ImageRef[] {
  const seen = new Set(skip);
  const out: ImageRef[] = [];
  for (const r of refs) {
    const k = imageKey(r, propertyId);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function agentOf(listingAgent: SfUser | undefined, listingAgentId: unknown, propertyAgent: SfUser | undefined) {
  const pick = listingAgent && (listingAgent.Email || listingAgent.Name) ? listingAgent : propertyAgent;
  if (!pick) return null;
  const email = text(pick.Email)?.toLowerCase() ?? null;
  const name = text(pick.Name);
  if (!email && !name) return null;
  return {
    id: pick === listingAgent ? text(listingAgentId) : null,
    name,
    email,
  };
}

/** Salesforce multi-select picklists are `;`-joined. */
function multiPicklist(v: unknown): string[] {
  const t = text(v);
  if (!t) return [];
  return [...new Set(t.split(";").map((s) => s.trim()).filter(Boolean))];
}

function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

export function toSnapshot(rec: SfListingRecord): ListingSnapshot {
  const p: SfPropertyRecord = rec.Property__r ?? {};
  const propertyId = text(p.Id) ?? text(rec.Property__c);

  const cover =
    imagesInRichText(text(p.Cover_Page_Image__c), "Cover_Page_Image__c")[0] ??
    imagesInUrlList(text(p.Main_Image_URL__c), "Main_Image_URL__c")[0] ??
    null;
  const coverKey = cover ? new Set([imageKey(cover, propertyId)]) : new Set<string>();
  const gallery = dedupe(
    [
      ...imagesInRichText(text(p.Listing_Images__c), "Listing_Images__c"),
      ...imagesInUrlList(text(p.Listing_Image_URLs__c), "Listing_Image_URLs__c"),
    ],
    propertyId,
    coverKey,
  );
  const floorPlan = imagesInRichText(text(p.Floor_Plans__c), "Floor_Plans__c")[0] ?? null;
  const coords = parseCoordinates(p.Latitude__c, p.Longitude__c);

  return {
    v: SNAPSHOT_VERSION,
    listingId: rec.Id,
    listingName: text(rec.Name),
    propertyId,
    propertyName: text(p.Name),
    reference: text(p.Reference__c),
    portalListingId: text(p.Listing_ID__c),
    websiteStatus: text(rec.Website_Status__c),
    listingStatus: text(rec.Listing_Status__c),
    propertyStatus: text(p.Property_Status__c),
    offering:
      offeringOf(rec.Sale_Rent__c) ??
      offeringOf(p.OfferingType__c) ??
      offeringOf(p.Purpose__c),
    listingPrice: amount(rec.Price__c),
    propertyPrice: amount(p.PropertyPrice__c),
    yearlyRent: amount(p.Yearly__c),
    rentFrequency: text(p.Rent_Frequency__c),
    expiresOn: isoDate(rec.Expired_Date__c),
    publishedOn: isoDate(rec.Website_Published_Date__c) ?? isoDate(rec.Published_Date__c),
    title: text(p.Title__c),
    titleAr: text(p.Title_Arabic__c),
    description: text(p.Description__c),
    descriptionAr: text(p.Description_Arabic__c),
    location: text(p.Location__c),
    emirate: text(p.Emirate__c),
    category: text(p.Category__c),
    crmType: text(p.PropertyType__c),
    bayutType: text(p.Property_Type_Bayut_Picklist__c),
    projectStatus: text(p.ProjectStatus__c),
    projectType: text(p.Project_Type__c),
    projectName: text(p.Project_Name__c),
    developer: text(p.Developer__c),
    beds: parseRooms(p.Rooms__c),
    baths: parseRooms(p.Bathrooms__c),
    sizeSqft: amount(p.PropertySizeSqft__c),
    plotSqft: amount(p.Plot_Size__c),
    furnishing: text(p.FurnishingType__c),
    parking: num(p.NoOfParkingSpaces__c),
    floor: parseFloor(p.FloorNumber__c),
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    permitNumber: text(p.RERAPermitNumber__c),
    permitType: text(p.PermitType__c),
    amenities: multiPicklist(p.Amenities__c),
    cover,
    gallery,
    floorPlan,
    videoUrl: text(p.VideoTourURL__c),
    tourUrl: text(p.URLLink360__c),
    agent: agentOf(rec.Assigned_Agent__r, rec.Assigned_Agent__c, p.Agent_Name__r),
    lastModifiedAt: laterOf(text(rec.LastModifiedDate), text(p.LastModifiedDate)),
  };
}

/** Canonical JSON: keys sorted at every level, so the hash of equal content
 *  is equal whatever order Salesforce or Postgres returned it in. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

export function hashOf(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 32);
}

/** The CRM's own modification stamp changes when fields we never read change
 *  (an inquiry counter ticking up), so it stays out of the content hash. */
export function snapshotHash(s: ListingSnapshot): string {
  const { lastModifiedAt: _ignored, ...content } = s;
  void _ignored;
  return hashOf(content);
}
