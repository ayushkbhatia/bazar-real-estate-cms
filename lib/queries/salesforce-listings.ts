import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/db/types";
import type { Hold, Note, Unresolved } from "@/lib/salesforce/listings/plan";

/**
 * What the Salesforce listings screen and the property editor read.
 *
 * Service-role reads: the pages that call these are staff-only already, and
 * the mirror is read together with auth-side data (who approved, who hid)
 * that the anon-key client cannot join.
 */

export type ListingState = Database["public"]["Enums"]["salesforce_listing_state"];

export type SalesforceListingRow = {
  sfListingId: string;
  orgHost: string;
  name: string | null;
  reference: string | null;
  title: string | null;
  location: string | null;
  price: number | null;
  offering: string | null;
  state: ListingState;
  holds: Hold[];
  notes: Note[];
  unresolved: Unresolved;
  imagesTotal: number;
  imagesReady: number;
  approvedAt: string | null;
  hiddenAt: string | null;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
  lastSyncedAt: string | null;
  lastSeenAt: string;
  lastError: string | null;
  property: { id: string; slug: string; reference: string; status: string } | null;
};

type Snap = {
  title?: string | null;
  location?: string | null;
  listingPrice?: number | null;
  propertyPrice?: number | null;
  offering?: string | null;
};

function toRow(r: Record<string, unknown>): SalesforceListingRow {
  const snap = (r.snapshot ?? {}) as Snap;
  const props = r.properties as
    | { id: string; slug: string; reference: string; status: string }
    | { id: string; slug: string; reference: string; status: string }[]
    | null;
  const property = Array.isArray(props) ? (props[0] ?? null) : props;
  return {
    sfListingId: r.sf_listing_id as string,
    orgHost: r.org_host as string,
    name: (r.sf_listing_name as string | null) ?? null,
    reference: (r.sf_reference as string | null) ?? null,
    title: snap.title ?? null,
    location: snap.location ?? null,
    price: snap.listingPrice ?? snap.propertyPrice ?? null,
    offering: snap.offering ?? null,
    state: r.state as ListingState,
    holds: (r.holds as Hold[] | null) ?? [],
    notes: (r.notes as Note[] | null) ?? [],
    unresolved: (r.unresolved as Unresolved | null) ?? {},
    imagesTotal: Number(r.images_total ?? 0),
    imagesReady: Number(r.images_ready ?? 0),
    approvedAt: (r.approved_at as string | null) ?? null,
    hiddenAt: (r.hidden_at as string | null) ?? null,
    withdrawnAt: (r.withdrawn_at as string | null) ?? null,
    withdrawnReason: (r.withdrawn_reason as string | null) ?? null,
    lastSyncedAt: (r.last_synced_at as string | null) ?? null,
    lastSeenAt: r.last_seen_at as string,
    lastError: (r.last_error as string | null) ?? null,
    property,
  };
}

const SELECT =
  "sf_listing_id, org_host, sf_listing_name, sf_reference, snapshot, state, holds, notes, unresolved, images_total, images_ready, approved_at, hidden_at, withdrawn_at, withdrawn_reason, last_synced_at, last_seen_at, last_error, properties(id, slug, reference, status)";

/** Held and awaiting first — the rows someone has to act on — then the rest,
 *  most recently changed first. */
const STATE_ORDER: Record<ListingState, number> = {
  awaiting_approval: 0,
  held: 1,
  hidden: 2,
  live: 3,
  mirror_only: 4,
  withdrawn: 5,
};

export async function listSalesforceListings(): Promise<SalesforceListingRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("salesforce_listings")
    .select(SELECT)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) return [];
  return ((data ?? []) as unknown as Record<string, unknown>[])
    .map(toRow)
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
}

export async function getSalesforceListingForProperty(
  propertyId: string,
): Promise<SalesforceListingRow | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: p } = await admin
    .from("properties")
    .select("salesforce_listing_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (!p?.salesforce_listing_id) return null;
  const { data } = await admin
    .from("salesforce_listings")
    .select(SELECT)
    .eq("sf_listing_id", p.salesforce_listing_id)
    .maybeSingle();
  return data ? toRow(data as unknown as Record<string, unknown>) : null;
}

export type ListingSyncSettings = {
  paused: boolean;
  autoPublish: boolean;
  lastRunAt: string | null;
  lastSummary: Record<string, unknown>;
};

export async function getListingSyncSettings(): Promise<ListingSyncSettings> {
  const admin = createAdminClient();
  const empty = { paused: false, autoPublish: false, lastRunAt: null, lastSummary: {} };
  if (!admin) return empty;
  const { data } = await admin
    .from("salesforce_listing_sync")
    .select("paused, auto_publish, last_run_at, last_summary")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return empty;
  return {
    paused: data.paused,
    autoPublish: data.auto_publish,
    lastRunAt: data.last_run_at,
    lastSummary: (data.last_summary as Record<string, unknown>) ?? {},
  };
}

export type MappingOptions = {
  areas: { id: string; label: string }[];
  developers: { id: string; label: string }[];
  staff: { id: string; label: string }[];
};

/** The choices each mapping dropdown offers. Areas are labelled with their
 *  parent, so "Saadiyat Lagoons" reads as the sub-community it is. */
export async function getMappingOptions(): Promise<MappingOptions> {
  const admin = createAdminClient();
  if (!admin) return { areas: [], developers: [], staff: [] };
  const [areas, developers, staff] = await Promise.all([
    admin.from("areas").select("id, name, kind, parent_id").order("name"),
    admin.from("developers").select("id, name").order("name"),
    admin
      .from("staff")
      .select("user_id, display_name, role, status")
      .eq("status", "active")
      .order("display_name"),
  ]);
  const byId = new Map((areas.data ?? []).map((a) => [a.id, a]));
  return {
    areas: (areas.data ?? [])
      .filter((a) => a.kind !== "emirate")
      .map((a) => {
        const parent = a.parent_id ? byId.get(a.parent_id) : undefined;
        const within = parent && parent.kind !== "emirate" ? ` · in ${parent.name}` : "";
        return { id: a.id, label: `${a.name}${within}` };
      }),
    developers: (developers.data ?? []).map((d) => ({ id: d.id, label: d.name })),
    staff: (staff.data ?? []).map((s) => ({
      id: s.user_id,
      label: `${s.display_name} · ${s.role}`,
    })),
  };
}
