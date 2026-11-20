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
import {
  getPageFaq,
  pageFaqPageDef,
  type PageFaqDef,
} from "@/lib/master-pages/page-faqs";
import { subPageSlug } from "@/lib/master-pages/subpages";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type PageFaqResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

async function persist(
  entry: PageFaqDef,
  sections: StoredSection[],
  action: string,
): Promise<PageFaqResult> {
  const supabase = await createSupabaseServerClient();
  const slug = subPageSlug("faq", entry.key);

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const payload = {
    slug,
    title: `${entry.label} (FAQ)`,
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
    after: { page_faq: entry.key },
  });

  // The document has no route of its own: name the page that reads it.
  revalidateLocalised(entry.publicPath);
  revalidatePath(`/admin/pages/sub/faq/${entry.key}`);
  revalidatePath("/admin/pages/sub/faq");
  return { status: "ok", message: "Saved." };
}

export async function savePageFaq(
  key: string,
  sections: StoredSection[],
): Promise<PageFaqResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const entry = getPageFaq(key);
  if (!entry) return { status: "error", message: "Unknown page." };

  const result = validateSections(pageFaqPageDef(entry), sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map(
        (i) => `${i.section} · ${i.field}: ${i.message}`,
      ),
    };
  }
  return persist(entry, result.sections, "page.faq_update");
}

/** Clear the questions: the page goes back to showing no FAQ. */
export async function resetPageFaq(key: string): Promise<PageFaqResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const entry = getPageFaq(key);
  if (!entry) return { status: "error", message: "Unknown page." };

  return persist(entry, defaultDocument(pageFaqPageDef(entry)), "page.faq_reset");
}
