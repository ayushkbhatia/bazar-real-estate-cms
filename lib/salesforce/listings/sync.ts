import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/db/types";
import { env, isSalesforceConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSandboxOrgHost,
  salesforceOrgHost,
  salesforceRequest,
  SalesforceError,
} from "@/lib/salesforce/client";
import { isLiveWebsiteStatus } from "./fields";
import { revalidatePath } from "next/cache";
import { recordHeartbeat, reportError, reportIssue } from "@/lib/observability";
import { propertyUrl } from "@/lib/queries/property-utils";
import { generatePropertyReference, slugify } from "@/lib/slug";
import { hashSource } from "@/lib/i18n/mt/translate";
import { explainAbsences, fetchPublishedListings } from "./fetch";
import { downloadImage, storeImage } from "./images";
import { allRows } from "./paginate";
import {
  applyCardFlags,
  decideState,
  planListing,
  type CardFlags,
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
  upgradeSnapshot,
  type ImageRef,
  type ListingSnapshot,
} from "./snapshot";

/**
 * The listing sync: one run, start to finish.
 *
 * ── Salesforce supplies the first draft, and nothing after ──────────────
 * A listing new to the website becomes a property row once: a DRAFT, with
 * every fact the CRM gave and its whole photo gallery. From that moment the
 * row is the website's (0166, the client's call of 21 Oct 2026): editors
 * change any field and any photo in the CMS and publish it themselves. The
 * sync never writes that row, its photos or its status again — not when the
 * CRM edits the listing, not when the CRM withdraws it. A withdrawal is
 * recorded on the mirror and shown in the editor, for a person to act on.
 *
 * The row is created only once its photos are all copied, so the draft an
 * editor opens is complete and there is nothing left for the sync to add.
 *
 * ── Two phases ───────────────────────────────────────────────────────────
 * Content first, mirror second. Phase one walks every listing: plans it,
 * copies the photos of a new one and creates its draft. Phase two re-reads
 * the admin flags (hidden) in one query and records each listing's state.
 *
 * ── Cost ─────────────────────────────────────────────────────────────────
 * In steady state: one token, one SOQL query, and four or five database
 * reads. A listing already on the website costs no write but its mirror row.
 * Photos are bounded per run by count and by the clock; a new listing's draft
 * waits for the rest of its gallery rather than arriving with half of it.
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
  "id, status, slug, reference, published_at, i18n, flags, title, short_description, description, mode, segment, type, property_form, beds, baths, built_up_ft2, plot_ft2, furnishing, parking_bays, floor, year_built, tenure, view, orientation, service_charge_per_ft2, geo, price_aed, area_id, sub_community_id, building_id, address_line, address_line_ar, development_id, developer_id, amenities, listing_permit_no, listing_permit_expires_at, title_ar, short_description_ar, description_ar, view_ar, orientation_ar, assigned_agent_id, salesforce_listing_id";

/**
 * Each Arabic twin the CRM can write, and the English it is a translation of.
 * Arabic the CRM wrote is human, and tied to the English it came with, so the
 * CMS can tell when the English moves on without it.
 */
const TWIN_OF = {
  title_ar: "title",
  short_description_ar: "short_description",
  description_ar: "description",
  view_ar: "view",
  orientation_ar: "orientation",
} as const satisfies Partial<Record<keyof SyncedFields, keyof SyncedFields>>;

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

export type SyncSummary = {
  ok: boolean;
  skipped?: string;
  org?: string | null;
  sandbox?: boolean;
  seen: number;
  /** New drafts this run. */
  created: number;
  /** Listings whose draft exists: the website's to edit and publish. */
  onWebsite: number;
  held: number;
  hidden: number;
  mirrorOnly: number;
  withdrawn: number;
  invisible: number;
  imagesCopied: number;
  imagesFailed: number;
  writtenBack: number;
  hiddenFields: string[];
  errors: string[];
};

function emptySummary(): SyncSummary {
  return {
    ok: true,
    seen: 0,
    created: 0,
    onWebsite: 0,
    held: 0,
    hidden: 0,
    mirrorOnly: 0,
    withdrawn: 0,
    invisible: 0,
    imagesCopied: 0,
    imagesFailed: 0,
    writtenBack: 0,
    hiddenFields: [],
    errors: [],
  };
}

/** Called when a run changed what the admin screens show. Nothing public:
 *  the sync never publishes, edits or takes down a listing. */
export type Revalidator = () => void;

type Ctx = {
  admin: Admin;
  now: Date;
  startedAt: number;
  orgHost: string;
  sandbox: boolean;
  lookups: Lookups;
  mediaByKey: Map<string, string>;
  properties: Map<string, PropertyRow>;
  mirror: Map<string, MirrorRow>;
  imageDownloads: number;
  summary: SyncSummary;
  /** Whether this run may call Salesforce (false when re-applying from stored
   *  snapshots without credentials). */
  canFetch: boolean;
  /** An admin has switched write-back on (0137). */
  writeBack: boolean;
};

// ── loading ─────────────────────────────────────────────────────────────

async function loadLookups(admin: Admin): Promise<Lookups> {
  const [areas, developers, developments, staff, amenities, mappings] = await Promise.all([
    admin.from("areas").select("id, name, name_ar, slug, kind, parent_id"),
    admin.from("developers").select("id, name"),
    admin.from("developments").select("id, name, name_ar, slug"),
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
  for (const r of [areas, developers, developments, staff, amenities]) {
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
    developments: developments.data ?? [],
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

  return {
    mirror: new Map(mirror.map((m) => [m.sf_listing_id, m])),
    properties: new Map(
      props
        .filter((p) => p.salesforce_listing_id)
        .map((p) => [p.salesforce_listing_id as string, p]),
    ),
    mediaByKey: new Map(media.map((m) => [m.source_key, m.media_id])),
  };
}

// ── helpers ─────────────────────────────────────────────────────────────

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
  cardFlags: CardFlags;
  property: PropertyRow | null;
  imagesTotal: number;
  imagesReady: number;
  imagesPending: number;
  imageFailures: Record<string, { reason: string; at: string }>;
  seen: boolean;
  /** Its draft existed before this run: the website's now, untouched. */
  handedOver: boolean;
  /** Its draft was on the website and is gone — an editor deleted it. Not
   *  brought back unless someone allows it again. */
  deletedHere: boolean;
};

async function ensureMirror(ctx: Ctx, p: Planned): Promise<void> {
  if (ctx.mirror.has(p.snapshot.listingId)) return;
  const row = {
    sf_listing_id: p.snapshot.listingId,
    org_host: ctx.orgHost,
    sf_listing_name: p.snapshot.listingName,
    sf_property_id: p.snapshot.propertyId,
    // The CRM's Property ID ("P-0030"). v1.3 of the guide dropped
    // `Reference__c` from the feed; this is the reference it kept.
    sf_reference: p.snapshot.propertyName,
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
  const i18n = withProvenance({}, fields, Object.keys(TWIN_OF), ctx.now);

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await ctx.admin
      .from("properties")
      .insert({
        ...fields,
        reference: generatePropertyReference(code),
        slug,
        status: "draft",
        flags: (applyCardFlags({}, p.cardFlags) ?? {}) as Json,
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

/**
 * `i18n` with provenance for every Arabic twin whose value or English is in
 * `changed`: human and tied to its English when the CRM wrote it, and gone
 * when the twin was cleared with its English. An English edit the CRM made
 * with its Arabic left as it was re-ties the Arabic too — the CRM sent both,
 * so the Arabic is current, not stale.
 */
function withProvenance(
  current: Json | null | undefined,
  fields: SyncedFields,
  changed: readonly string[],
  now: Date,
): Record<string, unknown> {
  const i18n = { ...((current as Record<string, unknown> | null) ?? {}) };
  const at = now.toISOString();
  for (const [twin, english] of Object.entries(TWIN_OF) as [keyof typeof TWIN_OF, keyof SyncedFields][]) {
    if (!changed.includes(twin) && !changed.includes(english)) continue;
    const value = fields[twin];
    const source = fields[english];
    if (typeof value === "string" && value && typeof source === "string" && source) {
      i18n[twin] = { source: "human", at, src_hash: hashSource(source) };
    } else if (value === null) {
      delete i18n[twin];
    }
  }
  return i18n;
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

/** A new draft's photos, as the CRM ordered them. Its first and only links:
 *  after this the gallery is the editor's. */
async function linkPhotos(ctx: Ctx, p: Planned, property: PropertyRow): Promise<void> {
  const want = desiredLinks(p.snapshot, ctx.mediaByKey);
  if (want.length === 0) return;
  const { error } = await ctx.admin.from("property_media").upsert(
    want.map((w) => ({ property_id: property.id, ...w })),
    { onConflict: "property_id,media_id" },
  );
  if (error) throw new Error(`photo links failed: ${error.message}`);
}

async function contentPhase(ctx: Ctx, snapshot: ListingSnapshot, seen: boolean): Promise<Planned> {
  const plan = planListing(snapshot, ctx.lookups, ctx.now);
  const existing = ctx.properties.get(snapshot.listingId) ?? null;
  const p: Planned = {
    snapshot,
    hash: snapshotHash(snapshot),
    holds: plan.holds,
    notes: plan.notes,
    unresolved: plan.unresolved,
    fields: plan.fields,
    cardFlags: plan.cardFlags,
    property: existing,
    imagesTotal: wantedImages(snapshot).length,
    imagesReady: 0,
    imagesPending: 0,
    imageFailures: {},
    seen,
    handedOver: false,
    deletedHere: false,
  };

  // A sandbox's listings are evaluated and shown on the admin screen, and go
  // no further. Nothing from a sandbox reaches `properties` or the bucket.
  if (ctx.sandbox) return p;

  // Already on the website: the editors' now. Not one write.
  if (existing) {
    p.handedOver = true;
    return p;
  }

  if (!plan.fields) return p;

  const mirror = ctx.mirror.get(snapshot.listingId);
  // Hidden before it arrived: no draft, and no photos copied for one.
  if (mirror?.hidden_at) return p;
  // Its draft was here and is not any more. Bringing it back would undo an
  // editor's delete every fifteen minutes.
  if (mirror?.state === "on_website") {
    p.deletedHere = true;
    return p;
  }

  await ensureMirror(ctx, p);
  await copyImages(ctx, p);

  if (p.imagesPending > 0) {
    // The draft waits for its whole gallery: once it exists, nothing more is
    // added to it.
    p.holds.push({
      code: "photos_pending",
      fix: "wait",
      message: `${p.imagesReady} of ${p.imagesTotal} photos copied so far; the draft is created when the rest have followed.`,
    });
    return p;
  }
  const failedCount = Object.keys(p.imageFailures).length;
  if (failedCount > 0) {
    p.notes.push({
      code: "photos_failed",
      message: `${failedCount} of ${p.imagesTotal} photos could not be copied (${[
        ...new Set(Object.values(p.imageFailures).map((f) => f.reason)),
      ].join("; ")}). Add them in the editor.`,
    });
  }

  const property = await createProperty(ctx, p, plan.fields);
  p.property = property;
  if (property) await linkPhotos(ctx, p, property);
  return p;
}

// ── phase two: the mirror ───────────────────────────────────────────────

/**
 * What the CRM left out of a draft, as the editor who completes it reads it:
 * the holds that would once have kept it off the website, each now a gap to
 * fill in the CMS. The publish gate still refuses what the law requires.
 */
export function draftGaps(holds: readonly Hold[], unresolved: Unresolved): Note[] {
  const out: Note[] = [];
  for (const h of holds) {
    if (h.code === "unmapped_location") {
      out.push({
        code: "draft_no_area",
        message: `Salesforce gives the area as "${unresolved.location ?? "?"}", which matches no area on the website. Choose the area here.`,
      });
    } else if (h.code === "unmapped_developer") {
      out.push({
        code: "draft_no_developer",
        message: `Salesforce gives the developer as "${unresolved.developer ?? "?"}", which matches no developer on the website. Choose the developer here.`,
      });
    } else if (h.fix === "salesforce") {
      out.push({ code: `draft_${h.code}`, message: h.message });
    }
  }
  return out;
}

type Decision = { p: Planned; state: ListingState; holds: Hold[] };

async function statusPhase(ctx: Ctx, planned: Planned[]): Promise<Decision[]> {
  // The flags, fresh. See "Two phases" above.
  const ids = planned.map((p) => p.snapshot.listingId);
  const flags = new Map<string, { hidden_at: string | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await ctx.admin
      .from("salesforce_listings")
      .select("sf_listing_id, hidden_at")
      .in("sf_listing_id", ids.slice(i, i + 200));
    if (error) throw new Error(`flag read failed: ${error.message}`);
    for (const f of data ?? []) flags.set(f.sf_listing_id, f);
  }

  const rows: Database["public"]["Tables"]["salesforce_listings"]["Insert"][] = [];
  const decisions: Decision[] = [];
  const nowIso = ctx.now.toISOString();

  for (const p of planned) {
    const id = p.snapshot.listingId;
    const mirror = ctx.mirror.get(id);
    const onWebsite = !!p.property && !ctx.sandbox;
    const state: ListingState = decideState({
      sandbox: ctx.sandbox,
      withdrawn: false,
      onWebsite,
      hidden: p.deletedHere || !!flags.get(id)?.hidden_at,
    });

    // On the website, the CRM's gaps are the editor's to fill and the publish
    // gate's to enforce: nothing is held, and nothing waits on a mapping. The
    // notes are kept from the run that made the draft — what Salesforce left
    // out of it — rather than rewritten from a record the website no longer
    // follows.
    const holds = onWebsite ? [] : p.holds;
    const notes = p.handedOver
      ? ((mirror?.notes as Note[] | null) ?? [])
      : onWebsite
        ? [...draftGaps(p.holds, p.unresolved), ...p.notes]
        : p.notes;
    const imagesTotal = p.handedOver ? (mirror?.images_total ?? 0) : p.imagesTotal;
    const imagesReady = p.handedOver ? (mirror?.images_ready ?? 0) : p.imagesReady;

    if (state === "on_website") ctx.summary.onWebsite += 1;
    else if (state === "held") ctx.summary.held += 1;
    else if (state === "hidden") ctx.summary.hidden += 1;
    else if (state === "mirror_only") ctx.summary.mirrorOnly += 1;

    decisions.push({ p, state, holds });
    rows.push({
      sf_listing_id: id,
      org_host: ctx.orgHost,
      sf_listing_name: p.snapshot.listingName,
      sf_property_id: p.snapshot.propertyId,
      sf_reference: p.snapshot.propertyName,
      sf_last_modified_at: p.snapshot.lastModifiedAt,
      state,
      holds: holds as unknown as Json,
      notes: notes as unknown as Json,
      unresolved: (onWebsite ? {} : p.unresolved) as unknown as Json,
      snapshot: p.snapshot as unknown as Json,
      snapshot_hash: p.hash,
      images_total: imagesTotal,
      images_ready: imagesReady,
      image_failures: (p.handedOver ? (mirror?.image_failures ?? {}) : p.imageFailures) as unknown as Json,
      withdrawn_at: null,
      withdrawn_reason: null,
      last_synced_at: nowIso,
      last_error: null,
      ...(p.seen ? { last_seen_at: nowIso } : {}),
    });

    if (p.deletedHere && !flags.get(id)?.hidden_at) {
      // Recorded as a hide, so the screen shows it as one and "Allow on
      // website" is how a deleted draft comes back.
      await ctx.admin.from("salesforce_listings").update({ hidden_at: nowIso }).eq("sf_listing_id", id);
    }
  }

  // Flags an admin owns (approved_at, approved_by, hidden_at, hidden_by) are
  // never in this payload, so the upsert cannot overwrite them.
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await ctx.admin
      .from("salesforce_listings")
      .upsert(rows.slice(i, i + 100), { onConflict: "sf_listing_id" });
    if (error) throw new Error(`mirror write failed: ${error.message}`);
  }
  return decisions;
}

// ── phase three: tell Salesforce ────────────────────────────────────────

/** Step 5 of the guide. v1.3 corrected the URL field's name: it is
 *  `Website_Listing_URL__c`, not the `Website_URL__c` of v1.2. */
export type WriteBack = {
  Website_Status__c?: "Published" | "Deactivated";
  Website_Listing_URL__c?: string | null;
  Website_Error__c?: string | null;
};

const WEBSITE_ERROR_MAX = 32_000;

/**
 * What the CRM team should see on the listing, per the guide's step 5.
 *
 * Their contract: Published with the URL on success; Deactivated with the
 * reason on failure, which takes the listing out of the published set until
 * the CRM team fixes it and publishes it again. Only a failure THEY can fix
 * deactivates. A listing waiting on us — photos still copying — keeps its
 * status, so it stays in the sweep and its draft is made the moment we are
 * done; the error field says what it is waiting for. A listing whose draft is
 * on the website is Published, with its URL, only once an editor has
 * published it there. Null means say nothing: a sandbox, or a listing the CRM
 * itself has already withdrawn.
 */
export function writeBackFor(state: ListingState, holds: readonly Hold[], liveUrl: string | null): WriteBack | null {
  switch (state) {
    case "live":
      return { Website_Status__c: "Published", Website_Listing_URL__c: liveUrl, Website_Error__c: null };
    case "on_website":
      return liveUrl
        ? { Website_Status__c: "Published", Website_Listing_URL__c: liveUrl, Website_Error__c: null }
        : {
            Website_Listing_URL__c: null,
            Website_Error__c: "A draft on the website. The Bazar team edit it and publish it there.",
          };
    case "hidden":
      return {
        Website_Status__c: "Deactivated",
        Website_Listing_URL__c: null,
        Website_Error__c: "Taken off the website by the Bazar team. Speak to them before publishing it again.",
      };
    case "awaiting_approval":
      return {
        Website_Listing_URL__c: null,
        Website_Error__c: "Complete. Waiting for the Bazar team to approve its first appearance on the website.",
      };
    case "held": {
      const theirs = holds.filter((h) => h.fix === "salesforce");
      if (theirs.length) {
        return {
          Website_Status__c: "Deactivated",
          Website_Listing_URL__c: null,
          Website_Error__c: theirs.map((h) => h.message).join("\n").slice(0, WEBSITE_ERROR_MAX),
        };
      }
      const lines = holds.map((h) => (h.fix === "wait" ? `In progress: ${h.message}` : `Waiting on the Bazar website team: ${h.message}`));
      return { Website_Listing_URL__c: null, Website_Error__c: lines.join("\n").slice(0, WEBSITE_ERROR_MAX) || null };
    }
    default:
      return null;
  }
}

/** Only the fields that would change. Republished already means live, so it
 *  is not "corrected" to Published. */
export function writeBackDelta(
  want: WriteBack,
  current: { websiteStatus: string | null; websiteUrl: string | null; websiteError: string | null },
): WriteBack {
  const delta: WriteBack = {};
  if (want.Website_Status__c !== undefined) {
    const same =
      want.Website_Status__c === "Published"
        ? isLiveWebsiteStatus(current.websiteStatus)
        : current.websiteStatus === want.Website_Status__c;
    if (!same) delta.Website_Status__c = want.Website_Status__c;
  }
  if (
    want.Website_Listing_URL__c !== undefined &&
    (want.Website_Listing_URL__c ?? null) !== (current.websiteUrl ?? null)
  ) {
    delta.Website_Listing_URL__c = want.Website_Listing_URL__c;
  }
  if (
    want.Website_Error__c !== undefined &&
    (want.Website_Error__c ?? "").trim() !== (current.websiteError ?? "").trim()
  ) {
    delta.Website_Error__c = want.Website_Error__c;
  }
  return delta;
}

function siteOrigin(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? "https://www.bazarrealestate.ae").replace(/\/+$/, "");
}

async function writeBackPhase(ctx: Ctx, decisions: Decision[]): Promise<void> {
  if (ctx.sandbox || !ctx.writeBack || !ctx.canFetch) return;
  for (const { p, state, holds } of decisions) {
    const property = p.property;
    const liveUrl =
      state === "on_website" && property?.status === "published" ? `${siteOrigin()}${propertyUrl(property)}` : null;
    const want = writeBackFor(state, holds, liveUrl);
    if (!want) continue;
    const delta = writeBackDelta(want, p.snapshot);
    if (Object.keys(delta).length === 0) continue;
    try {
      await salesforceRequest(`sobjects/Property_Listing__c/${p.snapshot.listingId}`, {
        method: "PATCH",
        body: delta,
      });
      ctx.summary.writtenBack += 1;
    } catch (err) {
      const message =
        err instanceof SalesforceError && err.errorCode ? `${err.errorCode}: ${err.message}` : err instanceof Error ? err.message : String(err);
      ctx.summary.errors.push(`write-back ${p.snapshot.listingName ?? p.snapshot.listingId}: ${message}`);
      await ctx.admin
        .from("salesforce_listings")
        .update({ last_error: `Could not write the website status back to Salesforce: ${message}` })
        .eq("sf_listing_id", p.snapshot.listingId);
    }
  }
}

/**
 * Salesforce no longer publishes this listing. Recorded on the mirror and
 * nowhere else: a draft on the website is the website's, so whether it comes
 * down is an editor's decision. The editor shows them the withdrawal and its
 * reason (SalesforceSourceCard).
 */
async function withdraw(ctx: Ctx, row: MirrorRow, reason: string, status: string | null = null): Promise<void> {
  await ctx.admin
    .from("salesforce_listings")
    .update({
      state: "withdrawn",
      withdrawn_at: row.withdrawn_at ?? ctx.now.toISOString(),
      withdrawn_reason: reason,
      // Deactivated is what write-back sets for a listing the CRM team has to
      // fix. Its reasons are exactly what the admin screen should still show.
      ...(status === "Deactivated" ? {} : { holds: [] }),
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
    `on the website ${s.onWebsite}`,
    s.held ? `held ${s.held}` : null,
    s.hidden ? `hidden ${s.hidden}` : null,
    s.mirrorOnly ? `evaluated ${s.mirrorOnly}` : null,
    s.created ? `new drafts ${s.created}` : null,
    s.withdrawn ? `withdrawn ${s.withdrawn}` : null,
    s.imagesCopied ? `photos ${s.imagesCopied}` : null,
    s.writtenBack ? `written back ${s.writtenBack}` : null,
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
  /**
   * The run's clock: every expiry, publish date and retry window is judged
   * against it. The jobs and actions leave it to `new Date()`; tests pin it, so
   * a fixture's dates don't start failing once the calendar passes them.
   */
  now?: Date;
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
    .select("paused, write_back")
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
      now: opts.now ?? new Date(),
      startedAt: Date.now(),
      orgHost: effectiveOrg,
      sandbox: summary.sandbox,
      writeBack: !!settings?.write_back,
      lookups: await loadLookups(admin),
      ...state,
      imageDownloads: 0,
      summary,
      canFetch: isSalesforceConfigured && !!orgHost,
    };

    let snapshots: { snapshot: ListingSnapshot; seen: boolean }[];
    if (reapply) {
      const wanted = new Set(opts.onlyStored);
      snapshots = [...ctx.mirror.values()]
        .filter((m) => wanted.has(m.sf_listing_id) && m.state !== "withdrawn")
        .map((m) => ({ snapshot: upgradeSnapshot(m.snapshot), seen: false }));
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
          await withdraw(ctx, m, a.reason, a.kind === "unpublished" ? a.status : null);
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
    const decisions = await statusPhase(ctx, planned);
    await writeBackPhase(ctx, decisions);

    if (summary.created || summary.withdrawn) (opts.revalidate ?? defaultRevalidate)();

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

/** Route handler or server action only — both may revalidate. */
function defaultRevalidate(): void {
  revalidatePath("/admin/properties");
  revalidatePath("/admin/properties/salesforce");
}
