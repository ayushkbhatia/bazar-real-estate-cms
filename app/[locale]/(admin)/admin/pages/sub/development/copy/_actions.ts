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
import { developmentPageCopyDef } from "@/lib/master-pages/development-page";
import { developmentPageCopySlug } from "@/lib/queries/development-page";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type DevelopmentPageCopyResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

async function persist(
  sections: StoredSection[],
  action: string,
): Promise<DevelopmentPageCopyResult> {
  const supabase = await createSupabaseServerClient();
  const slug = developmentPageCopySlug();

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const payload = {
    slug,
    title: "Project pages (shared copy)",
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
    after: { development_page_copy: true },
  });

  /*
   * One document, every project page. `"page"` on the dynamic segment
   * invalidates all of them rather than only the collection above them —
   * naming `/developments` alone would leave every project serving the previous
   * wording until its own 60-second window rolled over, which reads as "the
   * save did nothing". `/off-plan/[slug]` re-exports the same page from the
   * same record, so it is invalidated on the same terms.
   */
  revalidateLocalised("/developments");
  revalidateLocalised("/developments/[slug]", "page");
  revalidateLocalised("/off-plan/[slug]", "page");
  revalidatePath("/admin/pages/sub/development/copy");
  revalidatePath("/admin/pages/sub/development");
  return { status: "ok", message: "Saved." };
}

export async function saveDevelopmentPageCopy(
  _key: string,
  sections: StoredSection[],
): Promise<DevelopmentPageCopyResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const result = validateSections(developmentPageCopyDef(), sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map(
        (i) => `${i.section} · ${i.field}: ${i.message}`,
      ),
    };
  }
  return persist(result.sections, "page.development_copy_update");
}

/** Drop every override — the project pages go back to the copy shipped in code. */
export async function resetDevelopmentPageCopy(
  _key: string,
): Promise<DevelopmentPageCopyResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  return persist(
    defaultDocument(developmentPageCopyDef()),
    "page.development_copy_reset",
  );
}
