"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  propertyEditSchema,
  propertyComplianceSchema,
  normaliseEditInput,
  normaliseCompliance,
  type PropertyCompliance,
} from "@/lib/schemas/property";
import { propertyUrl } from "@/lib/queries/properties";
import { s8 } from "@/lib/supabase/sprint-8";
import {
  evaluatePublishability,
  type PublishabilityResult,
} from "@/lib/publishability";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  MEDIA_BUCKET,
  storageKey,
} from "@/lib/media";

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
    revalidatePath("/rent");
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

  // s8() widens the .from() type so the Sprint 8 columns
  // (bazar_verified, advisor_note, featured_on_homepage) typecheck
  // until db/types.ts is regenerated against migrations 0015–0026.
  const { data, error } = await s8(supabase)
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
    revalidatePath("/rent");
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
 * Upload one image straight from the property editor: stores the file, records
 * it in `media_assets` (so it appears in the shared media library), and
 * attaches it to this property as a `gallery` image. The hero picker calls
 * this per file, then promotes the first upload to hero via `setPropertyHero`
 * when the listing has none yet.
 */
export async function uploadPropertyPhoto(
  propertyId: string,
  formData: FormData,
): Promise<UploadPhotoResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PROPERTY_ROLES);

  const file = formData.get("file");
  if (!(file instanceof File))
    return { status: "error", message: "No file provided." };
  if (file.size === 0) return { status: "error", message: "File is empty." };
  if (file.size > MAX_UPLOAD_BYTES)
    return {
      status: "error",
      message: `"${file.name}" is too large — max ${Math.floor(
        MAX_UPLOAD_BYTES / 1024 / 1024,
      )} MB.`,
    };
  if (!file.type.startsWith("image/") || !ALLOWED_MIME.has(file.type))
    return {
      status: "error",
      message: `"${file.name}" isn't a supported image (use JPG, PNG, WebP, AVIF, or GIF).`,
    };

  const supabase = await createSupabaseServerClient();
  const key = storageKey({
    folder: "listings",
    filename: file.name,
    uuid: randomUUID(),
  });
  const buffer = Buffer.from(await file.arrayBuffer());

  const upload = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(key, buffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (upload.error)
    return { status: "error", message: `Upload failed: ${upload.error.message}` };

  const asset = await supabase
    .from("media_assets")
    .insert({
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      storage_key: key,
      alt_text: null,
      folder: "listings",
    })
    .select("id, storage_key, filename, mime_type")
    .maybeSingle();

  if (asset.error || !asset.data) {
    // Roll back the orphaned storage object.
    await supabase.storage.from(MEDIA_BUCKET).remove([key]);
    return {
      status: "error",
      message: asset.error?.message ?? "Failed to record the upload.",
    };
  }

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
      filename: file.name,
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

  // Remove the existing hero (if any).
  const delResult = await supabase
    .from("property_media")
    .delete()
    .eq("property_id", propertyId)
    .eq("role", "hero");
  if (delResult.error) {
    return { status: "error", message: delResult.error.message };
  }

  if (mediaId !== null) {
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

export type ComplianceResult =
  | { status: "ok"; message?: string; compliance: PropertyCompliance }
  | { status: "error"; message: string };

export async function updateCompliance(
  propertyId: string,
  raw: Record<string, unknown>,
): Promise<ComplianceResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PROPERTY_ROLES);

  const parsed = propertyComplianceSchema.safeParse(normaliseCompliance(raw));
  if (!parsed.success) {
    return { status: "error", message: "Invalid compliance payload." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("properties")
    .select("compliance")
    .eq("id", propertyId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("properties")
    .update({ compliance: parsed.data })
    .eq("id", propertyId)
    .select("id")
    .maybeSingle();

  if (error)
    return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Not found / not allowed." };

  await logAudit({
    action: "property.compliance_update",
    target_kind: "property",
    target_id: propertyId,
    before: (before?.compliance as Record<string, unknown>) ?? null,
    after: parsed.data,
  });

  await revalidatePropertyPaths(propertyId);
  return { status: "ok", message: "Compliance saved.", compliance: parsed.data };
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
      "id, slug, reference, status, title, price_aed, listing_permit_no, listing_permit_expires_at, compliance, property_media(role)",
    )
    .eq("id", propertyId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!p) return { data: null, error: "Property not found." };

  const has_hero = ((p.property_media as { role: string }[] | null) ?? []).some(
    (m) => m.role === "hero",
  );

  const result = evaluatePublishability({
    status: p.status,
    has_hero,
    listing_permit_no: p.listing_permit_no,
    listing_permit_expires_at: p.listing_permit_expires_at,
    slug: p.slug,
    title: p.title,
    price_aed: p.price_aed != null ? Number(p.price_aed) : null,
    compliance: normaliseCompliance(
      p.compliance as Record<string, unknown> | null,
    ),
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
