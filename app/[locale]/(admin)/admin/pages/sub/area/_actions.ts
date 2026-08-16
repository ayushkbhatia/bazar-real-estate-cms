"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  defaultDocument,
  validateSections,
  type StoredSection,
} from "@/lib/master-pages";
import { areaPageDef, subPageSlug } from "@/lib/master-pages/subpages";
import {
  mergeSearchAppearance,
  searchAppearanceSchema,
  type SearchAppearanceInput,
} from "@/lib/schemas/seo";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type SubPageResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

async function loadRecord(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("areas")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return { record: null, message: error.message };
  if (!data) return { record: null, message: "Area not found." };
  return { record: data, message: null };
}

async function persist(
  record: { id: string; name: string; slug: string },
  sections: StoredSection[],
  action: string,
): Promise<SubPageResult> {
  const supabase = await createSupabaseServerClient();
  const slug = subPageSlug("area", record.slug);

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const payload = {
    slug,
    title: `${record.name} (area guide)`,
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
    after: { area: record.slug, sections: sections.length },
  });

  revalidateLocalised(`/areas/${record.slug}`);
  revalidatePath(`/admin/pages/sub/area/${record.slug}`);
  revalidatePath("/admin/pages/sub/area");
  return { status: "ok", message: "Saved." };
}

export async function saveAreaPage(
  slug: string,
  sections: StoredSection[],
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  const result = validateSections(areaPageDef(record), sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map((i) => `${i.section} · ${i.field}: ${i.message}`),
    };
  }
  return persist(record, result.sections, "page.area_subpage_update");
}

export async function resetAreaPage(
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
    defaultDocument(areaPageDef(record)),
    "page.area_subpage_reset",
  );
}

/**
 * The area guide's cover image lives on the `areas` row — the public page
 * already reads it there, and one fact in two places drifts.
 */
export async function setAreaImages(
  slug: string,
  images: { hero_image_id: string | null },
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Area not found." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("areas")
    .update({ hero_image_id: images.hero_image_id })
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
    action: "area.images_update",
    target_kind: "area",
    target_id: record.id,
    before: null,
    after: images,
  });

  revalidateLocalised(`/areas/${record.slug}`);
  revalidatePath(`/admin/pages/sub/area/${record.slug}`);
  revalidatePath("/admin/pages/sub/area");
  return { status: "ok", message: "Image saved." };
}

/**
 * The search title and description for an area guide.
 *
 * The store is `areas.seo_meta`, not `pages.seo`: /areas/[slug] has read the
 * area record's bag since the guides shipped, and repointing it at the page
 * document would orphan whatever is already written there. So this action
 * writes the column the public page already reads.
 *
 * The same two fields are also editable on the area *record* screen
 * (/admin/areas/[id]) — the record is where an area's facts live, and these
 * happened to be there because that form existed first. Editing them here as
 * well is the point of this change: an editor working on the guide should not
 * have to know that its search appearance lives on a different screen. Both
 * write the same column, so neither is a second copy.
 */
export async function saveAreaSeo(
  slug: string,
  raw: SearchAppearanceInput,
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Area not found." };

  const parsed = searchAppearanceSchema.safeParse(raw);
  if (!parsed.success)
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "field"}: ${i.message}`,
      ),
    };

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("areas")
    .select("seo_meta")
    .eq("id", record.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("areas")
    .update({
      seo_meta: mergeSearchAppearance(
        existing?.seo_meta,
        parsed.data,
      ) as unknown as never,
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
    action: "area.seo_update",
    target_kind: "area",
    target_id: record.id,
    before: null,
    after: parsed.data,
  });

  revalidateLocalised(`/areas/${record.slug}`);
  revalidatePath(`/admin/pages/sub/area/${record.slug}`);
  revalidatePath(`/admin/areas/${record.id}`);
  return { status: "ok", message: "Search appearance saved." };
}
