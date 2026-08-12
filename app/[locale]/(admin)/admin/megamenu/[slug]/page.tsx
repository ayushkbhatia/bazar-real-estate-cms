import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import {
  getMegamenuTabBySlugForAdmin,
  listMegamenuTabsForAdmin,
} from "@/lib/queries/megamenu";
import { MegamenuTabsNav } from "./_tabs-nav";
import { mediaPublicUrl } from "@/lib/media";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MegamenuEditor } from "./_editor";
import { MegamenuPublishCard } from "./_publish-card";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

/** Image assets offered by the featured-tile picker. */
async function fetchMedia() {
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
  }));
}

export default async function MegamenuTabEditorPage({ params }: PageProps) {
  const { slug } = await params;
  const [tab, tabs, media] = await Promise.all([
    getMegamenuTabBySlugForAdmin(slug),
    listMegamenuTabsForAdmin(),
    fetchMedia(),
  ]);
  if (!tab) notFound();

  return (
    <CmsShell
      title={`Megamenu — ${tab.label}`}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/navigation" className="hover:text-bz-ink">
            Megamenu
          </Link>
          <ChevronRight size={11} />
          <span className="mono">/{tab.slug}</span>
        </span>
      }
      secondary={
        tab.status === "published" && tab.panel_title_href ? (
          <Link
            href={tab.panel_title_href}
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
      <div className="flex flex-col gap-6">
        <MegamenuTabsNav tabs={tabs} activeSlug={slug} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="flex flex-col gap-6 min-w-0">
            <MegamenuEditor tab={tab} media={media} />
          </div>
          <aside className="sticky top-6">
            <MegamenuPublishCard
              tabId={tab.id}
              status={tab.status}
              hasPanel={tab.has_panel}
            />
          </aside>
        </div>
      </div>
    </CmsShell>
  );
}
