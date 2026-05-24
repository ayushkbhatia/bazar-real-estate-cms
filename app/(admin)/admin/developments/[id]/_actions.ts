"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  developmentEditSchema,
  normaliseDevelopmentInput,
} from "@/lib/schemas/development";
import { developmentUrl } from "@/lib/queries/developments";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

const DEVELOPMENT_ROLES = ["admin", "editor"] as const;

export type SaveResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

async function revalidateDevelopmentPaths(developmentId: string) {
  revalidatePath("/admin/developments");
  revalidatePath(`/admin/developments/${developmentId}`);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("developments")
    .select("slug, published_at")
    .eq("id", developmentId)
    .maybeSingle();
  if (data?.published_at) {
    revalidatePath(developmentUrl(data));
    revalidatePath("/developments");
  }
}

export async function updateDevelopment(
  id: string,
  raw: Record<string, unknown>,
): Promise<SaveResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(DEVELOPMENT_ROLES);

  const normalised = normaliseDevelopmentInput(raw);
  const parsed = developmentEditSchema.safeParse(normalised);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("developments")
    .select("slug, name, status, starting_price, published_at")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("developments")
    .update(parsed.data)
    .eq("id", id)
    .select("slug, published_at")
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
      message: "Development not found, or your account is not allowed to edit it.",
    };
  }

  if (before) {
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (before.slug !== parsed.data.slug)
      changes.slug = { before: before.slug, after: parsed.data.slug };
    if (before.name !== parsed.data.name)
      changes.name = { before: before.name, after: parsed.data.name };
    if (before.status !== parsed.data.status)
      changes.status = { before: before.status, after: parsed.data.status };
    if (Object.keys(changes).length > 0) {
      await logAudit({
        action: "development.update",
        target_kind: "development",
        target_id: id,
        before: changes,
        after: null,
      });
    }
  }

  await revalidateDevelopmentPaths(id);
  return { status: "ok", message: "Saved." };
}

export async function publishDevelopment(
  id: string,
): Promise<SaveResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(DEVELOPMENT_ROLES);

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("developments")
    .select("published_at, status")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("developments")
    .update({ published_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, slug")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data)
    return { status: "error", message: "Development not found." };

  await logAudit({
    action: "development.publish",
    target_kind: "development",
    target_id: id,
    before: { published_at: before?.published_at ?? null },
    after: { published_at: new Date().toISOString() },
  });

  await revalidateDevelopmentPaths(id);
  return { status: "ok", message: "Published." };
}

export async function unpublishDevelopment(
  id: string,
): Promise<SaveResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(DEVELOPMENT_ROLES);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developments")
    .update({ published_at: null })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Development not found." };

  await logAudit({
    action: "development.unpublish",
    target_kind: "development",
    target_id: id,
    before: null,
    after: { published_at: null },
  });

  await revalidateDevelopmentPaths(id);
  return { status: "ok", message: "Unpublished." };
}
