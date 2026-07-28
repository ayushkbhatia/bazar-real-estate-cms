import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { getMasterPage, isMasterPageKey } from "@/lib/master-pages";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { MasterPageEditor, type MediaOption } from "./_editor";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ key: string }> };

/** Images offered by the picker — the library's published image assets. */
async function fetchMedia(): Promise<MediaOption[]> {
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
  }));
}

export default async function MasterPageEditorPage({ params }: PageProps) {
  const { key } = await params;
  if (!isMasterPageKey(key)) notFound();
  const def = getMasterPage(key);
  if (!def) notFound();

  const [content, media] = await Promise.all([
    getMasterPageContent(key),
    fetchMedia(),
  ]);

  return (
    <CmsShell
      title={`${def.label} · master page`}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <span>Master pages</span>
        </span>
      }
      secondary={
        <Link
          href={def.path}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          View page
          <ExternalLink size={12} />
        </Link>
      }
    >
      <div className="flex flex-col gap-5 max-w-[860px]">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed">
          {def.description} Drag to reorder sections, hide the ones you
          don&apos;t want, and edit their copy, links and images. Anything left
          untouched renders exactly as it does today.
        </p>
        <MasterPageEditor
          pageKey={def.key}
          pageLabel={def.label}
          path={def.path}
          usingDefaults={content.usingDefaults}
          media={media}
          initial={content.sections.map((s) => ({
            key: s.key,
            def: s.def,
            enabled: s.enabled,
            values: s.values,
          }))}
        />
      </div>
    </CmsShell>
  );
}
