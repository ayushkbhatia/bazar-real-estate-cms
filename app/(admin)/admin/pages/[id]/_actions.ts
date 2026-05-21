"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  blockSchema,
  normalisePageEditInput,
  pageEditSchema,
  type Block,
} from "@/lib/schemas/page";
import { logAudit } from "@/lib/audit";

async function revalidatePagePaths(
  slug: string | null,
  prevSlug?: string | null,
) {
  if (!isSupabaseConfigured) return;
  revalidatePath("/admin/pages");
  if (slug) revalidatePath(`/pages/${slug}`);
  if (prevSlug && prevSlug !== slug) revalidatePath(`/pages/${prevSlug}`);
}

export type SavePageResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

export async function updatePage(
  id: string,
  raw: Record<string, unknown>,
): Promise<SavePageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const normalised = normalisePageEditInput(raw);
  const parsed = pageEditSchema.safeParse(normalised);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Please fix the errors below.", fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("pages")
    .select("title, slug")
    .eq("id", id)
    .maybeSingle();

  const { meta_title, meta_description, ...rest } = parsed.data;

  const { data, error } = await supabase
    .from("pages")
    .update({
      ...rest,
      seo: {
        meta_title: meta_title ?? null,
        meta_description: meta_description ?? null,
      },
    })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) {
    if (error.code === "23505")
      return {
        status: "error",
        message: "Slug already in use — pick a different one.",
        fieldErrors: { slug: "Already in use" },
      };
    return { status: "error", message: error.message };
  }
  if (!data)
    return {
      status: "error",
      message: "Page not found or you can't edit it.",
    };

  if (before && (before.title !== rest.title || before.slug !== rest.slug)) {
    await logAudit({
      action: "page.update",
      target_kind: "page",
      target_id: id,
      before: { title: before.title, slug: before.slug },
      after: { title: rest.title, slug: rest.slug },
    });
  }

  await revalidatePagePaths(data.slug, before?.slug ?? null);
  return { status: "ok", message: "Saved." };
}

export type SaveBlocksResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string };

export async function saveBlocks(
  id: string,
  blocksRaw: unknown,
): Promise<SaveBlocksResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  if (!Array.isArray(blocksRaw))
    return { status: "error", message: "Blocks must be an array." };

  const validated: Block[] = [];
  for (const block of blocksRaw) {
    const parsed = blockSchema.safeParse(block);
    if (!parsed.success) {
      return {
        status: "error",
        message:
          "One or more blocks have invalid fields. " +
          (parsed.error.issues[0]?.message ?? ""),
      };
    }
    validated.push(parsed.data);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pages")
    .update({ blocks: validated })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Page not found." };

  await revalidatePagePaths(data.slug);
  return { status: "ok", message: "Layout saved." };
}

export type PublishResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

export async function publishPage(id: string): Promise<PublishResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const supabase = await createSupabaseServerClient();
  const { data: page } = await supabase
    .from("pages")
    .select("title, slug, status, blocks")
    .eq("id", id)
    .maybeSingle();
  if (!page) return { status: "error", message: "Page not found." };
  if (!page.title.trim())
    return { status: "error", message: "Title is required." };

  const blockArr = Array.isArray(page.blocks) ? page.blocks : [];
  if (blockArr.length === 0)
    return {
      status: "error",
      message: "Add at least one block before publishing.",
    };

  const { data, error } = await supabase
    .from("pages")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Could not publish." };

  await logAudit({
    action: "page.publish",
    target_kind: "page",
    target_id: id,
    before: { status: page.status },
    after: { status: "published" },
  });

  await revalidatePagePaths(data.slug);
  return { status: "ok", message: "Published." };
}

export async function unpublishPage(id: string): Promise<PublishResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };

  const supabase = await createSupabaseServerClient();
  const { data: page } = await supabase
    .from("pages")
    .select("status, slug")
    .eq("id", id)
    .maybeSingle();
  if (!page) return { status: "error", message: "Page not found." };

  const { data, error } = await supabase
    .from("pages")
    .update({ status: "draft" })
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Could not unpublish." };

  await logAudit({
    action: "page.unpublish",
    target_kind: "page",
    target_id: id,
    before: { status: page.status },
    after: { status: "draft" },
  });

  await revalidatePagePaths(data.slug);
  return { status: "ok", message: "Reverted to draft." };
}
