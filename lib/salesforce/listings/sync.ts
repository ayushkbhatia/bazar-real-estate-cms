import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/db/types";
import { isSalesforceConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSandboxOrgHost,
  salesforceOrgHost,
  SalesforceError,
} from "@/lib/salesforce/client";
import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { recordHeartbeat, reportError, reportIssue } from "@/lib/observability";
import { propertyUrl } from "@/lib/queries/property-utils";
import { generatePropertyReference, slugify } from "@/lib/slug";
import { evaluatePublishability } from "@/lib/publishability";
import { hashSource } from "@/lib/i18n/mt/translate";
import { explainAbsences, fetchPublishedListings } from "./fetch";
import { downloadImage, storeImage } from "./images";
import { allRows } from "./paginate";
import {
  decideState,
  planListing,
  targetStatus,
  type Hold,
  type ListingState,
  type Lookups,
  type Note,
  type SyncedFields,
  type Unresolved,
} from "./plan";
import {
  imageKey,
  snapshotHash,
  toSnapshot,
  type ImageRef,
  type ListingSnapshot,
} from "./snapshot";

/**
 * The listing sync: one run, start to finish.
 *
 * ── Two phases ───────────────────────────────────────────────────────────
 * Content first, status second. Phase one walks every listing: plans it,
 * creates or corrects its property row, copies its photos. Phase two re-reads
 * the admin flags (approved, hidden) in one query and only then decides what
 * is live. The split is for the flags: an admin who hides a listing while a
 * run is copying photos must not have that undone by a decision the run made
 * from flags it read a minute earlier.
 *
 * ── Drift, not hashes ────────────────────────────────────────────────────
 * A synced field is compared with the value actually in the row, every run.
 * Comparing against a hash of what the sync last wrote would miss an editor
 * changing a CRM-owned field in the CMS: the hash would still match and the
 * edit would stick, silently disagreeing with Salesforce. The CRM owns those
 * fields; the comparison is what makes that true.
 *
 * ── Cost ─────────────────────────────────────────────────────────────────
 * In steady state: one token, one SOQL query, and five or six database reads.
 * Writes happen only where something changed. Photos are the expensive part
 * and are bounded per run by count and by the clock; a listing whose photos
 * are still copying waits rather than going live with half a gallery.
 */

type Admin = SupabaseClient<Database>;
type PropertyStatus = Database["public"]["Enums"]["property_status"];
type MediaRole = Database["public"]["Enums"]["property_media_role"];

export const JOB = "salesforce-listing-sync";

/** Per run. A new listing's photos drain across runs beyond this. */
const MAX_IMAGE_DOWNLOADS = 40;
/** Stop starting new downloads this long into a run (maxDuration is 60s). */
const IMAGE_TIME_BUDGET_MS = 35_000;
/** A photo that failed for a reason that will not change is retried daily. */
const FAILURE_RETRY_MS = 24 * 60 * 60 * 1000;
/** Held for as long as a run could plausibly take, and then some. */
const LEASE_SECONDS = 120;

const SYNC_COLUMNS =
  "id, status, slug, reference, published_at, i18n, title, description, mode, segment, type, property_form, beds, baths, built_up_ft2, plot_ft2, furnishing, parking_bays, floor, geo, price_aed, area_id, sub_community_id, building_id, developer_id, amenities, listing_permit_no, listing_permit_expires_at, title_ar, description_ar, assigned_agent_id, salesforce_listing_id";

type PropertyRow = {
  id: string;
  status: PropertyStatus;
  slug: string;
  reference: string;
  published_at: string | null;
  i18n: Json;
  salesforce_listing_id: string | null;
} & Record<string, unknown>;

type MirrorRow = Database["public"]["Tables"]["salesforce_listings"]["Row"];

type LinkRow = { property_id: string; media_id: string; role: MediaRole; sort_order: number };

export type SyncSummary = {
  ok: boolean;
  skipped?: string;
  org?: string | null;
  sandbox?: boolean;
  seen: number;
  created: number;
  updated: number;
  published: number;
  unpublished: number;
  held: number;
  hidden: number;
  mirrorOnly: number;
  awaitingApproval: number;
  live: number;
  withdrawn: number;
  invisible: number;
  imagesCopied: number;
  imagesFailed: number;
  hiddenFields: string[];
  errors: string[];
};

function emptySummary(): SyncSummary {
  return {
    ok: true,
    seen: 0,
    created: 0,
    updated: 0,
    published: 0,
    unpublished: 0,
    held: 0,
    hidden: 0,
    mirrorOnly: 0,
    awaitingApproval: 0,
    live: 0,
    withdrawn: 0,
    invisible: 0,
    imagesCopied: 0,
    imagesFailed: 0,
    hiddenFields: [],
    errors: [],
  };
}

export type Revalidator = (paths: { propertyUrls: string[]; lists: boolean }) => void;

type Ctx = {
  admin: Admin;
  now: Date;
  startedAt: number;
  orgHost: string;
  sandbox: boolean;
  autoPublish: boolean;
  lookups: Lookups;
  mediaByKey: Map<string, string>;
  sfMediaIds: Set<string>;
  properties: Map<string, PropertyRow>;
  links: Map<string, LinkRow[]>;
  mirror: Map<string, MirrorRow>;
  imageDownloads: number;
  summary: SyncSummary;
  dirtyUrls: Set<string>;
  listsDirty: boolean;
  /** Whether this run may call Salesforce (false when re-applying from stored
   *  snapshots without credentials). */
  canFetch: boolean;
};

// ── loading ─────────────────────────────────────────────────────────────

async function loadLookups(admin: Admin): Promise<Lookups> {
  const [areas, developers, staff, amenities, mappings] = await Promise.all([
    admin.from("areas").select("id, name, slug, kind, parent_id"),
    admin.from("developers").select("id, name"),
    admin.from("staff").select("user_id, status, public_email"),
    admin.from("amenities_taxonomy").select("label, active, sort_order").order("sort_order"),
    allRows<{ kind: string; source_key: string; target_id: string }>((from, to) =>
      admin
        .from("salesforce_mappings")
        .select("kind, source_key, target_id")
        .order("kind")
        .order("source_key")
        .range(from, to),
    ),
  ]);
  for (const r of [areas, developers, staff, amenities]) {
    if (r.error) throw new Error(`lookup load failed: ${r.error.message}`);
  }

  // A CRM agent is matched on email. Staff sign in with theirs, so it lives in
  // auth.users; the public address on the profile is a second chance.
  const active = new Map(
    (staff.data ?? []).filter((s) => s.status === "active").map((s) => [s.user_id, s]),
  );
  const staffByEmail = new Map<string, string>();
  for (const s of active.values()) {
    if (s.public_email) staffByEmail.set(s.public_email.toLowerCase(), s.user_id);
  }
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    for (const u of data.users) {
      if (u.email && active.has(u.id)) staffByEmail.set(u.email.toLowerCase(), u.id);
    }
    if (data.users.length < 200) break;
  }

  const byKind = (kind: string) =>
    new Map(
      mappings
        .filter((m) => m.kind === kind)
        .map((m) => [m.source_key, m.target_id] as const),
    );

  return {
    areas: areas.data ?? [],
    developers: developers.data ?? [],
    staffByEmail,
    amenityLabels: (amenities.data ?? []).filter((a) => a.active).map((a) => a.label),
    mappings: {
      location: byKind("location"),
      developer: byKind("developer"),
      agent: byKind("agent"),
    },
  };
}

async function loadState(admin: Admin, orgHost: string) {
  const [mirror, props, media] = await Promise.all([
    allRows<MirrorRow>((from, to) =>
      admin
        .from("salesforce_listings")
        .select("*")
        .eq("org_host", orgHost)
        .order("sf_listing_id")
        .range(from, to),
    ),
    allRows<PropertyRow>(
      (from, to) =>
        admin
          .from("properties")
          .select(SYNC_COLUMNS)
          .not("salesforce_listing_id", "is", null)
          .order("id")
          .range(from, to) as unknown as PromiseLike<{
          data: PropertyRow[] | null;
          error: { message: string } | null;
        }>,
    ),
    allRows<{ source_key: string; media_id: string }>((from, to) =>
      admin
        .from("salesforce_media")
        .select("source_key, media_id")
        .order("source_key")
        .range(from, to),
    ),
  ]);

  const links = new Map<string, LinkRow[]>();
  const ids = props.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const rows = await allRows<LinkRow>((from, to) =>
      admin
        .from("property_media")
        .select("property_id, media_id, role, sort_order")
        .in("property_id", chunk)
        .order("property_id")
        .order("media_id")
        .range(from, to),
    );
    for (const l of rows) {
      const list = links.get(l.property_id) ?? [];
      list.push(l);
      links.set(l.property_id, list);
    }
  }
  return {
    mirror: new Map(mirror.map((m) => [m.sf_listing_id, m])),
    properties: new Map(
      props
        .filter((p) => p.salesforce_listing_id)
        .map((p) => [p.salesforce_listing_id as string, p]),
    ),
    mediaByKey: new Map(media.map((m) => [m.source_key, m.media_id])),
    sfMediaIds: new Set(media.map((m) => m.media_id)),
    links,
  };
}

// ── helpers ─────────────────────────────────────────────────────────────

function sameValue(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    return (
      sameValue(ka, kb) &&
      ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
    );
  }
  return String(a) === String(b);
}

/** The synced fields that differ from the row as it stands. */
export function driftOf(desired: SyncedFields, current: Record<string, unknown>): Partial<SyncedFields> {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(desired)) {
    if (!sameValue(v, current[k])) patch[k] = v;
  }
  return patch as Partial<SyncedFields>;
}

async function audit(
  admin: Admin,
  action: string,
  propertyId: string,
  after: Record<string, unknown>,
): Promise<void> {
  // Never the thing that fails a run.
  await admin
    .from("audit_log")
    .insert({
      actor_kind: "integration",
      action,
      target_kind: "property",
      target_id: propertyId,
      after: after as Json,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

function baseNameFor(s: ListingSnapshot, index: number): string {
  return `${slugify(s.listingName ?? s.listingId) || "salesforce"}-${index + 1}`;
}

/** A slug that passes the publish gate whatever the title is written in. */
function slugFor(s: ListingSnapshot, title: string): string {
  const fromTitle = slugify(title).slice(0, 80).replace(/-+$/, "");
  if (fromTitle.length >= 3) return fromTitle;
  return slugify(`listing ${s.listingName ?? s.listingId}`);
}

const EMIRATE_CODES: Record<string, string> = {
  "abu dhabi": "AD",
  dubai: "DXB",
  sharjah: "SHJ",
  ajman: "AJM",
  "umm al quwain": "UAQ",
  "ras al khaimah": "RAK",
  fujairah: "FUJ",
};

// ── phase one: content ──────────────────────────────────────────────────

type Planned = {
  snapshot: ListingSnapshot;
  hash: string;
  holds: Hold[];
  notes: Note[];
  unresolved: Unresolved;
  fields: SyncedFields | null;
  property: PropertyRow | null;
  imagesTotal: number;
  imagesReady: number;
  imagesPending: number;
  imageFailures: Record<string, { reason: string; at: string }>;
  seen: boolean;
};

async function ensureMirror(ctx: Ctx, p: Planned): Promise<void> {
  if (ctx.mirror.has(p.snapshot.listingId)) return;
  const row = {
    sf_listing_id: p.snapshot.listingId,
    org_host: ctx.orgHost,
    sf_listing_name: p.snapshot.listingName,
    sf_property_id: p.snapshot.propertyId,
    sf_reference: p.snapshot.reference,
    sf_last_modified_at: p.snapshot.lastModifiedAt,
    state: "held" as const,
    holds: p.holds as unknown as Json,
    notes: p.notes as unknown as Json,
    unresolved: p.unresolved as unknown as Json,
    snapshot: p.snapshot as unknown as Json,
    snapshot_hash: p.hash,
  };
  const { data, error } = await ctx.admin
    .from("salesforce_listings")
    .upsert(row, { onConflict: "sf_listing_id" })
    .select("*")
    .maybeSingle();
  if (error || !data) throw new Error(`mirror insert failed: ${error?.message ?? "no row"}`);
  ctx.mirror.set(data.sf_listing_id, data);
}

async function createProperty(ctx: Ctx, p: Planned, fields: SyncedFields): Promise<PropertyRow | null> {
  const slug = slugFor(p.snapshot, fields.title);
  const code = EMIRATE_CODES[(p.snapshot.emirate ?? "abu dhabi").toLowerCase()] ?? "AD";
  const i18n: Record<string, unknown> = {};
  const at = ctx.now.toISOString();
  if (fields.title_ar) i18n.title_ar = { source: "human", at, src_hash: hashSource(fields.title) };
  if (fields.description_ar && fields.description) {
    i18n.description_ar = { source: "human", at, src_hash: hashSource(fields.description) };
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await ctx.admin
      .from("properties")
      .insert({
        ...fields,
        reference: generatePropertyReference(code),
        slug,
        status: "draft",
        flags: {},
        compliance: {},
        seo: { slug },
        i18n: i18n as Json,
        salesforce_listing_id: p.snapshot.listingId,
      })
      .select(SYNC_COLUMNS)
      .maybeSingle();
    if (!error && data) {
      const row = data as unknown as PropertyRow;
      ctx.properties.set(p.snapshot.listingId, row);
      ctx.summary.created += 1;
      await audit(ctx.admin, "property.salesforce_created", row.id, {
        salesforce_listing: p.snapshot.listingName ?? p.snapshot.listingId,
      });
      return row;
    }
    if (error?.code === "23505" && error.message.includes("salesforce_listing_id")) {
      // Another run created it a moment ago. Use that one.
      const { data: existing } = await ctx.admin
        .from("properties")
        .select(SYNC_COLUMNS)
        .eq("salesforce_listing_id", p.snapshot.listingId)
        .maybeSingle();
      if (existing) {
        const row = existing as unknown as PropertyRow;
        ctx.properties.set(p.snapshot.listingId, row);
        return row;
      }
    }
    if (error?.code === "23505") continue; // reference collision: new number
    throw new Error(`property insert failed: ${error?.message ?? "no row"}`);
  }
  throw new Error("could not allocate a unique reference");
}

async function updateFields(ctx: Ctx, p: Planned, property: PropertyRow, fields: SyncedFields): Promise<void> {
  const patch = driftOf(fields, property) as Record<string, unknown>;
  if (Object.keys(patch).length === 0) return;

  // Provenance for Arabic the CRM wrote: human, and tied to the English it
  // came with, so the CMS can tell when the English moves on without it.
  if ("title_ar" in patch || "description_ar" in patch) {
    const i18n = { ...((property.i18n as Record<string, unknown> | null) ?? {}) };
    const at = ctx.now.toISOString();
    if ("title_ar" in patch) i18n.title_ar = { source: "human", at, src_hash: hashSource(fields.title) };
    if ("description_ar" in patch && fields.description) {
      i18n.description_ar = { source: "human", at, src_hash: hashSource(fields.description) };
    }
    patch.i18n = i18n;
  }

  const { data, error } = await ctx.admin
    .from("properties")
    .update(patch as Database["public"]["Tables"]["properties"]["Update"])
    .eq("id", property.id)
    .select(SYNC_COLUMNS)
    .maybeSingle();
  if (error || !data) throw new Error(`property update failed: ${error?.message ?? "no row"}`);
  ctx.properties.set(p.snapshot.listingId, data as unknown as PropertyRow);
  ctx.summary.updated += 1;
  if (property.status === "published") ctx.dirtyUrls.add(propertyUrl(property));
}

type Wanted = { ref: ImageRef; role: MediaRole };

function wantedImages(s: ListingSnapshot): Wanted[] {
  const out: Wanted[] = [];
  if (s.cover) out.push({ ref: s.cover, role: "hero" });
  for (const g of s.gallery) out.push({ ref: g, role: "gallery" });
  if (s.floorPlan) out.push({ ref: s.floorPlan, role: "floor_plan" });
  return out;
}

async function copyImages(ctx: Ctx, p: Planned): Promise<void> {
  const mirror = ctx.mirror.get(p.snapshot.listingId);
  const failures: Record<string, { reason: string; at: string }> = {
    ...((mirror?.image_failures as Record<string, { reason: string; at: string }> | null) ?? {}),
  };
  const wanted = wantedImages(p.snapshot);
  let ready = 0;
  let pending = 0;

  for (const [i, w] of wanted.entries()) {
    const key = imageKey(w.ref, p.snapshot.propertyId);
    if (ctx.mediaByKey.has(key)) {
      ready += 1;
      continue;
    }
    const failed = failures[key];
    if (failed && ctx.now.getTime() - Date.parse(failed.at) < FAILURE_RETRY_MS) continue;

    const outOfBudget =
      !ctx.canFetch ||
      ctx.imageDownloads >= MAX_IMAGE_DOWNLOADS ||
      Date.now() - ctx.startedAt > IMAGE_TIME_BUDGET_MS;
    if (outOfBudget) {
      pending += 1;
      continue;
    }

    ctx.imageDownloads += 1;
    const got = await downloadImage(w.ref, p.snapshot.propertyId);
    if (!got.ok) {
      ctx.summary.imagesFailed += 1;
      if (got.permanent) failures[key] = { reason: got.reason, at: ctx.now.toISOString() };
      else pending += 1;
      continue;
    }
    const stored = await storeImage(ctx.admin, {
      sourceKey: key,
      sourceUrl: w.ref.kind === "url" ? w.ref.url : null,
      bytes: got.bytes,
      sniffed: got.sniffed,
      baseName: baseNameFor(p.snapshot, i),
      alt: p.snapshot.title,
    });
    if (!stored.ok) {
      ctx.summary.imagesFailed += 1;
      pending += 1;
      ctx.summary.errors.push(stored.reason);
      continue;
    }
    ctx.mediaByKey.set(key, stored.mediaId);
    ctx.sfMediaIds.add(stored.mediaId);
    delete failures[key];
    ctx.summary.imagesCopied += 1;
    ready += 1;
  }

  // Failures for photos the CRM no longer lists are history, not state.
  const live = new Set(wanted.map((w) => imageKey(w.ref, p.snapshot.propertyId)));
  for (const k of Object.keys(failures)) if (!live.has(k)) delete failures[k];

  p.imagesTotal = wanted.length;
  p.imagesReady = ready;
  p.imagesPending = pending;
  p.imageFailures = failures;
}

/**
 * The photo links a listing should have, from what has been copied so far.
 * The CRM's cover is the hero; failing that, the first gallery photo is.
 */
export function desiredLinks(
  snapshot: ListingSnapshot,
  mediaByKey: ReadonlyMap<string, string>,
): { media_id: string; role: MediaRole; sort_order: number }[] {
  const pid = snapshot.propertyId;
  const idOf = (r: ImageRef) => mediaByKey.get(imageKey(r, pid)) ?? null;
  const out: { media_id: string; role: MediaRole; sort_order: number }[] = [];
  const used = new Set<string>();

  const photos = [snapshot.cover, ...snapshot.gallery]
    .filter((r): r is ImageRef => r !== null)
    .map(idOf)
    .filter((id): id is string => id !== null);
  photos.forEach((id, i) => {
    if (used.has(id)) return;
    used.add(id);
    out.push({ media_id: id, role: i === 0 ? "hero" : "gallery", sort_order: i });
  });
  const plan = snapshot.floorPlan ? idOf(snapshot.floorPlan) : null;
  if (plan && !used.has(plan)) out.push({ media_id: plan, role: "floor_plan", sort_order: 0 });
  return out;
}

/**
 * Bring the listing's photo links in line with the CRM's, touching only what
 * came from Salesforce. A photo an editor added stays; if it was the hero and
 * the CRM has one, it steps down into the gallery rather than disappearing.
 */
async function reconcileLinks(ctx: Ctx, p: Planned, property: PropertyRow): Promise<void> {
  const want = desiredLinks(p.snapshot, ctx.mediaByKey);
  const have = ctx.links.get(property.id) ?? [];
  const haveById = new Map(have.map((l) => [l.media_id, l]));
  const wantIds = new Set(want.map((w) => w.media_id));
  let changed = false;

  const stale = have.filter((l) => ctx.sfMediaIds.has(l.media_id) && !wantIds.has(l.media_id));
  if (stale.length) {
    await ctx.admin
      .from("property_media")
      .delete()
      .eq("property_id", property.id)
      .in("media_id", stale.map((l) => l.media_id));
    changed = true;
  }

  const wantsHero = want.some((w) => w.role === "hero");
  const wantsPlan = want.some((w) => w.role === "floor_plan");
  const theirs = have.filter((l) => !ctx.sfMediaIds.has(l.media_id));
  for (const l of theirs) {
    if (l.role === "hero" && wantsHero) {
      await ctx.admin
        .from("property_media")
        .update({ role: "gallery", sort_order: 1000 + l.sort_order })
        .eq("property_id", property.id)
        .eq("media_id", l.media_id);
      changed = true;
    } else if (l.role === "floor_plan" && wantsPlan) {
      // Both public render sites read the FIRST floor plan, so a second would
      // be invisible. The CRM's wins; the editor's stays in the library.
      await ctx.admin
        .from("property_media")
        .delete()
        .eq("property_id", property.id)
        .eq("media_id", l.media_id);
      changed = true;
    }
  }

  const upserts = want.filter((w) => {
    const h = haveById.get(w.media_id);
    return !h || h.role !== w.role || h.sort_order !== w.sort_order;
  });
  if (upserts.length) {
    const { error } = await ctx.admin.from("property_media").upsert(
      upserts.map((w) => ({ property_id: property.id, ...w })),
      { onConflict: "property_id,media_id" },
    );
    if (error) throw new Error(`photo links failed: ${error.message}`);
    changed = true;
  }

  if (changed) {
    ctx.links.set(property.id, [
      ...theirs.filter((l) => !(l.role === "floor_plan" && wantsPlan)).map((l) =>
        l.role === "hero" && wantsHero ? { ...l, role: "gallery" as const, sort_order: 1000 + l.sort_order } : l,
      ),
      ...want.map((w) => ({ property_id: property.id, ...w })),
    ]);
    if (property.status === "published") ctx.dirtyUrls.add(propertyUrl(property));
  }
}

async function contentPhase(ctx: Ctx, snapshot: ListingSnapshot, seen: boolean): Promise<Planned> {
  const plan = planListing(snapshot, ctx.lookups, ctx.now);
  const p: Planned = {
    snapshot,
    hash: snapshotHash(snapshot),
    holds: plan.holds,
    notes: plan.notes,
    unresolved: plan.unresolved,
    fields: plan.fields,
    property: ctx.properties.get(snapshot.listingId) ?? null,
    imagesTotal: wantedImages(snapshot).length,
    imagesReady: 0,
    imagesPending: 0,
    imageFailures: {},
    seen,
  };

  // A sandbox's listings are evaluated and shown on the admin screen, and go
  // no further. Nothing from a sandbox reaches `properties` or the bucket.
  if (ctx.sandbox) return p;

  if (!plan.fields) return p;

  await ensureMirror(ctx, p);
  let property = p.property;
  if (!property) property = await createProperty(ctx, p, plan.fields);
  else await updateFields(ctx, p, property, plan.fields);
  property = ctx.properties.get(snapshot.listingId) ?? property;
  p.property = property;
  if (!property) return p;

  await copyImages(ctx, p);
  await reconcileLinks(ctx, p, property);

  if (p.imagesTotal > 0 && p.imagesReady === 0 && p.imagesPending === 0) {
    p.holds.push({
      code: "photos_unavailable",
      fix: "salesforce",
      message: `None of the ${p.imagesTotal} photos could be copied: ${Object.values(p.imageFailures)
        .map((f) => f.reason)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join("; ")}.`,
    });
  } else if (p.imagesPending > 0 && property.status !== "published") {
    // A listing's first appearance waits for its whole gallery. One already
    // live keeps its place while the new photos arrive.
    p.holds.push({
      code: "photos_pending",
      fix: "wait",
      message: `${p.imagesReady} of ${p.imagesTotal} photos copied so far; the rest follow on the next runs.`,
    });
  }
  const failedCount = Object.keys(p.imageFailures).length;
  if (failedCount > 0 && p.imagesReady > 0) {
    p.notes.push({
      code: "photos_failed",
      message: `${failedCount} of ${p.imagesTotal} photos could not be copied (${[
        ...new Set(Object.values(p.imageFailures).map((f) => f.reason)),
      ].join("; ")}).`,
    });
  }
  return p;
}

// ── phase two: status ───────────────────────────────────────────────────

async function statusPhase(ctx: Ctx, planned: Planned[]): Promise<void> {
  // The flags, fresh. See "Two phases" above.
  const ids = planned.map((p) => p.snapshot.listingId);
  const flags = new Map<string, { approved_at: string | null; hidden_at: string | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await ctx.admin
      .from("salesforce_listings")
      .select("sf_listing_id, approved_at, hidden_at")
      .in("sf_listing_id", ids.slice(i, i + 200));
    if (error) throw new Error(`flag read failed: ${error.message}`);
    for (const f of data ?? []) flags.set(f.sf_listing_id, f);
  }

  const rows: Database["public"]["Tables"]["salesforce_listings"]["Insert"][] = [];
  const nowIso = ctx.now.toISOString();

  for (const p of planned) {
    const id = p.snapshot.listingId;
    const f = flags.get(id);
    let holds = p.holds;
    let state: ListingState = decideState({
      sandbox: ctx.sandbox,
      withdrawn: false,
      hidden: !!f?.hidden_at,
      holds,
      approved: !!f?.approved_at,
      autoPublish: ctx.autoPublish,
    });

    const property = p.property;
    if (state === "live" && property && p.fields) {
      // The CMS's own gate, on the row as it will be. The plan's holds should
      // already cover everything it checks; this is the belt to those braces,
      // so a Salesforce listing can never go live past a rule an editor
      // cannot.
      const gate = evaluatePublishability({
        status: property.status,
        has_developer: p.fields.developer_id != null,
        mode: p.fields.mode,
        property_form: p.fields.property_form,
        listing_permit_no: p.fields.listing_permit_no,
        listing_permit_expires_at: p.fields.listing_permit_expires_at,
        slug: property.slug,
        title: p.fields.title,
        price_aed: p.fields.price_aed,
        now: ctx.now,
      });
      if (!gate.ok) {
        holds = [...holds, ...gate.blockers.map((b) => ({ code: "gate" as const, fix: "website" as const, message: b }))];
        state = "held";
      }
    }

    // A listing with no row at all cannot be live, whatever the flags say.
    if (state === "live" && !property) state = "held";

    let approvedAt = f?.approved_at ?? null;
    if (property && !ctx.sandbox) {
      const next = targetStatus(state, property.status);
      if (next !== property.status) {
        const patch: Database["public"]["Tables"]["properties"]["Update"] = { status: next };
        if (next === "published" && !property.published_at) {
          const crmDate = p.snapshot.publishedOn ? Date.parse(`${p.snapshot.publishedOn}T00:00:00Z`) : NaN;
          patch.published_at =
            Number.isFinite(crmDate) && crmDate <= ctx.now.getTime() ? new Date(crmDate).toISOString() : nowIso;
        }
        const { error } = await ctx.admin.from("properties").update(patch).eq("id", property.id);
        if (error) {
          ctx.summary.errors.push(`status ${id}: ${error.message}`);
        } else {
          const url = propertyUrl(property);
          ctx.dirtyUrls.add(url);
          ctx.listsDirty = true;
          if (next === "published") {
            ctx.summary.published += 1;
            await audit(ctx.admin, "property.salesforce_published", property.id, {
              salesforce_listing: p.snapshot.listingName ?? id,
            });
          } else if (property.status === "published") {
            ctx.summary.unpublished += 1;
            await audit(ctx.admin, "property.salesforce_unpublished", property.id, {
              salesforce_listing: p.snapshot.listingName ?? id,
              state,
              holds: holds.map((h) => h.code),
            });
          }
          property.status = next;
        }
      }
      // Going live under auto-publish is an approval: switching auto-publish
      // off later must not take down what it already put up.
      if (state === "live" && !approvedAt) approvedAt = nowIso;
    }

    if (state === "live") ctx.summary.live += 1;
    else if (state === "held") ctx.summary.held += 1;
    else if (state === "hidden") ctx.summary.hidden += 1;
    else if (state === "mirror_only") ctx.summary.mirrorOnly += 1;
    else if (state === "awaiting_approval") ctx.summary.awaitingApproval += 1;

    rows.push({
      sf_listing_id: id,
      org_host: ctx.orgHost,
      sf_listing_name: p.snapshot.listingName,
      sf_property_id: p.snapshot.propertyId,
      sf_reference: p.snapshot.reference,
      sf_last_modified_at: p.snapshot.lastModifiedAt,
      state,
      holds: holds as unknown as Json,
      notes: p.notes as unknown as Json,
      unresolved: p.unresolved as unknown as Json,
      snapshot: p.snapshot as unknown as Json,
      snapshot_hash: p.hash,
      images_total: p.imagesTotal,
      images_ready: p.imagesReady,
      image_failures: p.imageFailures as unknown as Json,
      withdrawn_at: null,
      withdrawn_reason: null,
      last_synced_at: nowIso,
      last_error: null,
      ...(p.seen ? { last_seen_at: nowIso } : {}),
      ...(approvedAt && !f?.approved_at ? { approved_at: approvedAt } : {}),
    });
  }

  // Flags an admin owns (approved_by, hidden_at, hidden_by) are never in this
  // payload, so the upsert cannot overwrite them.
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await ctx.admin
      .from("salesforce_listings")
      .upsert(rows.slice(i, i + 100), { onConflict: "sf_listing_id" });
    if (error) throw new Error(`mirror write failed: ${error.message}`);
  }
}

async function withdraw(ctx: Ctx, row: MirrorRow, reason: string): Promise<void> {
  const property = ctx.properties.get(row.sf_listing_id);
  if (property && property.status === "published") {
    const { error } = await ctx.admin.from("properties").update({ status: "off_market" }).eq("id", property.id);
    if (!error) {
      ctx.summary.unpublished += 1;
      ctx.dirtyUrls.add(propertyUrl(property));
      ctx.listsDirty = true;
      await audit(ctx.admin, "property.salesforce_unpublished", property.id, {
        salesforce_listing: row.sf_listing_name ?? row.sf_listing_id,
        state: "withdrawn",
        reason,
      });
    }
  }
  await ctx.admin
    .from("salesforce_listings")
    .update({
      state: "withdrawn",
      withdrawn_at: row.withdrawn_at ?? ctx.now.toISOString(),
      withdrawn_reason: reason,
      holds: [],
      last_synced_at: ctx.now.toISOString(),
      last_error: null,
    })
    .eq("sf_listing_id", row.sf_listing_id);
  ctx.summary.withdrawn += 1;
}

// ── the run ─────────────────────────────────────────────────────────────

async function heartbeat(summary: SyncSummary, detail: string): Promise<void> {
  await recordHeartbeat(JOB, { ok: summary.ok, detail });
}

function describe(s: SyncSummary): string {
  const parts = [
    `seen ${s.seen}`,
    `live ${s.live}`,
    s.awaitingApproval ? `awaiting approval ${s.awaitingApproval}` : null,
    s.held ? `held ${s.held}` : null,
    s.hidden ? `hidden ${s.hidden}` : null,
    s.mirrorOnly ? `evaluated ${s.mirrorOnly}` : null,
    s.created ? `created ${s.created}` : null,
    s.published ? `published ${s.published}` : null,
    s.unpublished ? `taken down ${s.unpublished}` : null,
    s.withdrawn ? `withdrawn ${s.withdrawn}` : null,
    s.imagesCopied ? `photos ${s.imagesCopied}` : null,
    s.invisible ? `INVISIBLE ${s.invisible}` : null,
  ].filter(Boolean);
  return `${s.sandbox ? "[sandbox, mirror only] " : ""}${parts.join(", ")}`;
}

export type RunOptions = {
  trigger: "cron" | "manual" | "reapply";
  /** Re-plan these listings from their stored snapshots instead of sweeping
   *  Salesforce. What an admin's approve / hide / mapping does. */
  onlyStored?: string[];
  revalidate?: Revalidator;
};

export async function runListingSync(opts: RunOptions): Promise<SyncSummary> {
  const summary = emptySummary();
  const admin = createAdminClient();
  if (!admin) return { ...summary, skipped: "no supabase" };

  const orgHost = salesforceOrgHost();
  const reapply = !!opts.onlyStored;
  if (!reapply && (!isSalesforceConfigured || !orgHost)) {
    // Stamped, not skipped: this is the expected state until the client's
    // credentials are in Vercel, and a job that never stamps looks dead.
    await heartbeat(summary, "idle — no Salesforce credentials");
    return { ...summary, skipped: "no salesforce" };
  }

  const { data: settings } = await admin
    .from("salesforce_listing_sync")
    .select("paused, auto_publish")
    .eq("id", 1)
    .maybeSingle();
  if (settings?.paused && !reapply) {
    await heartbeat(summary, "paused by an admin");
    return { ...summary, skipped: "paused" };
  }

  const holder = randomUUID();
  const { data: leased } = await admin.rpc("claim_salesforce_listing_lease", {
    p_holder: holder,
    p_seconds: LEASE_SECONDS,
  });
  if (!leased) {
    if (!reapply) await heartbeat(summary, "skipped — a run was already in progress");
    return { ...summary, skipped: "busy" };
  }

  // Re-applying needs no credentials — it works from stored snapshots — so
  // the org comes from the rows when the environment does not name one.
  let effectiveOrg = orgHost ?? "";
  if (!effectiveOrg && reapply && opts.onlyStored?.length) {
    const { data: one } = await admin
      .from("salesforce_listings")
      .select("org_host")
      .in("sf_listing_id", opts.onlyStored)
      .limit(1)
      .maybeSingle();
    effectiveOrg = one?.org_host ?? "";
  }
  summary.org = effectiveOrg;
  summary.sandbox = isSandboxOrgHost(effectiveOrg);

  try {
    const state = await loadState(admin, effectiveOrg);
    const ctx: Ctx = {
      admin,
      now: new Date(),
      startedAt: Date.now(),
      orgHost: effectiveOrg,
      sandbox: summary.sandbox,
      autoPublish: !!settings?.auto_publish,
      lookups: await loadLookups(admin),
      ...state,
      imageDownloads: 0,
      summary,
      dirtyUrls: new Set(),
      listsDirty: false,
      canFetch: isSalesforceConfigured && !!orgHost,
    };

    let snapshots: { snapshot: ListingSnapshot; seen: boolean }[];
    if (reapply) {
      const wanted = new Set(opts.onlyStored);
      snapshots = [...ctx.mirror.values()]
        .filter((m) => wanted.has(m.sf_listing_id) && m.state !== "withdrawn")
        .map((m) => ({ snapshot: m.snapshot as unknown as ListingSnapshot, seen: false }));
    } else {
      // A sandbox's rows are test data. When the org changes, the old org's
      // mirror-only rows go; anything that reached `properties` stays linked.
      await admin
        .from("salesforce_listings")
        .delete()
        .neq("org_host", effectiveOrg)
        .eq("state", "mirror_only");

      const sweep = await fetchPublishedListings();
      summary.hiddenFields = sweep.hiddenFields;
      const byId = new Map(sweep.records.map((r) => [r.Id, r]));
      snapshots = [...byId.values()].map((r) => ({ snapshot: toSnapshot(r), seen: true }));
      summary.seen = snapshots.length;

      // Withdrawals, on evidence only.
      const missing = [...ctx.mirror.values()].filter(
        (m) => !byId.has(m.sf_listing_id) && m.state !== "withdrawn",
      );
      if (missing.length) {
        const why = await explainAbsences(missing.map((m) => m.sf_listing_id));
        for (const m of missing) {
          const a = why.get(m.sf_listing_id);
          if (!a || a.kind === "still_published") continue;
          if (a.kind === "invisible") {
            summary.invisible += 1;
            await admin
              .from("salesforce_listings")
              .update({
                last_error:
                  "Salesforce no longer shows this listing to the integration user. It stays as it was until someone checks the record's sharing.",
              })
              .eq("sf_listing_id", m.sf_listing_id);
            continue;
          }
          await withdraw(ctx, m, a.reason);
        }
        if (summary.invisible > 0) {
          await reportIssue("Salesforce listings no longer visible to the integration user", {
            source: "cron/salesforce-listing-sync",
            context: { count: summary.invisible },
          });
        }
      }
    }

    const planned: Planned[] = [];
    for (const { snapshot, seen } of snapshots) {
      try {
        planned.push(await contentPhase(ctx, snapshot, seen));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`${snapshot.listingName ?? snapshot.listingId}: ${message}`);
        await admin
          .from("salesforce_listings")
          .update({ last_error: message })
          .eq("sf_listing_id", snapshot.listingId);
      }
    }
    await statusPhase(ctx, planned);

    const revalidate = opts.revalidate ?? defaultRevalidate;
    if (ctx.dirtyUrls.size || ctx.listsDirty) {
      revalidate({ propertyUrls: [...ctx.dirtyUrls], lists: ctx.listsDirty || ctx.dirtyUrls.size > 0 });
    }

    if (summary.hiddenFields.length) {
      await reportIssue("Salesforce hides listing fields from the integration user", {
        source: "cron/salesforce-listing-sync",
        context: { fields: summary.hiddenFields },
      });
    }
    if (summary.errors.length) {
      summary.ok = false;
      await reportIssue("Salesforce listing sync could not process some listings", {
        source: "cron/salesforce-listing-sync",
        context: { errors: summary.errors.slice(0, 20) },
      });
    }

    await admin
      .from("salesforce_listing_sync")
      .update({ last_run_at: ctx.now.toISOString(), last_summary: summary as unknown as Json })
      .eq("id", 1);
    if (!reapply) await heartbeat(summary, describe(summary));
    return summary;
  } catch (err) {
    summary.ok = false;
    const message =
      err instanceof SalesforceError && err.errorCode
        ? `${err.errorCode}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    summary.errors.push(message);
    await reportError(err, { source: "cron/salesforce-listing-sync" });
    if (!reapply) await recordHeartbeat(JOB, { ok: false, detail: message });
    return summary;
  } finally {
    await admin.rpc("release_salesforce_listing_lease", { p_holder: holder });
  }
}

const LIST_PATHS = [
  "/",
  "/buy",
  "/buy/ready",
  "/buy/resale",
  "/buy/search",
  "/rent",
  "/rent/search",
  "/off-plan/search",
  "/commercial",
];

/** Route handler or server action only — both may revalidate. */
function defaultRevalidate(paths: { propertyUrls: string[]; lists: boolean }): void {
  revalidatePath("/admin/properties");
  revalidatePath("/admin/properties/salesforce");
  for (const url of paths.propertyUrls) revalidateLocalised(url);
  if (paths.lists) for (const p of LIST_PATHS) revalidateLocalised(p);
}
