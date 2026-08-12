import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Pencil } from "lucide-react";
import { getLandingPageForAdmin } from "@/lib/queries/landing-pages";
import { attachImageUrls } from "@/lib/queries/section-images";
import { resolveDocument, unknownBlockCount } from "@/lib/page-builder";
import { loadLandingData } from "@/lib/page-builder/data";
import { LandingRenderer } from "@/app/[locale]/(public)/lp/[slug]/_render";

/**
 * Draft preview.
 *
 * Lives inside the `(admin)` group rather than behind a public token URL: the
 * group is already gated by the proxy and by `requireRole`, whereas a token
 * route would be a new secret to leak and a new public surface to cache
 * wrongly. It renders the *same* `LandingRenderer` the public route does — one
 * component, two callers, so what you preview is what publishes.
 *
 * `force-dynamic` because it reads unpublished content through the cookie-aware
 * client. That is correct here and forbidden on `/lp/[slug]`, which must stay
 * ISR.
 */
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function LandingPreviewPage({ params }: PageProps) {
  const { id } = await params;
  const page = await getLandingPageForAdmin(id);
  if (!page) notFound();

  const blocks = resolveDocument(page.draft);
  await attachImageUrls(blocks);
  const data = await loadLandingData(blocks);
  const unknown = unknownBlockCount(blocks);

  return (
    <div className="min-h-dvh-safe bg-bz-bg">
      <div className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-bz-border bg-bz-surface px-4 py-2.5 md:px-6">
        <span className="inline-flex items-center h-[22px] px-2 rounded-full bg-[oklch(0.95_0.05_85)] text-[oklch(0.38_0.09_75)] text-[11px] font-medium">
          Preview
        </span>
        <span className="text-[12.5px] text-bz-muted me-auto truncate">
          {page.title}
          {page.hasDraft ? " · unpublished changes" : ""}
          {unknown > 0
            ? ` · ${unknown} section${unknown === 1 ? "" : "s"} unavailable in this build`
            : ""}
        </span>
        <Link
          href={`/admin/page-builder/${page.id}`}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-ink-2 hover:text-bz-ink"
        >
          <Pencil size={13} strokeWidth={1.7} /> Back to the editor
        </Link>
        <Link
          href="/admin/page-builder"
          className="inline-flex items-center gap-1 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          All pages <ChevronRight size={13} />
        </Link>
      </div>

      {blocks.filter((b) => b.enabled && b.def).length === 0 ? (
        <p className="px-4 py-20 text-center text-[13px] text-bz-muted">
          Nothing to preview yet — add a section in the editor.
        </p>
      ) : (
        <LandingRenderer blocks={blocks} data={data} />
      )}
    </div>
  );
}
