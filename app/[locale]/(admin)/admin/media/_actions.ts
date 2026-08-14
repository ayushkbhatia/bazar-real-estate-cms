"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { MEDIA_BUCKET } from "@/lib/media";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { buildMediaUsageIndex } from "@/lib/queries/media-usage";
import { summariseUsage } from "@/lib/media-usage";

const MEDIA_ROLES = ["admin", "editor", "marketing", "agent"] as const;
/** Permanently destroying a file is admin-only — trashing isn't. */
const MEDIA_DESTROY_ROLES = ["admin"] as const;

// Uploads live in ./_upload-actions.ts + ./_upload-client.ts — the bytes go
// browser → Storage on a signed URL, so there is no upload action here.

export type MediaMutationResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/**
 * Re-check usage server-side before anything destructive. The UI already hides
 * the button for assets that are in use, but the button is a hint, not a
 * guarantee — someone else may have attached the file since the page rendered.
 */
async function assertUnused(
  asset: { id: string; storage_key: string },
): Promise<string | null> {
  const index = await buildMediaUsageIndex([asset]);
  if (index.partial) {
    return `Couldn't verify where this file is used (${index.failedSources.join(", ")} unavailable). Nothing was deleted.`;
  }
  const usages = index.byAsset.get(asset.id) ?? [];
  if (usages.length > 0) {
    return `Still in use — ${summariseUsage(usages)}. Detach it first.`;
  }
  return null;
}

async function loadAsset(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, filename, storage_key, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return { asset: null, message: error.message };
  if (!data) return { asset: null, message: "Asset not found." };
  return { asset: data, message: null };
}

/** Soft-delete: the row keeps its storage object so a restore is free. */
export async function trashMedia(id: string): Promise<MediaMutationResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(MEDIA_ROLES);

  const { asset, message } = await loadAsset(id);
  if (!asset) return { status: "error", message: message ?? "Asset not found." };
  if (asset.deleted_at)
    return { status: "error", message: "Already in the trash." };

  const blocked = await assertUnused(asset);
  if (blocked) return { status: "error", message: blocked };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media_assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Not found, or your account is not allowed to change it.",
    };

  await logAudit({
    action: "media.trash",
    target_kind: "media_asset",
    target_id: id,
    before: { filename: asset.filename, deleted_at: null },
    after: { deleted_at: "now" },
  });
  revalidatePath("/admin/media");
  return { status: "ok", message: `"${asset.filename}" moved to trash.` };
}

export async function restoreMedia(id: string): Promise<MediaMutationResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(MEDIA_ROLES);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media_assets")
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id, filename")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data)
    return { status: "error", message: "Not in the trash any more." };

  await logAudit({
    action: "media.restore",
    target_kind: "media_asset",
    target_id: id,
    before: null,
    after: { filename: data.filename },
  });
  revalidatePath("/admin/media");
  return { status: "ok", message: `"${data.filename}" restored.` };
}

/**
 * Permanent delete: storage object first, then the row. Storage-first means a
 * failure halfway leaves a row pointing at a missing object (visible, fixable)
 * rather than an orphaned object nothing references (invisible, billable).
 */
export async function deleteMediaPermanently(
  id: string,
): Promise<MediaMutationResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(MEDIA_DESTROY_ROLES);

  const { asset, message } = await loadAsset(id);
  if (!asset) return { status: "error", message: message ?? "Asset not found." };
  if (!asset.deleted_at)
    return {
      status: "error",
      message: "Move it to the trash first.",
    };

  const blocked = await assertUnused(asset);
  if (blocked) return { status: "error", message: blocked };

  const supabase = await createSupabaseServerClient();
  const removal = await supabase.storage
    .from(MEDIA_BUCKET)
    .remove([asset.storage_key]);
  if (removal.error)
    return {
      status: "error",
      message: `Storage delete failed: ${removal.error.message}`,
    };

  const { error } = await supabase.from("media_assets").delete().eq("id", id);
  if (error)
    return {
      status: "error",
      message: `File removed from storage, but the record could not be deleted: ${error.message}`,
    };

  await logAudit({
    action: "media.delete",
    target_kind: "media_asset",
    target_id: id,
    before: { filename: asset.filename, storage_key: asset.storage_key },
    after: null,
  });
  revalidatePath("/admin/media");
  return { status: "ok", message: `"${asset.filename}" deleted for good.` };
}

/** Alt text caps. 300 is the existing property-side limit; Arabic gets 1.5x,
 *  because the same sentence runs longer in Arabic and a copied cap truncates
 *  valid translations. */
const ALT_MAX = 300;
const ALT_AR_MAX = 450;

/**
 * Alt text for one asset, in both languages.
 *
 * Alt lives on `media_assets`, so it is a property of the *file* and not of any
 * one attachment — which is why it belongs here rather than only on the two
 * property-scoped inputs that have been the sole way to edit it. Those cover
 * photos attached to a listing; the other several hundred assets, including
 * every image on a development, an area, an article or a landing page, had no
 * alt editor at all.
 *
 * The search box on this screen has always matched on `alt_text`
 * (`page.tsx:90`), so it was possible to find a file by an alt text the screen
 * would not show you and you could not change.
 *
 * Not audit-logged. Alt text is copy, it changes often, and the log is where
 * price and slug edits live — see the note on bulk-approve flooding in
 * ADR-0007.
 */
export async function saveMediaAlt(
  id: string,
  alt: string,
  altAr: string,
): Promise<MediaMutationResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(MEDIA_ROLES);

  const { asset, message } = await loadAsset(id);
  if (!asset) return { status: "error", message: message ?? "Asset not found." };

  const clean = (v: string, max: number) => {
    const t = v.trim().slice(0, max);
    return t === "" ? null : t;
  };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("media_assets")
    .update({
      alt_text: clean(alt, ALT_MAX),
      // Named explicitly rather than left out when blank: this is a full-column
      // update, so an omitted key would be the twin silently kept while the
      // editor believes they cleared it.
      alt_text_ar: clean(altAr, ALT_AR_MAX),
    })
    .eq("id", id);
  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/media");
  return { status: "ok", message: "Alt text saved." };
}
