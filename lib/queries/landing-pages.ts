import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  parseLandingDocument,
  type BlockInstance,
} from "@/lib/page-builder";

export type LandingStatus = "draft" | "published";

export type LandingListRow = {
  id: string;
  slug: string;
  title: string;
  status: LandingStatus;
  noindex: boolean;
  published_at: string | null;
  updated_at: string;
  /** Live block count, for the list. */
  block_count: number;
  /** True when `draft_blocks` differs from what is live. */
  has_draft: boolean;
};

export type LandingDetail = {
  id: string;
  slug: string;
  title: string;
  status: LandingStatus;
  noindex: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  seo: Record<string, unknown> | null;
  /** The live document. */
  blocks: BlockInstance[];
  /** The working copy — the live document when there are no pending edits. */
  draft: BlockInstance[];
  hasDraft: boolean;
};

/**
 * The public select.
 *
 * `draft_blocks` must never appear here. Beyond the obvious — it would leak
 * unpublished copy — an over-wide public select is how `getPublicSiteSettings`
 * silently fell back to defaults for a year (docs/FOLLOWUPS.md:803). Asserted
 * in landing-pages.test.ts.
 */
const PUBLIC_FIELDS = "id, slug, title, status, noindex, published_at, blocks, seo";

const ADMIN_LIST_FIELDS =
  "id, slug, title, status, noindex, published_at, updated_at, blocks, draft_blocks";

const ADMIN_DETAIL_FIELDS =
  "id, slug, title, status, noindex, published_at, created_at, updated_at, blocks, draft_blocks, seo";

/** Public: one published page. Anon, cookie-free, so the route keeps ISR. */
export async function getPublishedLandingBySlug(
  slug: string,
): Promise<LandingDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("landing_pages")
    .select(PUBLIC_FIELDS)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error("[getPublishedLandingBySlug]", error);
    return null;
  }
  if (!data) return null;
  const blocks = parseLandingDocument(data.blocks).blocks;
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    status: data.status as LandingStatus,
    noindex: data.noindex,
    published_at: data.published_at,
    created_at: "",
    updated_at: "",
    seo: (data.seo as Record<string, unknown> | null) ?? null,
    blocks,
    draft: blocks,
    hasDraft: false,
  };
}

/**
 * Slugs to prerender at build.
 *
 * Capped, and `dynamicParams` stays at its default `true` so an uncapped
 * campaign backlog still resolves on demand. Not a micro-optimisation: CI runs
 * `npm run build` in three jobs against the production database, so every
 * prerendered landing page executes its full data fan-out three times per push.
 * An uncapped list makes CI slower and more expensive every time marketing
 * ships a campaign, with no commit behind the increase.
 */
export async function listPublishedLandingSlugs(limit = 20): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("landing_pages")
    .select("slug")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => r.slug);
}

/** Every published, indexable page — for the sitemap. */
export async function listLandingPagesForSitemap(): Promise<
  { slug: string; updated_at: string }[]
> {
  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data } = await supabase
    .from("landing_pages")
    .select("slug, updated_at")
    .eq("status", "published")
    .eq("noindex", false)
    .is("deleted_at", null)
    .order("published_at", { ascending: false })
    .limit(500);
  return (data ?? []).map((r) => ({ slug: r.slug, updated_at: r.updated_at }));
}

/** Admin: the drafts + live list. */
export async function listLandingPagesForAdmin(): Promise<LandingListRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("landing_pages")
    .select(ADMIN_LIST_FIELDS)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[listLandingPagesForAdmin]", error);
    return [];
  }
  return (data ?? []).map((r) => {
    const live = parseLandingDocument(r.blocks).blocks;
    const draft = r.draft_blocks === null ? null : parseLandingDocument(r.draft_blocks).blocks;
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      status: r.status as LandingStatus,
      noindex: r.noindex,
      published_at: r.published_at,
      updated_at: r.updated_at,
      block_count: (draft ?? live).length,
      // Only meaningful once the page is live: on a draft-status page the
      // working copy IS the page, so "unpublished changes" would be every row.
      has_draft: r.status === "published" && draft !== null,
    };
  });
}

/** Admin: one page, with both documents. */
export async function getLandingPageForAdmin(
  id: string,
): Promise<LandingDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("landing_pages")
    .select(ADMIN_DETAIL_FIELDS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  const blocks = parseLandingDocument(data.blocks).blocks;
  const hasDraft = data.draft_blocks !== null;
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    status: data.status as LandingStatus,
    noindex: data.noindex,
    published_at: data.published_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
    seo: (data.seo as Record<string, unknown> | null) ?? null,
    blocks,
    draft: hasDraft ? parseLandingDocument(data.draft_blocks).blocks : blocks,
    hasDraft,
  };
}

export function landingUrl(page: { slug: string }): string {
  return `/lp/${page.slug}`;
}

export function landingAdminUrl(page: { id: string }): string {
  return `/admin/page-builder/${page.id}`;
}
