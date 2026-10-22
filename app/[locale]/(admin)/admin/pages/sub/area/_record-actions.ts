"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { drainLocationEvents } from "@/lib/salesforce/locations";
import { reportError } from "@/lib/observability";
import { slugify } from "@/lib/slug";
import { subPageSlug } from "@/lib/master-pages/subpages";
import { describeAreaBlockers } from "@/lib/area-usage";
import { getAreaUsage } from "@/lib/queries/area-usage";
import {
  areaCreateSchema,
  areaEditSchema,
  normaliseAreaInput,
  parentError,
  AREA_EDIT_ROLES,
  AREA_DELETE_ROLES,
  type AreaKind,
} from "@/lib/schemas/area";

const AREA_ROLES = AREA_EDIT_ROLES;

export type AreaSaveResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Tell Salesforce now rather than at the next cron. The save itself queued the
 * event (0168's trigger on `areas`); this sends it once the response is out,
 * so a slow or unreachable org never holds up the editor. Whatever fails here
 * the lead-sync cron sends later.
 */
function syncLocationsAfterSave(): void {
  const admin = createAdminClient();
  if (!admin) return;
  after(async () => {
    try {
      await drainLocationEvents(admin);
    } catch (e) {
      await reportError(e, { source: "salesforce/locations.after-save" });
    }
  });
}

/** The parent's kind, so the hierarchy rule can be checked before writing. */
async function parentKindOf(parentId: string | null): Promise<AreaKind | null> {
  if (!parentId) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("areas")
    .select("kind")
    .eq("id", parentId)
    .maybeSingle();
  return (data?.kind as AreaKind | undefined) ?? null;
}

export async function updateArea(
  id: string,
  raw: Record<string, unknown>,
): Promise<AreaSaveResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(AREA_ROLES);

  const parsed = areaEditSchema.safeParse(normaliseAreaInput(raw));
  if (!parsed.success)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };

  const input = parsed.data;
  const badParent = parentError({
    id,
    kind: input.kind,
    parentId: input.parent_id ?? null,
    parentKind: await parentKindOf(input.parent_id ?? null),
  });
  if (badParent)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { parent_id: badParent },
    };

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("areas")
    .select("slug, name")
    .eq("id", id)
    .maybeSingle();

  // Same flat-URL rule as create: no two areas may share a public link.
  const { data: clash } = await supabase
    .from("areas")
    .select("id")
    .eq("slug", input.slug)
    .neq("id", id)
    .limit(1);
  if (clash && clash.length > 0)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { slug: "Another area already uses this link." },
    };

  const { data, error } = await supabase
    .from("areas")
    .update({
      name: input.name,
      name_ar: input.name_ar ?? null,
      slug: input.slug,
      kind: input.kind,
      parent_id: input.parent_id ?? null,
      description: input.description ?? null,
      description_ar: input.description_ar ?? null,
      seo_meta: {
        meta_title: input.meta_title ?? null,
        meta_description: input.meta_description ?? null,
      },
      geo:
        input.lat != null && input.lng != null
          ? { lat: input.lat, lng: input.lng }
          : null,
    })
    .eq("id", id)
    .select("slug")
    .maybeSingle();

  if (error) {
    if (error.code === "23505")
      return {
        status: "error",
        message: "That slug is already used under the same parent.",
        fieldErrors: { slug: "Already in use" },
      };
    return { status: "error", message: error.message };
  }
  if (!data)
    return {
      status: "error",
      message: "Not saved — your account may not be allowed to edit areas.",
    };

  await logAudit({
    action: "area.update",
    target_kind: "area",
    target_id: id,
    before: before ?? null,
    after: { name: input.name, slug: input.slug },
  });

  syncLocationsAfterSave();

  revalidatePath("/admin/pages/sub/area");
  revalidatePath(`/admin/areas/${id}`);
  revalidateLocalised(`/areas/${data.slug}`);
  // A slug change moves the public page; the old path needs clearing too.
  if (before?.slug && before.slug !== data.slug)
    revalidateLocalised(`/areas/${before.slug}`);
  revalidateLocalised("/areas");
  return { status: "ok", message: "Saved." };
}

/** The created row, so a caller that can't navigate away can use it in place. */
export type CreatedArea = {
  id: string;
  name: string;
  slug: string;
  kind: AreaKind;
};

export type CreateAreaResult =
  | { status: "ok"; id: string; area: CreatedArea }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export async function createArea(raw: {
  name: string;
  /** Arabic name, collected at creation — see the note on `areaCreateSchema`. */
  name_ar?: string | null;
  slug: string;
  kind: string;
  parent_id: string | null;
  /**
   * Optional map centroid. The property wizard offers the listing's own pin
   * here, which is usually the only coordinate anyone has for a brand-new
   * area — and it's what puts the area on the maps.
   */
  geo?: { lat: number; lng: number } | null;
  /** Optional opening paragraph, used as the guide intro until one is written. */
  description?: string | null;
}): Promise<CreateAreaResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(AREA_ROLES);

  const parsed = areaCreateSchema.safeParse(
    normaliseAreaInput({
      ...raw,
      slug: slugify(raw.slug || raw.name),
    }),
  );
  if (!parsed.success)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };

  const input = parsed.data;
  const badParent = parentError({
    kind: input.kind,
    parentId: input.parent_id ?? null,
    parentKind: await parentKindOf(input.parent_id ?? null),
  });
  if (badParent)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { parent_id: badParent },
    };

  const supabase = await createSupabaseServerClient();

  // `areas` only constrains (parent_id, slug), but /areas/<slug> is a flat
  // URL space — two areas under different parents would collide on one public
  // page. 0076 makes the slug globally unique; this check gives the editor a
  // field-level message either way.
  const { data: clash } = await supabase
    .from("areas")
    .select("id")
    .eq("slug", input.slug)
    .limit(1);
  if (clash && clash.length > 0)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { slug: "Another area already uses this link." },
    };

  const { data, error } = await supabase
    .from("areas")
    .insert({
      name: input.name,
      name_ar: input.name_ar ?? null,
      slug: input.slug,
      kind: input.kind,
      parent_id: input.parent_id ?? null,
      geo: raw.geo ?? null,
      description: raw.description?.trim() || null,
    })
    .select("id, name, slug, kind")
    .maybeSingle();

  if (error) {
    if (error.code === "23505")
      return {
        status: "error",
        message: "That link is already in use.",
        fieldErrors: { slug: "Already in use" },
      };
    return { status: "error", message: error.message };
  }
  if (!data)
    return {
      status: "error",
      message: "Not created — your account may not be allowed to add areas.",
    };

  await logAudit({
    action: "area.create",
    target_kind: "area",
    target_id: data.id,
    before: null,
    after: { name: input.name, slug: input.slug, kind: input.kind },
  });

  syncLocationsAfterSave();

  revalidatePath("/admin/pages/sub/area");
  revalidateLocalised("/areas");
  // The public guide exists from this moment — clear its path and the
  // sitemap so it's crawlable without waiting for the next ISR window.
  revalidateLocalised(`/areas/${input.slug}`);
  revalidatePath("/sitemap.xml");
  return {
    status: "ok",
    id: data.id,
    area: {
      id: data.id,
      name: data.name,
      slug: data.slug,
      kind: data.kind as AreaKind,
    },
  };
}

export type DeleteAreaResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/**
 * Permanently delete an area — its record, its guide content and its page
 * document.
 *
 * Refused while any listing, project or child area still sits in it: those
 * links used to be ON DELETE SET NULL, so a delete quietly dropped the records
 * out of every area filter and breadcrumb. Migration 0167 makes the database
 * refuse it as well; this check runs first so the editor is told which records
 * to move, and a 23503 from the trigger (a listing added in the meantime) is
 * passed back in its own words.
 */
export async function deleteArea(
  id: string,
  /** Typed by the operator; must match the area name exactly. */
  confirmation: string,
): Promise<DeleteAreaResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(AREA_DELETE_ROLES);

  const supabase = await createSupabaseServerClient();
  const { data: record, error: readError } = await supabase
    .from("areas")
    .select("id, name, slug, kind, parent_id")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };
  if (!record) return { status: "error", message: "Area not found." };

  const blockers = describeAreaBlockers(
    await getAreaUsage({ id: record.id, slug: record.slug }),
  );
  if (blockers)
    return {
      status: "error",
      message: `${record.name} still has ${blockers}. Move them to another area first — nothing was deleted.`,
    };

  if (confirmation.trim() !== record.name)
    return {
      status: "error",
      message: "The name you typed doesn't match, so nothing was deleted.",
    };

  const { data: deleted, error } = await supabase
    .from("areas")
    .delete()
    .eq("id", id)
    .select("id");
  // A 23503 here is 0167's trigger, whose message already names what is linked.
  if (error) return { status: "error", message: error.message };
  if (!deleted || deleted.length === 0)
    return {
      status: "error",
      message: "Not deleted — your account may not be allowed to delete areas.",
    };

  // The page document is keyed by slug, not a foreign key, so nothing cascades
  // to it. Left behind, an area recreated under the same slug would silently
  // inherit the old layout.
  await supabase
    .from("pages")
    .delete()
    .eq("slug", subPageSlug("area", record.slug));

  // The audit entry is the only record that this area ever existed.
  await logAudit({
    action: "area.delete",
    target_kind: "area",
    target_id: record.id,
    before: {
      name: record.name,
      slug: record.slug,
      kind: record.kind,
      parent_id: record.parent_id,
    },
    after: null,
  });

  revalidatePath("/admin/pages/sub/area");
  revalidateLocalised("/areas");
  revalidateLocalised(`/areas/${record.slug}`);
  revalidatePath("/sitemap.xml");
  // Salesforce's area picklists can't be told: the Website Locations API adds
  // and renames only. 0168 records the delete as a held event for whoever
  // retires the value there.
  const inSalesforce = record.kind === "area" || record.kind === "sub_community";
  return {
    status: "ok",
    message: inSalesforce
      ? `Deleted "${record.name}". Salesforce still lists it as an area until it is removed there.`
      : `Deleted "${record.name}".`,
  };
}

/** Used by the create wizard so it can land on the new record's editor. */
export async function goToAreaRecord(id: string): Promise<never> {
  redirect(`/admin/areas/${id}`);
}
