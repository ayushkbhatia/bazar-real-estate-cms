"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  propertyEditSchema,
  normaliseEditInput,
} from "@/lib/schemas/property";
import { propertyUrl } from "@/lib/queries/properties";

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
    return { status: "error", message: error.message };
  }
  if (!data) {
    return {
      status: "error",
      message:
        "Property not found, or your account is not allowed to edit it.",
    };
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
  return { status: "ok", message: mediaId ? "Hero set." : "Hero removed." };
}
