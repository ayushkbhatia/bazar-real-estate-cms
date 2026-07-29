import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  ContentAssetKind,
  ContentAssetStatus,
} from "@/lib/schemas/content-asset";

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
  status: ContentAssetStatus;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const FIELDS =
  "id, kind, slug, name, category, subject, body, notes, follow_up_after_days, next_asset_id, status, position, created_at, updated_at, deleted_at";

export async function listContentAssets(opts?: {
  kind?: ContentAssetKind;
  /** Trash view. Default false — the list shows live assets. */
  trashed?: boolean;
}): Promise<ContentAssetRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createSupabaseServerClient();
    let q = supabase.from("content_assets").select(FIELDS);
    q = opts?.trashed
      ? q.not("deleted_at", "is", null)
      : q.is("deleted_at", null);
    if (opts?.kind) q = q.eq("kind", opts.kind);
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

/** Assets selectable as a "next step", excluding self and trashed rows. */
export async function listSequenceCandidates(
  excludeId: string | null,
): Promise<Pick<ContentAssetRow, "id" | "name" | "kind">[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createSupabaseServerClient();
    let q = supabase
      .from("content_assets")
      .select("id, name, kind")
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
