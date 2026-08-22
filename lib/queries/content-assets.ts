import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  ContentAssetKind,
  ContentAssetStatus,
} from "@/lib/schemas/content-asset";
import type { SystemAssetKey } from "@/lib/content-assets/system";

/**
 * Reads for the Content Assets library.
 *
 * Every read goes through the cookie-aware server client: RLS grants SELECT to
 * staff only, and nothing here is public. There is deliberately no
 * `createSupabasePublicClient` path — an unpublished asset is internal
 * drafting, not site content.
 */

export type ContentAssetRow = {
  id: string;
  kind: ContentAssetKind;
  slug: string;
  name: string;
  category: string;
  subject: string | null;
  body: string;
  notes: string | null;
  follow_up_after_days: number | null;
  next_asset_id: string | null;
  /**
   * Non-null on the four rows that override a transactional email
   * (migration 0117). Null on everything an advisor writes by hand.
   */
  system_key: SystemAssetKey | null;
  status: ContentAssetStatus;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const FIELDS =
  "id, kind, slug, name, category, subject, body, notes, follow_up_after_days, next_asset_id, system_key, status, position, created_at, updated_at, deleted_at";

export async function listContentAssets(opts?: {
  kind?: ContentAssetKind;
  /** Trash view. Default false — the list shows live assets. */
  trashed?: boolean;
  /**
   * "outreach" is what an advisor sends by hand; "system" is the four
   * transactional emails. They are separate tabs because they answer
   * different questions — what do I send this lead, versus what does the
   * site send on its own. Omit for both.
   */
  scope?: "outreach" | "system";
}): Promise<ContentAssetRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createSupabaseServerClient();
    let q = supabase.from("content_assets").select(FIELDS);
    q = opts?.trashed
      ? q.not("deleted_at", "is", null)
      : q.is("deleted_at", null);
    if (opts?.kind) q = q.eq("kind", opts.kind);
    if (opts?.scope === "outreach") q = q.is("system_key", null);
    if (opts?.scope === "system") q = q.not("system_key", "is", null);
    const { data, error } = await q
      .order("kind", { ascending: true })
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ContentAssetRow[];
  } catch (error) {
    console.error("[listContentAssets]", error);
    return [];
  }
}

/**
 * What the enquiry composer offers: published, untrashed, one channel.
 * An empty list is a legitimate state — the composer falls back to a blank
 * message rather than blocking the advisor.
 *
 * System rows are excluded. A published enquiry acknowledgement is an email
 * the site already sent on its own; offering it to an advisor as something
 * to send by hand would just send the lead the same message twice.
 */
export async function listPublishedAssets(
  kind: ContentAssetKind,
): Promise<ContentAssetRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("content_assets")
      .select(FIELDS)
      .eq("kind", kind)
      .eq("status", "published")
      .is("system_key", null)
      .is("deleted_at", null)
      .order("position", { ascending: true });
    if (error) throw error;
    return (data ?? []) as ContentAssetRow[];
  } catch (error) {
    console.error("[listPublishedAssets]", error);
    return [];
  }
}

export async function getContentAssetById(
  id: string,
): Promise<ContentAssetRow | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("content_assets")
      .select(FIELDS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as ContentAssetRow | null) ?? null;
  } catch (error) {
    console.error("[getContentAssetById]", error);
    return null;
  }
}

/**
 * Fetch by slug — the seam other surfaces use to adopt an asset without
 * hardcoding copy. Returns null when the asset is missing or unpublished so
 * callers keep whatever fallback they already have.
 */
export async function getContentAsset(
  slug: string,
): Promise<ContentAssetRow | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("content_assets")
      .select(FIELDS)
      .eq("slug", slug)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return (data as ContentAssetRow | null) ?? null;
  } catch (error) {
    console.error("[getContentAsset]", error);
    return null;
  }
}

/**
 * Assets selectable as a "next step", excluding self, trashed rows and the
 * system emails — a sequence is advisor choreography, and nothing an advisor
 * decides can schedule a transactional email.
 */
export async function listSequenceCandidates(
  excludeId: string | null,
): Promise<Pick<ContentAssetRow, "id" | "name" | "kind">[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createSupabaseServerClient();
    let q = supabase
      .from("content_assets")
      .select("id, name, kind")
      .is("system_key", null)
      .is("deleted_at", null);
    if (excludeId) q = q.neq("id", excludeId);
    const { data, error } = await q.order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Pick<ContentAssetRow, "id" | "name" | "kind">[];
  } catch (error) {
    console.error("[listSequenceCandidates]", error);
    return [];
  }
}
