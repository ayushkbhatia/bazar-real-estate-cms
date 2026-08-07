"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { propertyEditSchema, normaliseEditInput } from "@/lib/schemas/property";
import { propertyUrl } from "@/lib/queries/properties";
import {
  evaluatePublishability,
  type PublishabilityResult,
} from "@/lib/publishability";
import { logAudit } from "@/lib/audit";
import { friendlyPropertyConstraintError } from "@/lib/property-constraints";
import { requireRole } from "@/lib/auth";

const PROPERTY_ROLES = ["admin", "editor", "agent"] as const;

async function revalidatePropertyPaths(propertyId: string) {
  if (!isSupabaseConfigured) return;
  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${propertyId}`);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("properties")
    .select("slug, reference, status")
    .eq("id", propertyId)
    .maybeSingle();
  if (data?.status === "published") {
    revalidatePath(propertyUrl(data));
    revalidatePath("/buy");
    revalidatePath("/buy/ready");
    revalidatePath("/buy/resale");
    revalidatePath("/buy/search");
    revalidatePath("/rent");
    revalidatePath("/rent/search");
    revalidatePath("/off-plan/search");
    revalidatePath("/");
  }
}

export type SaveResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export async function updateProperty(
  id: string,
  raw: Record<string, unknown>,
): Promise<SaveResult> {
  if (!isSupabaseConfigured)
    return {
      status: "error",
      message:
        "Supabase env vars are not set. Configure NEXT_PUBLIC_SUPABASE_URL + ANON in .env.local.",
    };
  await requireRole(PROPERTY_ROLES);

  const normalised = normaliseEditInput(raw);
  const parsed = propertyEditSchema.safeParse(normalised);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Please fix the errors below.", fieldErrors };
  }

  const { meta_title, meta_description, ...rest } = parsed.data;

  const updateData = {
    ...rest,
    seo: {
      slug: rest.slug,
      meta_title: meta_title ?? null,
      meta_description: meta_description ?? null,
    },
  };

  const supabase = await createSupabaseServerClient();

  const { data: before } = await supabase
    .from("properties")
    .select("slug, title, price_aed, status")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("properties")
    .update(updateData)
    .eq("id", id)
    .select("slug, reference, status")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: "Slug already in use — pick a different one.",
        fieldErrors: { slug: "Already in use" },
      };
    }
    const friendly = friendlyPropertyConstraintError(error);
    if (friendly) {
      return {
        status: "error",
        message: friendly.message,
        fieldErrors: friendly.fieldErrors,
      };
    }
    return { status: "error", message: error.message };
  }
  if (!data) {
    return {
      status: "error",
      message:
        "Property not found, or your account is not allowed to edit it.",
    };
  }

  // Audit any sensitive-field change.
  if (before) {
    const sensitiveChanges: Record<string, { before: unknown; after: unknown }> = {};
    if (before.slug !== rest.slug)
      sensitiveChanges.slug = { before: before.slug, after: rest.slug };
    if (before.title !== rest.title)
      sensitiveChanges.title = { before: before.title, after: rest.title };
    if (Number(before.price_aed) !== Number(rest.price_aed))
      sensitiveChanges.price_aed = {
        before: Number(before.price_aed),
        after: Number(rest.price_aed),
      };
    if (Object.keys(sensitiveChanges).length > 0) {
      await logAudit({
        action: "property.update",
        target_kind: "property",
        target_id: id,
        before: sensitiveChanges,
        after: null,
      });
    }
  }

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  if (data.status === "published") {
    revalidatePath(propertyUrl(data));
    revalidatePath("/buy");
    revalidatePath("/buy/ready");
    revalidatePath("/buy/resale");
    revalidatePath("/buy/search");
    revalidatePath("/rent");
    revalidatePath("/rent/search");
    revalidatePath("/off-plan/search");
    revalidatePath("/");
  }

  return { status: "ok", message: "Saved." };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AssignAgentResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/**
 * Assign (or clear) the advisor responsible for a single property. Standalone
 * from the main edit form — the form's partial update never touches
 * `assigned_agent_id`, so this and a form save don't clobber each other. The
 * assigned agent surfaces on the public `/p/[slug]` contact card and on their
 * `/agents/[slug]` profile listings; enquiry routing reads it too.
 *
 * For multi-property assignment (with a digest email to the agent), use the
 * bulk-reassign tool on the properties list instead.
 */
export async function assignAgent(
  propertyId: string,
  agentId: string | null,
): Promise<AssignAgentResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PROPERTY_ROLES);

  if (agentId !== null && !UUID_RE.test(agentId)) {
    return { status: "error", message: "Invalid agent id." };
  }

  const supabase = await createSupabaseServerClient();

  // Only allow assigning to an active agent (defence-in-depth against a stale
  // or tampered id). Clearing the assignment (null) skips this.
  if (agentId !== null) {
    const { data: agent } = await supabase
      .from("staff")
      .select("user_id")
      .eq("user_id", agentId)
      .eq("role", "agent")
      .eq("status", "active")
      .maybeSingle();
    if (!agent) {
      return {
        status: "error",
        message: "That advisor is no longer an active agent.",
      };
    }
  }

  const { data: before } = await supabase
    .from("properties")
    .select("assigned_agent_id")
    .eq("id", propertyId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("properties")
    .update({ assigned_agent_id: agentId })
    .eq("id", propertyId)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Property not found, or your account is not allowed to edit it.",
    };

  await logAudit({
    action: "property.reassign",
    target_kind: "property",
    target_id: propertyId,
    before: { assigned_agent_id: before?.assigned_agent_id ?? null },
    after: { assigned_agent_id: agentId },
  });

  await revalidatePropertyPaths(propertyId);
  revalidatePath("/agents");
  return {
    status: "ok",
    message: agentId ? "Advisor assigned." : "Advisor cleared.",
  };
}

export type LocationResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/**
 * Set (or clear) the map coordinates for a property. Standalone from the main
 * edit form — `geo` isn't in `propertyEditSchema`, so this persists on its own
 * (like the hero picker / agent card) and won't clobber a form save. The pin
 * drives the "Location" map on the public `/p/[slug]` page.
 */
export async function setPropertyLocation(
  propertyId: string,
  coords: { lat: number; lng: number } | null,
): Promise<LocationResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PROPERTY_ROLES);

  let geo: { lat: number; lng: number } | null = null;
  if (coords !== null) {
    const { lat, lng } = coords;
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return { status: "error", message: "Coordinates are out of range." };
    }
    // ~0.11 m precision is plenty; keeps the stored JSON tidy.
    geo = {
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("properties")
    .select("geo")
    .eq("id", propertyId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("properties")
    .update({ geo })
    .eq("id", propertyId)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Property not found, or your account is not allowed to edit it.",
    };

  await logAudit({
    action: "property.location_update",
    target_kind: "property",
    target_id: propertyId,
    before: { geo: (before?.geo as Record<string, unknown>) ?? null },
    after: { geo },
  });

  await revalidatePropertyPaths(propertyId);
  return {
    status: "ok",
    message: geo ? "Location saved." : "Location cleared.",
  };
}

export type UploadedPhoto = {
  id: string;
  storage_key: string;
  filename: string;
  mime_type: string;
  became_hero: boolean;
};
export type UploadPhotoResult =
  | { status: "ok"; photo: UploadedPhoto }
  | { status: "error"; message: string };

/**
 * Attach one already-uploaded library asset to this property as a photo.
 *
 * The bytes get to Storage through the shared `uploadToLibrary` helper, which
 * uploads browser → Storage on a signed URL and returns the `media_assets` id;
 * this action does the property half. The editor used to take the file itself,
 * but a server action's payload is a Vercel Function request body and Vercel
 * refuses those over 4.5 MB — listing photos straight off a camera failed with
 * a platform 413 the app never saw. See app/(admin)/admin/media/
 * _upload-actions.ts.
 *
 * The hero picker calls this per file, then promotes the first upload to hero
 * via `setPropertyHero` when the listing has none yet.
 */
export async function attachPropertyPhoto(
  propertyId: string,
  mediaId: string,
): Promise<UploadPhotoResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PROPERTY_ROLES);

  const supabase = await createSupabaseServerClient();

  const asset = await supabase
    .from("media_assets")
    .select("id, storage_key, filename, mime_type")
    .eq("id", mediaId)
    .is("deleted_at", null)
    .maybeSingle();

  if (asset.error || !asset.data)
    return {
      status: "error",
      message: asset.error?.message ?? "That file isn't in the media library.",
    };

  // Listing photos are images. PDFs belong to the library, not the gallery.
  if (!asset.data.mime_type.startsWith("image/"))
    return {
      status: "error",
      message: `"${asset.data.filename}" isn't an image, so it can't be a listing photo.`,
    };

  // Attach to the property. The primary key is (property_id, media_id), so a
  // photo has exactly one role. When the listing has no hero yet, the first
  // upload becomes it; the rest join the gallery in order. (Sequential upload
  // on the client keeps this race-free.)
  const { data: heroRow } = await supabase
    .from("property_media")
    .select("media_id")
    .eq("property_id", propertyId)
    .eq("role", "hero")
    .maybeSingle();
  const becameHero = !heroRow;

  let sortOrder = 0;
  if (!becameHero) {
    const { data: last } = await supabase
      .from("property_media")
      .select("sort_order")
      .eq("property_id", propertyId)
      .order("sort_order", { ascending: false })
      .limit(1);
    sortOrder = (last?.[0]?.sort_order ?? -1) + 1;
  }

  const link = await supabase.from("property_media").insert({
    property_id: propertyId,
    media_id: asset.data.id,
    role: becameHero ? "hero" : "gallery",
    sort_order: sortOrder,
  });
  if (link.error) {
    return {
      status: "error",
      message: `Saved to the library, but couldn't attach to the property: ${link.error.message}`,
    };
  }

  await logAudit({
    action: "property.media_upload",
    target_kind: "property",
    target_id: propertyId,
    before: null,
    after: {
      media_id: asset.data.id,
      filename: asset.data.filename,
      role: becameHero ? "hero" : "gallery",
    },
  });
  revalidatePath("/admin/media");
  await revalidatePropertyPaths(propertyId);

  return {
    status: "ok",
    photo: {
      id: asset.data.id,
      storage_key: asset.data.storage_key,
      filename: asset.data.filename,
      mime_type: asset.data.mime_type,
      became_hero: becameHero,
    },
  };
}

export type HeroResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string };

/**
 * Promote one photo to hero (or, with `mediaId: null`, leave the listing
 * without one).
 *
 * `property_media` is keyed on (property_id, media_id), so a photo has exactly
 * one role — swapping the hero is a role change, not a re-link. Doing it as
 * delete-hero + insert-hero detached the outgoing photo from the listing and
 * blew up with `property_media_pkey` the moment the incoming photo was already
 * attached, which is every photo the media library can offer.
 */
export async function setPropertyHero(
  propertyId: string,
  mediaId: string | null,
): Promise<HeroResult> {
  if (!isSupabaseConfigured)
    return {
      status: "error",
      message: "Supabase env vars are not set.",
    };
  await requireRole(PROPERTY_ROLES);

  const supabase = await createSupabaseServerClient();

  // Demote the outgoing hero to the gallery — it keeps its link and its place
  // in the order. Skipping the incoming photo keeps re-setting the current
  // hero a no-op instead of a momentary heroless state.
  const demote = supabase
    .from("property_media")
    .update({ role: "gallery" })
    .eq("property_id", propertyId)
    .eq("role", "hero");
  const demoteResult = await (mediaId !== null
    ? demote.neq("media_id", mediaId)
    : demote);
  if (demoteResult.error) {
    return { status: "error", message: demoteResult.error.message };
  }

  if (mediaId !== null) {
    const promoted = await supabase
      .from("property_media")
      .update({ role: "hero" })
      .eq("property_id", propertyId)
      .eq("media_id", mediaId)
      .select("media_id");
    if (promoted.error) {
      return { status: "error", message: promoted.error.message };
    }

    // Not attached yet (picked straight from the shared library) — link it.
    if ((promoted.data?.length ?? 0) === 0) {
      const insResult = await supabase.from("property_media").insert({
        property_id: propertyId,
        media_id: mediaId,
        role: "hero",
        sort_order: 0,
      });
      if (insResult.error) {
        return { status: "error", message: insResult.error.message };
      }
    }
  }

  await revalidatePropertyPaths(propertyId);
  await logAudit({
    action: mediaId ? "property.hero_set" : "property.hero_removed",
    target_kind: "property",
    target_id: propertyId,
    before: null,
    after: { media_id: mediaId },
  });
  return { status: "ok", message: mediaId ? "Hero set." : "Hero removed." };
}

/**
 * Detach one photo from this property. Deletes only the property_media link —
 * the underlying media_assets row stays in the shared library. If the removed
 * photo was the hero, the listing simply has no hero afterwards (the pre-flight
 * gate will flag it).
 */
export async function detachPropertyPhoto(
  propertyId: string,
  mediaId: string,
): Promise<HeroResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PROPERTY_ROLES);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("property_media")
    .delete()
    .eq("property_id", propertyId)
    .eq("media_id", mediaId);
  if (error) return { status: "error", message: error.message };

  await logAudit({
    action: "property.media_detach",
    target_kind: "property",
    target_id: propertyId,
    before: { media_id: mediaId },
    after: null,
  });
  await revalidatePropertyPaths(propertyId);
  return { status: "ok", message: "Photo removed." };
}

/**
 * Persist a new photo order. `orderedMediaIds` is the full list of this
 * property's attached media in display order; each row's sort_order is set to
 * its index. The hero keeps its role; ordering is independent of role.
 */
export async function reorderPropertyMedia(
  propertyId: string,
  orderedMediaIds: string[],
): Promise<HeroResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PROPERTY_ROLES);

  if (!Array.isArray(orderedMediaIds) || orderedMediaIds.some((id) => !UUID_RE.test(id)))
    return { status: "error", message: "Invalid media order." };

  const supabase = await createSupabaseServerClient();
  for (let i = 0; i < orderedMediaIds.length; i++) {
    const { error } = await supabase
      .from("property_media")
      .update({ sort_order: i })
      .eq("property_id", propertyId)
      .eq("media_id", orderedMediaIds[i]);
    if (error) return { status: "error", message: error.message };
  }

  await revalidatePropertyPaths(propertyId);
  return { status: "ok", message: "Order saved." };
}

/**
 * Update the alt text on a media asset. Alt lives on media_assets (shared), so
 * this edits the asset itself, not the property_media link.
 */
export async function setPropertyMediaAlt(
  mediaId: string,
  alt: string,
): Promise<HeroResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PROPERTY_ROLES);

  if (!UUID_RE.test(mediaId))
    return { status: "error", message: "Invalid media id." };

  const trimmed = alt.trim().slice(0, 300);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("media_assets")
    .update({ alt_text: trimmed === "" ? null : trimmed })
    .eq("id", mediaId);
  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/media");
  return { status: "ok", message: "Alt text saved." };
}

export type SetDeveloperResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/**
 * Persist the developer the moment it is picked in the Overview tab, instead
 * of waiting for a full form save. "Developer is set" is a publish gate read
 * from the saved row, so a pick that only lived in form state left the
 * pre-flight check stuck on unticked until the whole form was saved — the
 * single biggest source of "I selected it, why is it still failing?".
 *
 * Standalone like `assignAgent`/`setPropertyLocation`: it touches one column,
 * so it can't clobber unsaved edits elsewhere in the form (and the form's own
 * save writes the same value again, harmlessly).
 */
export async function setPropertyDeveloper(
  propertyId: string,
  developerId: string,
): Promise<SetDeveloperResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PROPERTY_ROLES);

  if (!UUID_RE.test(developerId))
    return { status: "error", message: "Pick a developer." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .update({ developer_id: developerId })
    .eq("id", propertyId)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Property not found, or your account is not allowed to edit it.",
    };

  await revalidatePropertyPaths(propertyId);
  return { status: "ok", message: "Developer saved." };
}

export type PublishResult =
  | { status: "ok"; message: string }
  | {
      status: "blocked";
      message: string;
      blockers: string[];
    }
  | { status: "error"; message: string };

async function loadPublishabilityFor(propertyId: string): Promise<{
  data:
    | (PublishabilityResult & {
        property: {
          id: string;
          slug: string;
          reference: string;
          status: string;
        };
      })
    | null;
  error: string | null;
}> {
  const supabase = await createSupabaseServerClient();
  const { data: p, error } = await supabase
    .from("properties")
    .select(
      "id, slug, reference, status, title, price_aed, developer_id, mode, property_form, listing_permit_no, listing_permit_expires_at",
    )
    .eq("id", propertyId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!p) return { data: null, error: "Property not found." };

  const result = evaluatePublishability({
    status: p.status,
    has_developer: p.developer_id != null,
    mode: p.mode,
    property_form: p.property_form,
    listing_permit_no: p.listing_permit_no,
    listing_permit_expires_at: p.listing_permit_expires_at,
    slug: p.slug,
    title: p.title,
    price_aed: p.price_aed != null ? Number(p.price_aed) : null,
  });

  return {
    data: {
      ...result,
      property: {
        id: p.id,
        slug: p.slug,
        reference: p.reference,
        status: p.status,
      },
    },
    error: null,
  };
}

export async function publishProperty(
  propertyId: string,
): Promise<PublishResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PROPERTY_ROLES);

  const pre = await loadPublishabilityFor(propertyId);
  if (pre.error || !pre.data)
    return { status: "error", message: pre.error ?? "Property not found." };

  if (!pre.data.ok) {
    return {
      status: "blocked",
      message: "Resolve the pre-flight checks before publishing.",
      blockers: pre.data.blockers,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("properties")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", propertyId)
    .select("status, slug, reference")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Property not found, or your account is not allowed to publish it.",
    };

  await logAudit({
    action: "property.publish",
    target_kind: "property",
    target_id: propertyId,
    before: { status: pre.data.property.status },
    after: { status: "published" },
  });

  await revalidatePropertyPaths(propertyId);
  return { status: "ok", message: "Published." };
}

export async function unpublishProperty(
  propertyId: string,
): Promise<PublishResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PROPERTY_ROLES);

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("properties")
    .select("status")
    .eq("id", propertyId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("properties")
    .update({ status: "off_market" })
    .eq("id", propertyId)
    .select("status")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Property not found, or your account is not allowed to edit it.",
    };

  await logAudit({
    action: "property.unpublish",
    target_kind: "property",
    target_id: propertyId,
    before: { status: before?.status ?? null },
    after: { status: "off_market" },
  });

  await revalidatePropertyPaths(propertyId);
  return { status: "ok", message: "Moved off-market." };
}
