import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink, Eye } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";
import { listPublishedDevelopments } from "@/lib/queries/developments";
import { listPropertyOptions } from "@/lib/queries/featured-properties";
import { getLandingPageForAdmin } from "@/lib/queries/landing-pages";
import { listFormsForAdmin } from "@/lib/queries/forms";
import { FORM_DEFS, FORM_KEYS } from "@/lib/forms";
import {
  evaluateLandingPublishability,
  resolveDocument,
} from "@/lib/page-builder";
import type { MediaOption, Seeds } from "../../_fields/types";
import { LandingMetaCard } from "./_meta-card";
import { BlockEditor } from "./_block-editor";
import { LandingPublishCard } from "./_publish-card";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

/** Images, documents and video the pickers offer — same query the master-page editor uses. */
async function fetchMedia(): Promise<MediaOption[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("media_assets")
    .select("id, filename, storage_key, mime_type")
    .is("deleted_at", null)
    .or(
      "mime_type.like.image/%,mime_type.eq.application/pdf,mime_type.like.video/%",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []).map((m) => ({
    id: m.id,
    filename: m.filename,
    url: mediaPublicUrl(m.storage_key),
    mime: m.mime_type,
  }));
}

export default async function LandingEditorPage({ params }: PageProps) {
  const { id } = await params;
  const page = await getLandingPageForAdmin(id);
  if (!page) notFound();

  const supabase = await createSupabaseServerClient();
  const [media, areas, developments, properties, forms] = await Promise.all([
    fetchMedia(),
    listAreasWithCounts(),
    listPublishedDevelopments(),
    listPropertyOptions(),
    listFormsForAdmin(supabase),
  ]);

  const areaSeed = areas.map((a) => ({
    name: a.name,
    href: `/areas/${a.slug}`,
    slug: a.slug,
  }));
  const developmentSeed = developments.map((d) => ({
    name: d.name,
    href: `/developments/${d.slug}`,
    slug: d.slug,
  }));
  // A listing is addressed by its reference, not a slug — `slug` is just the
  // seed's stored-value field, so the reference rides in it.
  const propertySeed = properties.map((p) => ({
    name: p.areaName ? `${p.title} · ${p.areaName}` : p.title,
    href: "#",
    slug: p.reference,
  }));
  const formSeed = FORM_DEFS.map((f) => ({
    name: `${f.name} · ${f.surface}`,
    href: f.path,
    slug: f.key,
  }));

  const seeds: Seeds = {
    areas: { options: areaSeed, current: areaSeed.slice(0, 8) },
    developments: {
      options: [...developmentSeed].sort((a, b) => a.name.localeCompare(b.name)),
      current: developmentSeed.slice(0, 3),
    },
    properties: { options: propertySeed, current: propertySeed.slice(0, 4) },
    forms: {
      options: [...formSeed].sort((a, b) => a.name.localeCompare(b.name)),
      current: [],
    },
  };

  const seo = page.seo ?? {};

  // The publish card shows the gate's own checks, computed here against the
  // stored draft — the same call `publishLandingPage` makes, so the button and
  // the server can't disagree.
  const gate = evaluateLandingPublishability({
    title: page.title,
    slug: page.slug,
    metaDescription:
      typeof seo.meta_description === "string" ? seo.meta_description : null,
    noindex: page.noindex,
    blocks: // Bilingual: the editor needs both sides of every field at once.
    resolveDocument(page.draft, "bilingual"),
    knownFormKeys: FORM_KEYS,
    enabledFormKeys: forms.missingTable
      ? [...FORM_KEYS]
      : forms.rows.filter((r) => r.form.enabled).map((r) => r.def.key),
  });

  return (
    <CmsShell
      title={page.title}
      breadcrumbs={
        <>
          <Link href="/admin/page-builder" className="hover:text-bz-ink">
            Page builder
          </Link>
          {" · "}
          <span className="mono">/lp/{page.slug}</span>
        </>
      }
      secondary={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/page-builder/${page.id}/preview`}>
              <Eye size={13} strokeWidth={1.8} />
              Preview
            </Link>
          </Button>
          {page.status === "published" ? (
            <Button asChild variant="outline" size="sm">
              <a href={`/lp/${page.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink size={13} strokeWidth={1.8} />
                View live
              </a>
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="max-w-[980px] flex flex-col gap-5">
        <Link
          href="/admin/page-builder"
          className="inline-flex items-center gap-1 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          <ChevronRight size={13} className="rotate-180" /> All landing pages
        </Link>

        <LandingMetaCard
          id={page.id}
          initial={{
            title: page.title,
            slug: page.slug,
            meta_title:
              typeof seo.meta_title === "string" ? seo.meta_title : "",
            meta_description:
              typeof seo.meta_description === "string"
                ? seo.meta_description
                : "",
            noindex: page.noindex,
          }}
        />

        <BlockEditor
          pageId={page.id}
          initial={page.draft}
          media={media}
          seeds={seeds}
          hasDraft={page.hasDraft}
          isPublished={page.status === "published"}
        />

        <LandingPublishCard
          id={page.id}
          slug={page.slug}
          status={page.status}
          hasDraft={page.hasDraft}
          publishedAt={page.published_at}
          checks={gate.checks}
          ok={gate.ok}
          blockers={gate.blockers}
        />
      </div>
    </CmsShell>
  );
}
