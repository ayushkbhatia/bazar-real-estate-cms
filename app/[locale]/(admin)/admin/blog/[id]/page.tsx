import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { articleUrl } from "@/lib/queries/articles";
import { listArticleCategories } from "@/lib/queries/article-categories";
import { mediaPublicUrl } from "@/lib/media";
import type { BlogMediaOption } from "../_image-insert-dialog";
import { type ArticleEditInput } from "@/lib/schemas/article";
import { ArticleEditForm } from "./_form";
import { ArticlePublishCard } from "./_publish-card";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function fetchArticle(id: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("articles")
    .select(
      "id, title, title_ar, slug, excerpt, excerpt_ar, category, status, body_html, body_html_ar, hero_image_id, seo, published_at, updated_at, staff:author_id(display_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/**
 * Images offered by the cover picker and the body's insert dialog. The
 * library's live image assets, newest first. PDFs are excluded: neither an
 * article cover nor an in-body figure is ever a document.
 *
 * `storage_key` rides along because the body persists it rather than the URL —
 * see lib/tiptap/figure-image.ts.
 */
async function fetchMedia(): Promise<BlogMediaOption[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("media_assets")
    .select("id, filename, storage_key, mime_type")
    .is("deleted_at", null)
    .like("mime_type", "image/%")
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []).map((m) => ({
    id: m.id,
    filename: m.filename,
    url: mediaPublicUrl(m.storage_key),
    mime: m.mime_type,
    storage_key: m.storage_key,
  }));
}

export default async function ArticleEditPage({ params }: PageProps) {
  const { id } = await params;
  const [article, categories, media] = await Promise.all([
    fetchArticle(id),
    listArticleCategories(),
    fetchMedia(),
  ]);
  if (!article) notFound();

  const seo = (article.seo as Record<string, unknown> | null) ?? {};
  const initial: ArticleEditInput = {
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    category: article.category,
    body_html: article.body_html ?? "",
    hero_image_id: article.hero_image_id,
    meta_title: (seo.meta_title as string | null) ?? null,
    meta_description: (seo.meta_description as string | null) ?? null,
  };

  const author = article.staff as { display_name: string } | null;
  const isPublished = article.status === "published";
  const publicHref = articleUrl(article);

  return (
    <CmsShell
      title={article.title}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/blog" className="hover:text-bz-ink">
            Insights
          </Link>
          <ChevronRight size={11} />
          <span className="mono">{article.slug}</span>
        </span>
      }
      secondary={
        isPublished ? (
          <Link
            href={publicHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
          >
            View on site
            <ExternalLink size={12} />
          </Link>
        ) : null
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <ArticleEditForm
            articleId={article.id}
            initial={initial}
            categories={categories}
            media={media}
          />
        </div>
        <aside className="sticky top-6">
          <ArticlePublishCard
            articleId={article.id}
            status={article.status}
            updatedAt={article.updated_at}
            publishedAt={article.published_at}
            authorName={author?.display_name ?? null}
            publicHref={publicHref}
          />
        </aside>
      </div>
    </CmsShell>
  );
}
