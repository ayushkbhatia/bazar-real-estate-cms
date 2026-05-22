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
