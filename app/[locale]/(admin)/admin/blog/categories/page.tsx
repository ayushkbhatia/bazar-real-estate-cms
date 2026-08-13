import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { CategoriesEditor, type CategoryRow } from "./_editor";

export const dynamic = "force-dynamic";

const BLOG_ROLES = ["admin", "editor", "marketing"] as const;

/**
 * Blog categories, with the one number that makes the screen usable: how many
 * articles are filed under each.
 *
 * Without it an editor cannot tell which of "Market report" and "Market
 * Reports" is the real one — and both exist, because the only way to create a
 * category until now was an inline "New type" box in the article editor with
 * no view of what already existed. Near-duplicates were the predictable
 * result, and merging them is the first thing anyone will want to do here.
 */
async function loadCategories(): Promise<CategoryRow[]> {
  if (!isSupabaseConfigured) return [];
  const { supabase } = await requireRole(BLOG_ROLES);

  const [{ data: cats }, { data: articles }] = await Promise.all([
    supabase
      .from("article_categories")
      .select("slug, label, label_ar, description, description_ar, sort_order, is_active")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
    // Counted in one pass rather than a head-count per category: thirteen
    // round-trips to render one page is the kind of thing that only shows up
    // once the catalogue grows.
    //
    // Trashed articles are fetched too, and shown separately. Retiring is
    // blocked on LIVE articles only — seven of the thirteen categories here
    // have none, which is precisely the backlog this screen exists to clear —
    // but a category whose only articles are in the trash is not quite free to
    // retire either: restore one later and its category page is a 404 on a URL
    // that used to work. Showing the number lets the editor decide; blocking
    // on it would make the screen useless for its main job.
    supabase.from("articles").select("category, deleted_at"),
  ]);

  const uses = new Map<string, number>();
  const trashed = new Map<string, number>();
  for (const a of articles ?? []) {
    const row = a as { category: string | null; deleted_at: string | null };
    if (!row.category) continue;
    const bucket = row.deleted_at ? trashed : uses;
    bucket.set(row.category, (bucket.get(row.category) ?? 0) + 1);
  }

  return (cats ?? []).map((c) => ({
    slug: c.slug,
    label: c.label,
    label_ar: c.label_ar ?? null,
    description: c.description ?? null,
    description_ar: c.description_ar ?? null,
    sort_order: c.sort_order,
    is_active: c.is_active,
    uses: uses.get(c.slug) ?? 0,
    trashed: trashed.get(c.slug) ?? 0,
  }));
}

export default async function BlogCategoriesPage() {
  const rows = await loadCategories();

  return (
    <CmsShell title="Blog categories" breadcrumbs="Content · Blog · Categories">
      <div className="flex flex-col gap-5">
        <Link
          href="/admin/blog"
          className="inline-flex items-center gap-1 text-[12.5px] text-bz-muted hover:text-bz-ink self-start"
        >
          <ChevronLeft size={13} strokeWidth={1.8} />
          Back to articles
        </Link>

        <p className="text-[12.5px] text-bz-muted max-w-prose">
          The name and description here show on{" "}
          <span className="mono text-[11.5px]">/insights/category/…</span> and
          on every article card. The URL cannot be changed — articles are filed
          against it, and it is already published. To retire a category, move
          its articles elsewhere first.
        </p>

        {rows.length === 0 ? (
          <p className="text-[13px] text-bz-muted">
            No categories yet. They are created from the article editor’s type
            picker.
          </p>
        ) : (
          <CategoriesEditor rows={rows} />
        )}
      </div>
    </CmsShell>
  );
}
