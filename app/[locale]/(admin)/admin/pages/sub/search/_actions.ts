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
  getSearchHeader,
  isSearchHeaderKey,
  searchHeaderPageDef,
  type SearchHeaderDef,
} from "@/lib/master-pages/search-headers";
import { subPageSlug } from "@/lib/master-pages/subpages";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type SearchHeaderResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

async function persist(
  entry: SearchHeaderDef,
  sections: StoredSection[],
  action: string,
): Promise<SearchHeaderResult> {
  const supabase = await createSupabaseServerClient();
  const slug = subPageSlug("search", entry.key);

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const payload = {
    slug,
    title: `${entry.label} (search header)`,
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
    after: { search_header: entry.key },
  });

  /*
   * The document has no route of its own, so nothing invalidates unless this
   * names the route that reads it. `revalidatePath` rather than `publicPath`
   * because `/buy/search?form=off_plan` is a path plus a facet, and passing the
   * query along names a cache key that does not exist — a silent no-op that
   * reads as a caching bug for a week.
   */
  revalidateLocalised(entry.revalidatePath);
  revalidatePath(`/admin/pages/sub/search/${entry.key}`);
  revalidatePath("/admin/pages/sub/search");
  return { status: "ok", message: "Saved." };
}

export async function saveSearchHeader(
  key: string,
  sections: StoredSection[],
): Promise<SearchHeaderResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const entry = isSearchHeaderKey(key) ? getSearchHeader(key) : null;
  if (!entry) return { status: "error", message: "Unknown search page." };

  const result = validateSections(searchHeaderPageDef(entry), sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map(
        (i) => `${i.section} · ${i.field}: ${i.message}`,
      ),
    };
  }
  return persist(entry, result.sections, "page.search_header_update");
}

/** Drop every override — the header goes back to the copy shipped in code. */
export async function resetSearchHeader(
  key: string,
): Promise<SearchHeaderResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const entry = isSearchHeaderKey(key) ? getSearchHeader(key) : null;
  if (!entry) return { status: "error", message: "Unknown search page." };

  return persist(
    entry,
    defaultDocument(searchHeaderPageDef(entry)),
    "page.search_header_reset",
  );
}
