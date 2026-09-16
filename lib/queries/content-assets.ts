import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  ContentAssetKind,
  ContentAssetStatus,
} from "@/lib/schemas/content-asset";
import type { SystemAssetKey } from "@/lib/content-assets/system";
import type { ContentAssetRole } from "@/lib/schemas/content-asset";

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
  /**
   * `html` on a system email saved from the rich-text editor; `text` on
   * everything else (migration 0127).
   */
  body_format: "text" | "html";
  /** outreach · system · form_reply (migration 0128). */
  role: ContentAssetRole;
  /** The Arabic twins (migration 0129). Null until somebody writes them. */
  subject_ar: string | null;
  body_ar: string | null;
  status: ContentAssetStatus;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const FIELDS =
  "id, kind, slug, name, category, subject, subject_ar, body, body_ar, body_format, role, notes, follow_up_after_days, next_asset_id, system_key, status, position, created_at, updated_at, deleted_at";

export async function listContentAssets(opts?: {
  kind?: ContentAssetKind;
  /** Trash view. Default false — the list shows live assets. */
  trashed?: boolean;
  /**
   * "outreach" is what an advisor sends by hand; "system" is the seventeen
   * transactional emails; "form_reply" is an editor's answer to a public
   * form. Separate tabs because they answer different questions — what do I
   * send this lead, what does the site send on its own, and what does this
   * form reply with. Omit for all three.
   */
  scope?: ContentAssetRole;
}): Promise<ContentAssetRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createSupabaseServerClient();
    let q = supabase.from("content_assets").select(FIELDS);
    q = opts?.trashed
      ? q.not("deleted_at", "is", null)
      : q.is("deleted_at", null);
    if (opts?.kind) q = q.eq("kind", opts.kind);
    if (opts?.scope) q = q.eq("role", opts.scope);
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

/**
 * The row behind one system email, whatever its status. Null when the row is
 * missing — the migration that seeds it has not run here — or unreadable.
 */
export async function getSystemAssetRow(
  key: SystemAssetKey,
): Promise<ContentAssetRow | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("content_assets")
      .select(FIELDS)
      .eq("system_key", key)
      .maybeSingle();
    if (error) throw error;
    return (data as ContentAssetRow | null) ?? null;
  } catch (error) {
    console.error("[getSystemAssetRow]", error);
    return null;
  }
}

/**
 * The replies an editor has written, newest first. Drafts included: the
 * library lists them, and the assignment picker shows a draft as unavailable
 * rather than hiding the work.
 */
export async function listFormReplies(): Promise<ContentAssetRow[]> {
  return listContentAssets({ scope: "form_reply" });
}

export type FormAssignment = {
  formKey: string;
  assetId: string;
  assetName: string;
  status: ContentAssetStatus;
  /** True once the row is trashed — assigned, but sending nothing. */
  trashed: boolean;
};

/**
 * Which reply each form is pointed at. One read for the whole mapping table,
 * keyed by form so the page can answer "and this one?" without a query each.
 */
export async function listFormAssignments(): Promise<
  Record<string, FormAssignment>
> {
  if (!isSupabaseConfigured) return {};
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("forms")
      .select("key, reply_asset_id, content_assets(id, name, status, deleted_at)")
      .not("reply_asset_id", "is", null);
    if (error) throw error;
    const out: Record<string, FormAssignment> = {};
    for (const row of data ?? []) {
      const asset = Array.isArray(row.content_assets)
        ? row.content_assets[0]
        : row.content_assets;
      if (!asset) continue;
      out[row.key] = {
        formKey: row.key,
        assetId: asset.id,
        assetName: asset.name,
        status: asset.status as ContentAssetStatus,
        trashed: asset.deleted_at !== null,
      };
    }
    return out;
  } catch (error) {
    console.error("[listFormAssignments]", error);
    return {};
  }
}

/** How many forms point at each reply. Drives the library's "used by" line. */
export function assignmentCounts(
  assignments: Record<string, FormAssignment>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const a of Object.values(assignments)) {
    (out[a.assetId] ??= []).push(a.formKey);
  }
  return out;
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
