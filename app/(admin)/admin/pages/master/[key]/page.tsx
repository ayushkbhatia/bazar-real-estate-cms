import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { getMasterPage, isMasterPageKey } from "@/lib/master-pages";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";
import { listPublishedDevelopments } from "@/lib/queries/developments";
import { listPropertyOptions } from "@/lib/queries/featured-properties";
import {
  HOME_AREA_TILE_COUNT,
  HOME_FEATURED_LISTING_COUNT,
  HOME_OFFPLAN_CARD_COUNT,
} from "@/app/(public)/_components/home/section-copy";
import { OFFPLAN_LAUNCH_COUNT } from "@/app/(public)/_components/marketing/counts";
import {
  MasterPageEditor,
  type MediaOption,
  type Seeds,
} from "./_editor";

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

  const [content, media, areas, developments, properties] = await Promise.all([
    getMasterPageContent(key),
    fetchMedia(),
    listAreasWithCounts(),
    listPublishedDevelopments(),
    // Only the home page offers a listings picker; skip the query elsewhere.
    key === "home" ? listPropertyOptions() : Promise.resolve([]),
  ]);

  // What a seedable list can be filled from. `current` mirrors what the live
  // page renders today — same source, same order, same cut — so "load what's
  // on the page" reproduces the section rather than dumping the catalogue.
  // `options` is everything pickable.
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

  const propertySeed = properties.map((p) => ({
    name: p.areaName ? `${p.title} · ${p.areaName}` : p.title,
    href: "#",
    slug: p.reference,
  }));

  const seeds: Seeds = {
    areas: {
      options: areaSeed,
      // LocationBrowsing renders the first 8 areas.
      current: areaSeed.slice(0, HOME_AREA_TILE_COUNT),
    },
    developments: {
      // Sorted by name for the picker; only published projects are offered,
      // since featuring an unpublished one links to a page nobody can open.
      options: [...developmentSeed].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      // How many the page shows depends on which page is being edited: the
      // home carousel takes 3, New Projects' launch grid takes 6.
      // `listPublishedDevelopments` is already in published-at order.
      current: developmentSeed.slice(
        0,
        key === "off-plan" ? OFFPLAN_LAUNCH_COUNT : HOME_OFFPLAN_CARD_COUNT,
      ),
    },
    properties: {
      // Newest published first, which is the order the picker lists them in.
      options: propertySeed,
      // The home carousel shows 6.
      current: propertySeed.slice(0, HOME_FEATURED_LISTING_COUNT),
    },
  };

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
          seeds={seeds}
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
