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
import { developerPageCopyDef } from "@/lib/master-pages/developer-page";
import { developerPageCopySlug } from "@/lib/queries/developer-page";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type DeveloperPageCopyResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

async function persist(
  sections: StoredSection[],
  action: string,
): Promise<DeveloperPageCopyResult> {
  const supabase = await createSupabaseServerClient();
  const slug = developerPageCopySlug();

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const payload = {
    slug,
    title: "Developer profile pages (shared copy)",
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
    after: { developer_page_copy: true },
  });

  /*
   * One document, 32 pages. `"page"` on the dynamic segment invalidates every
   * profile rather than only the collection above them — naming `/developers`
   * alone would leave all 32 profiles serving the previous wording until their
   * own 300-second window rolled over, which reads as "the save did nothing".
   */
  revalidateLocalised("/developers");
  revalidateLocalised("/developers/[slug]", "page");
  revalidatePath("/admin/pages/sub/developer/copy");
  revalidatePath("/admin/pages/sub/developer");
  return { status: "ok", message: "Saved." };
}

export async function saveDeveloperPageCopy(
  _key: string,
  sections: StoredSection[],
): Promise<DeveloperPageCopyResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const result = validateSections(developerPageCopyDef(), sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map(
        (i) => `${i.section} · ${i.field}: ${i.message}`,
      ),
    };
  }
  return persist(result.sections, "page.developer_copy_update");
}

/** Drop every override — the profiles go back to the copy shipped in code. */
export async function resetDeveloperPageCopy(
  _key: string,
): Promise<DeveloperPageCopyResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  return persist(
    defaultDocument(developerPageCopyDef()),
    "page.developer_copy_reset",
  );
}
