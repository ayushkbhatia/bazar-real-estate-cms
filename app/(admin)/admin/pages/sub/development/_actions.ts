"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { slugify } from "@/lib/slug";
import {
  defaultDocument,
  validateSections,
  type StoredSection,
} from "@/lib/master-pages";
import {
  developmentPageDef,
  subPageSlug,
} from "@/lib/master-pages/subpages";
import { developmentContentSchema } from "@/lib/schemas/development-content";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type SubPageResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

async function loadRecord(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developments")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return { record: null, message: error.message };
  if (!data) return { record: null, message: "Development not found." };
  return { record: data, message: null };
}

async function persist(
  record: { id: string; name: string; slug: string },
  sections: StoredSection[],
  action: string,
): Promise<SubPageResult> {
  const supabase = await createSupabaseServerClient();
  const slug = subPageSlug("development", record.slug);

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const payload = {
    slug,
    title: `${record.name} (project page)`,
    status: "published" as const,
    blocks: sections as unknown as never,
  };

  const write = existing
    ? await supabase
        .from("pages")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .maybeSingle()
    : await supabase.from("pages").insert(payload).select("id").maybeSingle();

  if (write.error) return { status: "error", message: write.error.message };
  if (!write.data)
    return {
      status: "error",
      message: "Not saved — your account may not have permission to edit pages.",
    };

  await logAudit({
    action,
    target_kind: "page",
    target_id: write.data.id,
    before: null,
    after: { development: record.slug, sections: sections.length },
  });

  revalidatePath(`/developments/${record.slug}`);
  revalidatePath(`/admin/pages/sub/development/${record.slug}`);
  revalidatePath("/admin/pages/sub");
  return { status: "ok", message: "Saved." };
}

export async function saveDevelopmentPage(
  slug: string,
  sections: StoredSection[],
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  const result = validateSections(developmentPageDef(record), sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map((i) => `${i.section} · ${i.field}: ${i.message}`),
    };
  }
  return persist(record, result.sections, "page.subpage_update");
}

export async function resetDevelopmentPage(
  slug: string,
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  return persist(
    record,
    defaultDocument(developmentPageDef(record)),
    "page.subpage_reset",
  );
}

/**
 * Cover and site-plan imagery live on the `developments` row, not in the
 * section document — the public page and the developments admin both already
 * read them there, and two places holding the same fact is how they drift.
 * The sub-page editor writes them through this action.
 */
export async function setDevelopmentImages(
  slug: string,
  images: { hero_image_id: string | null; masterplan_id: string | null },
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developments")
    .update({
      hero_image_id: images.hero_image_id,
      masterplan_id: images.masterplan_id,
    })
    .eq("id", record.id)
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Not saved — your account may not be allowed to edit this.",
    };

  await logAudit({
    action: "development.images_update",
    target_kind: "development",
    target_id: record.id,
    before: null,
    after: images,
  });

  revalidatePath(`/developments/${record.slug}`);
  revalidatePath(`/admin/pages/sub/development/${record.slug}`);
  revalidatePath("/admin/pages/sub");
  return { status: "ok", message: "Images saved." };
}

export type CreateDevelopmentPageResult =
  | { status: "ok"; slug: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

/**
 * "Add development page" — creates the record the page is built from. It starts
 * unpublished (`published_at` null) so a half-filled project never appears on
 * the public site; publishing stays in the developments editor.
 */
export async function createDevelopmentPage(input: {
  name: string;
  slug: string;
  developer_id: string;
  area_id: string | null;
  tagline: string | null;
  hero_image_id: string | null;
}): Promise<CreateDevelopmentPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const name = input.name.trim();
  if (name.length < 3)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { name: "Name is too short" },
    };

  const slug = slugify(input.slug.trim() || name);
  if (slug.length < 3)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { slug: "Slug is too short" },
    };

  if (!input.developer_id)
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { developer_id: "Pick a developer" },
    };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developments")
    .insert({
      name,
      slug,
      developer_id: input.developer_id,
      area_id: input.area_id,
      tagline: input.tagline,
      hero_image_id: input.hero_image_id,
      status: "pre_launch" as const,
    })
    .select("id, slug")
    .maybeSingle();

  if (error) {
    if (error.code === "23505")
      return {
        status: "error",
        message: "That slug is already in use — pick another.",
        fieldErrors: { slug: "Already in use" },
      };
    return { status: "error", message: error.message };
  }
  if (!data)
    return {
      status: "error",
      message: "Not created — your account may not be allowed to add projects.",
    };

  await logAudit({
    action: "development.create",
    target_kind: "development",
    target_id: data.id,
    before: null,
    after: { name, slug },
  });

  revalidatePath("/admin/pages/sub");
  revalidatePath("/admin/pages/sub/development");
  return { status: "ok", slug: data.slug };
}

/**
 * Everything on the development row that its page renders but the section
 * document doesn't hold: payment plan, named features, map pin, neighbouring
 * projects, FAQs and the lead advisor.
 *
 * One action rather than six because they save from one card — and because
 * `meta` is a single jsonb column, so writing them separately would mean
 * read-modify-write races between the sub-editors.
 */
export async function saveDevelopmentContent(
  slug: string,
  raw: unknown,
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  const parsed = developmentContentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "field"}: ${i.message}`,
      ),
    };
  }
  const input = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("developments")
    .select("meta")
    .eq("id", record.id)
    .maybeSingle();

  // Merge rather than replace: `meta` also carries flags this card doesn't
  // edit (floorplan_gated, is_signature) and they mustn't be dropped.
  const meta = {
    ...((existing?.meta as Record<string, unknown> | null) ?? {}),
    feature_blocks: input.feature_blocks,
    faq: input.faq,
    coords: input.coords,
    nearby_ids: input.nearby_ids,
  };

  const { data, error } = await supabase
    .from("developments")
    .update({
      payment_plan: input.payment_plan as unknown as never,
      lead_advisor_id: input.lead_advisor_id,
      meta: meta as unknown as never,
    })
    .eq("id", record.id)
    .select("id")
    .maybeSingle();

  if (error) return { status: "error", message: error.message };
  if (!data)
    return {
      status: "error",
      message: "Not saved — your account may not be allowed to edit this.",
    };

  await logAudit({
    action: "development.content_update",
    target_kind: "development",
    target_id: record.id,
    before: null,
    after: {
      payment_plan: input.payment_plan?.name ?? null,
      features: input.feature_blocks.length,
      faqs: input.faq.length,
      nearby: input.nearby_ids.length,
    },
  });

  revalidatePath(`/developments/${record.slug}`);
  revalidatePath(`/admin/pages/sub/development/${record.slug}`);
  return { status: "ok", message: "Saved." };
}
