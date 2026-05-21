import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { getPageForAdmin, pageUrl } from "@/lib/queries/pages";
import { type PageEditInput } from "@/lib/schemas/page";
import { BlockListEditor } from "./_block-list";
import { PageMetaForm } from "./_meta-form";
import { PagePublishCard } from "./_publish-card";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function PageEditPage({ params }: PageProps) {
  const { id } = await params;
  const page = await getPageForAdmin(id);
  if (!page) notFound();

  const seo = page.seo ?? {};
  const initial: PageEditInput = {
    title: page.title,
    slug: page.slug,
    meta_title: (seo.meta_title as string | null) ?? null,
    meta_description: (seo.meta_description as string | null) ?? null,
  };

  const isPublished = page.status === "published";
  const publicHref = pageUrl(page);

  return (
    <CmsShell
      title={page.title}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <span className="mono">/{page.slug}</span>
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
      <div className="grid grid-cols-[1fr_320px] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <PageMetaForm pageId={page.id} initial={initial} />
          <BlockListEditor pageId={page.id} initial={page.blocks} />
        </div>
        <aside className="sticky top-6">
          <PagePublishCard
            pageId={page.id}
            status={page.status}
            updatedAt={page.updated_at}
            publishedAt={page.published_at}
            publicHref={publicHref}
          />
        </aside>
      </div>
    </CmsShell>
  );
}
