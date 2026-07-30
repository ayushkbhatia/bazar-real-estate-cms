import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Database, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, isMapboxConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { getDevelopmentPageContent } from "@/lib/queries/subpages";
import {
  MasterPageEditor,
  type MediaOption,
  type SectionActions,
} from "../../../master/[key]/_editor";
import { DevelopmentImagesCard } from "./_images-card";
import {
  DevelopmentContentCard,
  type AdvisorOption,
  type NeighbourOption,
} from "./_content-card";
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
    // Images for image fields, PDFs for file fields (the brochure). The
    // editor filters by mime per field, so both live in one list.
    .or("mime_type.like.image/%,mime_type.eq.application/pdf")
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []).map((m) => ({
    id: m.id,
    filename: m.filename,
    url: mediaPublicUrl(m.storage_key),
    mime: m.mime_type,
  }));
}

async function fetchContentOptions(excludeId: string) {
  if (!isSupabaseConfigured)
    return { neighbours: [] as NeighbourOption[], advisors: [] as AdvisorOption[] };
  const supabase = await createSupabaseServerClient();
  const [projects, staff] = await Promise.all([
    supabase
      .from("developments")
      .select("id, name")
      .neq("id", excludeId)
      .order("name", { ascending: true }),
    supabase
      .from("staff")
      .select("user_id, display_name")
      .eq("status", "active")
      .order("display_name", { ascending: true }),
  ]);
  return {
    neighbours: (projects.data ?? []) as NeighbourOption[],
    advisors: (staff.data ?? []) as AdvisorOption[],
  };
}

async function fetchDevelopment(slug: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("developments")
    .select(
      "id, name, slug, status, published_at, hero_image_id, masterplan_id, payment_plan, meta, lead_advisor_id",
    )
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

// Server actions are handed to the client editor by reference. Wrapping them
// in arrows here would make them plain functions, which can't cross the
// server/client boundary — the page 500s with "Functions cannot be passed
// directly to Client Components".
const ACTIONS: SectionActions = { save: saveDevelopmentPage, reset: resetDevelopmentPage };

export default async function DevelopmentSubPage({ params }: PageProps) {
  const { slug } = await params;
  const development = await fetchDevelopment(slug);
  if (!development) notFound();

  const [content, media, options] = await Promise.all([
    getDevelopmentPageContent({
      name: development.name,
      slug: development.slug,
    }),
    fetchMedia(),
    fetchContentOptions(development.id),
  ]);

  const meta = (development.meta as Record<string, unknown> | null) ?? {};
  const contentInitial = {
    payment_plan: (development.payment_plan as never) ?? null,
    feature_blocks: Array.isArray(meta.feature_blocks)
      ? (meta.feature_blocks as never[])
      : [],
    faq: Array.isArray(meta.faq) ? (meta.faq as never[]) : [],
    coords: (meta.coords as { lat: number; lng: number } | null) ?? null,
    nearby_ids: Array.isArray(meta.nearby_ids)
      ? (meta.nearby_ids as string[]).slice(0, 3)
      : [],
    lead_advisor_id: development.lead_advisor_id ?? null,
  };

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
        <span className="inline-flex items-center gap-4">
          {/* This page edits how the project reads; its facts — units, prices,
              payment plan — live on the record. */}
          <Link
            href={`/admin/developments/${development.id}`}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
          >
            <Database size={12} />
            Edit project record
          </Link>
          {development.published_at ? (
            <Link
              href={`/developments/${development.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
            >
              View page
              <ExternalLink size={12} />
            </Link>
          ) : null}
        </span>
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

        <DevelopmentContentCard
          slug={development.slug}
          initial={contentInitial}
          media={media}
          neighbours={options.neighbours}
          advisors={options.advisors}
          mapboxAvailable={isMapboxConfigured}
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
