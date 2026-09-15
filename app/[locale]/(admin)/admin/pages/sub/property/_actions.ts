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
import { propertyPageCopyDef } from "@/lib/master-pages/property-page";
import { propertyPageCopySlug } from "@/lib/queries/property-page";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type PropertyPageCopyResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

async function persist(
  sections: StoredSection[],
  action: string,
): Promise<PropertyPageCopyResult> {
  const supabase = await createSupabaseServerClient();
  const slug = propertyPageCopySlug();

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const payload = {
    slug,
    title: "Property pages (shared copy)",
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
    after: { property_page_copy: true },
  });

  /*
   * One document, every listing. `"page"` on the dynamic segment invalidates
   * all of them — naming a single listing would leave the rest serving the
   * previous wording until their own 60-second window rolled over, which reads
   * as "the save did nothing" on whichever listing the editor checks next.
   */
  revalidateLocalised("/p/[slug]", "page");
  revalidatePath("/admin/pages/sub/property");
  revalidatePath("/admin/pages");
  return { status: "ok", message: "Saved." };
}

export async function savePropertyPageCopy(
  _key: string,
  sections: StoredSection[],
): Promise<PropertyPageCopyResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const result = validateSections(propertyPageCopyDef(), sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map(
        (i) => `${i.section} · ${i.field}: ${i.message}`,
      ),
    };
  }
  return persist(result.sections, "page.property_copy_update");
}

/** Drop every override — the listings go back to the copy shipped in code. */
export async function resetPropertyPageCopy(
  _key: string,
): Promise<PropertyPageCopyResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  return persist(
    defaultDocument(propertyPageCopyDef()),
    "page.property_copy_reset",
  );
}
