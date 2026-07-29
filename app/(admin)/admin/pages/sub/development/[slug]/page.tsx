import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { getDevelopmentPageContent } from "@/lib/queries/subpages";
import {
  MasterPageEditor,
  type MediaOption,
  type SectionActions,
} from "../../../master/[key]/_editor";
import { DevelopmentImagesCard } from "./_images-card";
import { saveDevelopmentPage, resetDevelopmentPage } from "../_actions";

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

async function fetchDevelopment(slug: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("developments")
    .select("id, name, slug, status, published_at, hero_image_id, masterplan_id")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

const ACTIONS: SectionActions = {
  save: (slug, sections) => saveDevelopmentPage(slug, sections),
  reset: (slug) => resetDevelopmentPage(slug),
};

export default async function DevelopmentSubPage({ params }: PageProps) {
  const { slug } = await params;
  const development = await fetchDevelopment(slug);
  if (!development) notFound();

  const [content, media] = await Promise.all([
    getDevelopmentPageContent({
      name: development.name,
      slug: development.slug,
    }),
    fetchMedia(),
  ]);

  return (
    <CmsShell
      title={development.name}
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
          <Link
            href="/admin/pages/sub/development"
            className="hover:text-bz-ink"
          >
            Developments
          </Link>
          <ChevronRight size={11} />
          <span className="mono">/developments/{development.slug}</span>
        </span>
      }
      secondary={
        development.published_at ? (
          <Link
            href={`/developments/${development.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
          >
            View page
            <ExternalLink size={12} />
          </Link>
        ) : null
      }
    >
      <div className="flex flex-col gap-5 max-w-[860px]">
        {development.published_at ? null : (
          <p className="rounded-md border border-bz-border bg-bz-surface-2 px-3 py-2 text-[12.5px] text-bz-ink-2">
            This project isn&apos;t published yet, so the page is only visible
            here. Publish it from{" "}
            <Link
              href={`/admin/developments/${development.id}`}
              className="underline underline-offset-2"
            >
              the development record
            </Link>
            .
          </p>
        )}

        <DevelopmentImagesCard
          slug={development.slug}
          media={media}
          heroImageId={development.hero_image_id}
          masterplanId={development.masterplan_id}
        />

        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-[13.5px] font-medium">Sections</h2>
            <p className="text-[12.5px] text-bz-muted mt-1 leading-relaxed">
              Drag to reorder, switch sections off to hide them on this
              project&apos;s page, and override a heading or intro where the
              built-in copy doesn&apos;t fit. Blank fields keep the
              template&apos;s wording. The sticky sub-nav follows this order and
              drops anything hidden.
            </p>
          </div>
          <MasterPageEditor
            pageKey={development.slug}
            pageLabel={development.name}
            path={`/developments/${development.slug}`}
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
