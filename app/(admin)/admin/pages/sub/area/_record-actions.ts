"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { slugify } from "@/lib/slug";
import {
  areaCreateSchema,
  areaEditSchema,
  normaliseAreaInput,
  parentError,
  type AreaKind,
} from "@/lib/schemas/area";

const AREA_ROLES = ["admin", "editor", "marketing"] as const;

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

  const { data, error } = await supabase
    .from("areas")
    .update({
      name: input.name,
      slug: input.slug,
      kind: input.kind,
      parent_id: input.parent_id ?? null,
      description: input.description ?? null,
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

  revalidatePath("/admin/pages/sub/area");
  revalidatePath(`/admin/areas/${id}`);
  revalidatePath(`/areas/${data.slug}`);
  // A slug change moves the public page; the old path needs clearing too.
  if (before?.slug && before.slug !== data.slug)
    revalidatePath(`/areas/${before.slug}`);
  revalidatePath("/areas");
  return { status: "ok", message: "Saved." };
}

export type CreateAreaResult =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export async function createArea(raw: {
  name: string;
  slug: string;
  kind: string;
  parent_id: string | null;
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
  const { data, error } = await supabase
    .from("areas")
    .insert({
      name: input.name,
      slug: input.slug,
      kind: input.kind,
      parent_id: input.parent_id ?? null,
    })
    .select("id")
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
      message: "Not created — your account may not be allowed to add areas.",
    };

  await logAudit({
    action: "area.create",
    target_kind: "area",
    target_id: data.id,
    before: null,
    after: { name: input.name, slug: input.slug, kind: input.kind },
  });

  revalidatePath("/admin/pages/sub/area");
  revalidatePath("/areas");
  return { status: "ok", id: data.id };
}

/** Used by the create wizard so it can land on the new record's editor. */
export async function goToAreaRecord(id: string): Promise<never> {
  redirect(`/admin/areas/${id}`);
}
