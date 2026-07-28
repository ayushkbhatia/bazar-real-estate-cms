import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { parseBlocks, type Block, type PageStatus } from "@/lib/schemas/page";
import { MASTER_SLUG_PREFIX } from "@/lib/master-pages";

export type PageListRow = {
  id: string;
  slug: string;
  title: string;
  status: PageStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PageDetail = PageListRow & {
  blocks: Block[];
  seo: Record<string, unknown> | null;
};

const LIST_FIELDS =
  "id, slug, title, status, published_at, created_at, updated_at";

const DETAIL_FIELDS =
  "id, slug, title, status, published_at, created_at, updated_at, blocks, seo";

/** Public — published pages only. */
export async function getPublishedPageBySlug(
  slug: string,
): Promise<PageDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("pages")
    .select(DETAIL_FIELDS)
    .eq("slug", slug)
    .eq("status", "published")
    // Master-page rows live in this table too (see lib/master-pages) but they
    // hold section documents, not blocks — they are not routable content.
    .not("slug", "like", `${MASTER_SLUG_PREFIX}%`)
    .maybeSingle();
  if (error) {
    console.error("[getPublishedPageBySlug]", error);
    return null;
  }
  if (!data) return null;
  return {
    ...data,
    blocks: parseBlocks(data.blocks),
    seo: (data.seo as Record<string, unknown> | null) ?? null,
  };
}

/** All slugs that should appear in the public sitemap. */
export async function listPublishedPageSlugs(): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("pages")
    .select("slug")
    .eq("status", "published")
    .not("slug", "like", `${MASTER_SLUG_PREFIX}%`);
  return (data ?? []).map((r) => r.slug);
}

/** Admin: list every page (any status). */
export async function listAllPagesForAdmin(opts: {
  limit?: number;
  offset?: number;
}): Promise<{ rows: PageListRow[]; total: number }> {
  if (!isSupabaseConfigured) return { rows: [], total: 0 };
  const supabase = await createSupabaseServerClient();
  const { data, error, count } = await supabase
    .from("pages")
    .select(LIST_FIELDS, { count: "exact" })
    .not("slug", "like", `${MASTER_SLUG_PREFIX}%`)
    .order("updated_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1);
  if (error) {
    console.error("[listAllPagesForAdmin]", error);
    return { rows: [], total: 0 };
  }
  return {
    rows: (data ?? []) as unknown as PageListRow[],
    total: count ?? 0,
  };
}

/** Admin: full detail for the editor screen. */
export async function getPageForAdmin(id: string): Promise<PageDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("pages")
    .select(DETAIL_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    ...data,
    blocks: parseBlocks(data.blocks),
    seo: (data.seo as Record<string, unknown> | null) ?? null,
  };
}

export function pageUrl(page: { slug: string }): string {
  return `/pages/${page.slug}`;
}
