import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Database, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { getAreaPageContent } from "@/lib/queries/subpages";
import {
  MasterPageEditor,
  type MediaOption,
  type SectionActions,
} from "../../../master/[key]/_editor";
import { AreaImagesCard } from "./_images-card";
import { saveAreaPage, resetAreaPage } from "../_actions";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

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

async function fetchArea(slug: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("areas")
    .select("id, name, slug, kind, hero_image_id")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

// Server actions are handed to the client editor by reference. Wrapping them
// in arrows here would make them plain functions, which can't cross the
// server/client boundary — the page 500s with "Functions cannot be passed
// directly to Client Components".
const ACTIONS: SectionActions = { save: saveAreaPage, reset: resetAreaPage };

export default async function AreaSubPage({ params }: PageProps) {
  const { slug } = await params;
  const area = await fetchArea(slug);
  if (!area) notFound();

  const [content, media] = await Promise.all([
    getAreaPageContent({ name: area.name, slug: area.slug }),
    fetchMedia(),
  ]);

  return (
    <CmsShell
      title={area.name}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <Link href="/admin/pages/sub" className="hover:text-bz-ink">
            Sub-pages
          </Link>
          <ChevronRight size={11} />
          <Link href="/admin/pages/sub/area" className="hover:text-bz-ink">
            Areas
          </Link>
          <ChevronRight size={11} />
          <span className="mono">/areas/{area.slug}</span>
        </span>
      }
      secondary={
        <span className="inline-flex items-center gap-4">
          {/* This page edits how the guide reads; the area's facts — name,
              hierarchy, map position — live on the record. */}
          <Link
            href={`/admin/areas/${area.id}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
          >
            <Database size={12} />
            Edit area record
          </Link>
          <Link
            href={`/areas/${area.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
          >
            View page
            <ExternalLink size={12} />
          </Link>
        </span>
      }
    >
      <div className="flex flex-col gap-5 max-w-[860px]">
        <AreaImagesCard
          slug={area.slug}
          media={media}
          heroImageId={area.hero_image_id}
        />

        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-[13.5px] font-medium">Sections</h2>
            <p className="text-[12.5px] text-bz-muted mt-1 leading-relaxed">
              Drag to reorder, switch sections off to hide them on this
              area&apos;s guide, and override a heading or intro where the
              built-in copy doesn&apos;t fit. Blank fields keep the
              template&apos;s wording.
            </p>
          </div>
          <MasterPageEditor
            pageKey={area.slug}
            pageLabel={area.name}
            path={`/areas/${area.slug}`}
            usingDefaults={content.usingDefaults}
            media={media}
            seeds={{}}
            actions={ACTIONS}
            allowReorder
            resetLabel="Reset sections"
            initial={content.sections.map((s) => ({
              key: s.key,
              def: s.def,
              enabled: s.enabled,
              values: s.values,
            }))}
          />
        </div>
      </div>
    </CmsShell>
  );
}
