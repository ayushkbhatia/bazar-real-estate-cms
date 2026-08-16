"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  defaultDocument,
  getMasterPage,
  masterSlug,
  validateSections,
  type MasterPageKey,
  type StoredSection,
} from "@/lib/master-pages";
import {
  mergeSearchAppearance,
  searchAppearanceSchema,
  type SearchAppearanceInput,
} from "@/lib/schemas/seo";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type SaveMasterPageResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

async function persist(
  key: MasterPageKey,
  sections: StoredSection[],
  action: string,
): Promise<SaveMasterPageResult> {
  const def = getMasterPage(key);
  if (!def) return { status: "error", message: "Unknown page." };

  const supabase = await createSupabaseServerClient();
  const slug = masterSlug(key);

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  // `blocks` is jsonb, so the section documents ride in the existing column —
  // no migration, which matters because DDL can't currently be applied.
  const payload = {
    slug,
    title: `${def.label} (master page)`,
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
    after: { master_page: key, sections: sections.length },
  });

  revalidateLocalised(def.path);
  revalidatePath(`/admin/pages/master/${key}`);
  revalidatePath("/admin/pages");
  return { status: "ok", message: "Saved." };
}

export async function saveMasterPage(
  key: MasterPageKey,
  sections: StoredSection[],
): Promise<SaveMasterPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const def = getMasterPage(key);
  if (!def) return { status: "error", message: "Unknown page." };

  const result = validateSections(def, sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map(
        (i) => `${i.section} · ${i.field}: ${i.message}`,
      ),
    };
  }

  return persist(key, result.sections, "page.master_update");
}

/** Drop every override — the page goes back to the copy shipped in code. */
export async function resetMasterPage(
  key: MasterPageKey,
): Promise<SaveMasterPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const def = getMasterPage(key);
  if (!def) return { status: "error", message: "Unknown page." };

  return persist(key, defaultDocument(def), "page.master_reset");
}

/**
 * The search title and description for a master page.
 *
 * A separate action from `saveMasterPage` on purpose. The section editor
 * serialises the whole document on every save, and folding two more strings
 * into that payload would mean the SEO card could not be saved without also
 * re-writing every section — so a stray section edit and an SEO edit would
 * clobber each other. Writing only `seo` also means `persist` above can keep
 * omitting the column: a PostgREST `update` touches named columns only, so the
 * two writers never overwrite one another's work.
 */
export async function saveMasterPageSeo(
  key: MasterPageKey,
  raw: SearchAppearanceInput,
): Promise<SaveMasterPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const def = getMasterPage(key);
  if (!def) return { status: "error", message: "Unknown page." };

  const parsed = searchAppearanceSchema.safeParse(raw);
  if (!parsed.success)
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`,
      ),
    };

  const supabase = await createSupabaseServerClient();
  const slug = masterSlug(key);

  // Read the stored bag first so unrelated keys survive. `seo` is untyped
  // jsonb shared with whatever else has written to it.
  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id, seo")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const seo = mergeSearchAppearance(existing?.seo, parsed.data);

  // The row may not exist yet: a master page that nobody has edited has no
  // row at all, and editing only its SEO is a legitimate first edit.
  const write = existing
    ? await supabase
        .from("pages")
        .update({ seo: seo as unknown as never })
        .eq("id", existing.id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("pages")
        .insert({
          slug,
          title: `${def.label} (master page)`,
          status: "published" as const,
          blocks: defaultDocument(def) as unknown as never,
          seo: seo as unknown as never,
        })
        .select("id")
        .maybeSingle();

  if (write.error) return { status: "error", message: write.error.message };
  if (!write.data)
    return {
      status: "error",
      message: "Not saved — your account may not have permission to edit pages.",
    };

  await logAudit({
    action: "page.master_seo_update",
    target_kind: "page",
    target_id: write.data.id,
    before: null,
    after: { master_page: key, ...parsed.data },
  });

  revalidateLocalised(def.path);
  revalidatePath(`/admin/pages/master/${key}`);
  return { status: "ok", message: "Search appearance saved." };
}
