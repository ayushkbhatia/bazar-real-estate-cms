"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import {
  contentAssetSchema,
  normaliseContentAssetInput,
} from "@/lib/schemas/content-asset";

/**
 * Writes for the Content Assets library.
 *
 * Roles match /admin/pages rather than /admin/enquiries: an agent can *use* an
 * asset from the enquiry composer but can't rewrite the copy the whole team
 * sends. RLS enforces the same list, so a direct PostgREST call can't route
 * around this.
 */
const ASSET_WRITE_ROLES = ["admin", "editor", "marketing"] as const;

export type AssetActionResult =
  | { status: "ok"; message?: string; id?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

type StaffCtxOk = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: { id: string };
};
type StaffCtx = StaffCtxOk | { error: string };

function isErr(c: StaffCtx): c is { error: string } {
  return "error" in c;
}

async function staffCtx(): Promise<StaffCtx> {
  if (!isSupabaseConfigured) return { error: "Supabase env vars are not set." };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign-in required." };
  return { supabase, user };
}

function revalidate(id?: string) {
  revalidatePath("/admin/content-assets");
  if (id) revalidatePath(`/admin/content-assets/${id}`);
  // The enquiry composer reads the published list.
  revalidatePath("/admin/enquiries", "layout");
}

/** Shared parse step so create and update reject identically. */
function parse(raw: Record<string, unknown>):
  | { ok: true; value: ReturnType<typeof contentAssetSchema.parse> }
  | { ok: false; result: AssetActionResult } {
  const parsed = contentAssetSchema.safeParse(normaliseContentAssetInput(raw));
  if (parsed.success) return { ok: true, value: parsed.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return {
    ok: false,
    result: {
      status: "error",
      message: "Fix the highlighted fields before saving.",
      fieldErrors,
    },
  };
}

export async function createContentAsset(
  raw: Record<string, unknown>,
): Promise<AssetActionResult> {
  if (isSupabaseConfigured) await requireRole(ASSET_WRITE_ROLES);
  const ctx = await staffCtx();
  if (isErr(ctx)) return { status: "error", message: ctx.error };

  const p = parse(raw);
  if (!p.ok) return p.result;

  const { data, error } = await ctx.supabase
    .from("content_assets")
    .insert({ ...p.value, created_by: ctx.user.id })
    .select("id")
    .maybeSingle();

  if (error) {
    // The slug is the one thing a human collides on, and Postgres's own
    // message names a constraint rather than the field.
    if (error.code === "23505")
      return {
        status: "error",
        message: "That slug is already taken.",
        fieldErrors: { slug: "Already in use." },
      };
    return { status: "error", message: error.message };
  }
  if (!data) return { status: "error", message: "Could not create the asset." };

  await logAudit({
    action: "content_asset.created",
    target_kind: "content_asset",
    target_id: data.id,
    before: null,
    after: { slug: p.value.slug, kind: p.value.kind, status: p.value.status },
  });

  revalidate(data.id);
  return { status: "ok", message: "Asset created.", id: data.id };
}

export async function updateContentAsset(
  id: string,
  raw: Record<string, unknown>,
): Promise<AssetActionResult> {
  if (isSupabaseConfigured) await requireRole(ASSET_WRITE_ROLES);
  const ctx = await staffCtx();
  if (isErr(ctx)) return { status: "error", message: ctx.error };

  const p = parse(raw);
  if (!p.ok) return p.result;

  // Self-reference is a database constraint too; catching it here lets the
  // editor point at the field instead of surfacing a constraint name.
  if (p.value.next_asset_id === id)
    return {
      status: "error",
      message: "An asset can't follow itself.",
      fieldErrors: { next_asset_id: "Pick a different asset." },
    };

  const { data: before } = await ctx.supabase
    .from("content_assets")
    .select("slug, kind, status, subject, body")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await ctx.supabase
    .from("content_assets")
    .update(p.value)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505")
      return {
        status: "error",
        message: "That slug is already taken.",
        fieldErrors: { slug: "Already in use." },
      };
    return { status: "error", message: error.message };
  }
  if (!data) return { status: "error", message: "Not found / not allowed." };

  await logAudit({
    action: "content_asset.updated",
    target_kind: "content_asset",
    target_id: id,
    before: before ?? null,
    after: { slug: p.value.slug, kind: p.value.kind, status: p.value.status },
  });

  revalidate(id);
  return { status: "ok", message: "Saved.", id };
}

/**
 * Soft delete. The row stays so a message sent from this asset still has a
 * source to point at, and so the trash view can restore it.
 */
export async function trashContentAsset(
  id: string,
): Promise<AssetActionResult> {
  if (isSupabaseConfigured) await requireRole(ASSET_WRITE_ROLES);
  const ctx = await staffCtx();
  if (isErr(ctx)) return { status: "error", message: ctx.error };

  const { data, error } = await ctx.supabase
    .from("content_assets")
    .update({ deleted_at: new Date().toISOString(), status: "draft" })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, slug")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Not found / already trashed." };

  // Anything pointing at this asset as its next step now points at a row the
  // picker won't show. Clear the link rather than leave a dangling sequence.
  await ctx.supabase
    .from("content_assets")
    .update({ next_asset_id: null })
    .eq("next_asset_id", id);

  await logAudit({
    action: "content_asset.trashed",
    target_kind: "content_asset",
    target_id: id,
    before: { slug: data.slug },
    after: null,
  });

  revalidate(id);
  return { status: "ok", message: "Moved to trash." };
}

export async function restoreContentAsset(
  id: string,
): Promise<AssetActionResult> {
  if (isSupabaseConfigured) await requireRole(ASSET_WRITE_ROLES);
  const ctx = await staffCtx();
  if (isErr(ctx)) return { status: "error", message: ctx.error };

  const { data, error } = await ctx.supabase
    .from("content_assets")
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Not found / not trashed." };

  await logAudit({
    action: "content_asset.restored",
    target_kind: "content_asset",
    target_id: id,
    before: null,
    after: null,
  });

  revalidate(id);
  // Restored as a draft — publishing again is a deliberate second step.
  return { status: "ok", message: "Restored as a draft." };
}
