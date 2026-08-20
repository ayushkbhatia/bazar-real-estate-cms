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
  getLibrarySection,
  isLibrarySectionKey,
  librarySectionPageDef,
} from "@/lib/master-pages/library";
import { subPageSlug } from "@/lib/master-pages/subpages";
import { listPublishedLandingSlugs } from "@/lib/queries/landing-pages";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type LibrarySectionResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

/**
 * Everything a library section can appear on.
 *
 * This is the cost of shared content, paid here rather than left to a stale
 * cache: the document has no route of its own, so nothing invalidates unless
 * this names the pages that read it. `/` always; every published landing page,
 * because any of them may hold the Testimonials block and the document does not
 * record which — checking would be a read per page to save a revalidation per
 * page, and revalidation is the cheaper of the two.
 */
async function revalidateReaders(): Promise<void> {
  revalidateLocalised("/");
  const slugs = await listPublishedLandingSlugs(100);
  for (const slug of slugs) revalidateLocalised(`/lp/${slug}`);
}

async function persist(
  key: string,
  sections: StoredSection[],
  action: string,
): Promise<LibrarySectionResult> {
  const entry = isLibrarySectionKey(key) ? getLibrarySection(key) : null;
  if (!entry) return { status: "error", message: "Unknown section." };

  const supabase = await createSupabaseServerClient();
  const slug = subPageSlug("section", entry.key);

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const payload = {
    slug,
    title: `${entry.label} (section)`,
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
    after: { library_section: entry.key, sections: sections.length },
  });

  await revalidateReaders();
  revalidatePath(`/admin/pages/sub/section/${entry.key}`);
  revalidatePath("/admin/pages/sub/section");
  return { status: "ok", message: "Saved." };
}

export async function saveLibrarySection(
  key: string,
  sections: StoredSection[],
): Promise<LibrarySectionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const entry = isLibrarySectionKey(key) ? getLibrarySection(key) : null;
  if (!entry) return { status: "error", message: "Unknown section." };

  const result = validateSections(librarySectionPageDef(entry), sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map(
        (i) => `${i.section} · ${i.field}: ${i.message}`,
      ),
    };
  }
  return persist(entry.key, result.sections, "page.library_section_update");
}

/** Drop every override — the section goes back to the copy shipped in code. */
export async function resetLibrarySection(
  key: string,
): Promise<LibrarySectionResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const entry = isLibrarySectionKey(key) ? getLibrarySection(key) : null;
  if (!entry) return { status: "error", message: "Unknown section." };

  return persist(
    entry.key,
    defaultDocument(librarySectionPageDef(entry)),
    "page.library_section_reset",
  );
}
