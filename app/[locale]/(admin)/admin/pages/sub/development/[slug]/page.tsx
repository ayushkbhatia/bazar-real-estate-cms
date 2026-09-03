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
  type SectionActions,
} from "../../../master/[key]/_editor";
import type { MediaOption } from "../../../../_fields/types";
import { DevelopmentImagesCard } from "./_images-card";
import { DevelopmentFactsCard } from "./_facts-card";
import { DevelopmentCardLabelsCard } from "./_card-labels-card";
import { getCardLabelSettings } from "@/lib/queries/card-labels";
import {
  DevelopmentContentCard,
  type AdvisorOption,
  type NeighbourOption,
} from "./_content-card";
import { DevelopmentUnitPlansCard } from "./_unit-plans-card";
import { DevelopmentUnitsCard, type FloorPlanOption } from "./_units-card";
import { listUnitTypesForAdmin } from "@/lib/queries/development-unit-plans";
import { listDevelopmentUnitsForAdmin } from "@/lib/queries/developments";
import { saveDevelopmentPage, resetDevelopmentPage } from "../_actions";
import { PublishCard } from "../../../../developments/_publish-card";
import { DeleteDevelopmentCard } from "./_delete-card";
import { SearchAppearanceCard } from "../../../../_fields/search-appearance";
import { saveDevelopmentSeo } from "../_actions";
import {
  getSearchPreviewChrome,
  withTitleTemplate,
} from "@/lib/queries/search-appearance";
import { readSearchAppearance } from "@/lib/schemas/seo";
import { getStaffRole } from "@/lib/auth";
import { evaluateDevelopmentHeroFacts } from "@/lib/schemas/development";

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

/**
 * What would be left dangling by a delete. `enquiries.development_id` and
 * `properties.development_id` are ON DELETE SET NULL, so these records survive
 * but lose the link — worth saying out loud before the fact.
 */
async function fetchLinkCounts(developmentId: string) {
  if (!isSupabaseConfigured) return { enquiries: 0, properties: 0 };
  const supabase = await createSupabaseServerClient();
  const [enquiries, properties] = await Promise.all([
    supabase
      .from("enquiries")
      .select("id", { count: "exact", head: true })
      .eq("development_id", developmentId),
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("development_id", developmentId),
  ]);
  return {
    enquiries: enquiries.count ?? 0,
    properties: properties.count ?? 0,
  };
}

/**
 * The projects the Nearby Developments slots may point at.
 *
 * Published only. The public page resolves these ids through
 * `listDevelopmentsByIds`, which filters on `published_at` — so an unpublished
 * pick renders nothing at all. Offering one here was offering a choice the
 * site would silently discard: the editor picks three neighbours, saves, and
 * the live page shows two, with nothing anywhere to say why.
 *
 * `keepIds` is the exception. A project that was live when it was picked and
 * has since been unpublished — or deleted outright — still sits in this
 * record's `nearby_ids`, and dropping it from the list would leave its slot
 * rendering blank while the id stayed in the bag: the next save would quietly
 * rewrite the field the editor never touched. So a stale pick is listed,
 * labelled for what it is, and the editor clears it deliberately.
 */
async function fetchNeighbourOptions(
  excludeId: string,
  keepIds: string[],
): Promise<NeighbourOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("developments")
    .select("id, name")
    .neq("id", excludeId)
    .not("published_at", "is", null)
    .order("name", { ascending: true });
  const live = (data ?? []) as NeighbourOption[];

  const missing = keepIds.filter(
    (id) => id !== excludeId && !live.some((o) => o.id === id),
  );
  if (missing.length === 0) return live;

  const { data: stale } = await supabase
    .from("developments")
    .select("id, name")
    .in("id", missing);
  const found = (stale ?? []) as NeighbourOption[];

  return [
    ...live,
    ...found.map((r) => ({ ...r, name: `${r.name} — not live` })),
    // An id with no row behind it at all: the project was deleted after it was
    // picked. Named rather than omitted, for the same reason.
    ...missing
      .filter((id) => !found.some((r) => r.id === id))
      .map((id) => ({ id, name: "Deleted project" })),
  ];
}

async function fetchContentOptions(excludeId: string, keepIds: string[]) {
  if (!isSupabaseConfigured)
    return { neighbours: [] as NeighbourOption[], advisors: [] as AdvisorOption[] };
  const supabase = await createSupabaseServerClient();
  const [neighbours, staff] = await Promise.all([
    fetchNeighbourOptions(excludeId, keepIds),
    supabase
      .from("staff")
      .select("user_id, display_name")
      .eq("status", "active")
      .order("display_name", { ascending: true }),
  ]);
  return {
    neighbours,
    advisors: (staff.data ?? []) as AdvisorOption[],
  };
}

async function fetchDevelopment(slug: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("developments")
    .select(
      "id, name, slug, status, published_at, hero_image_id, masterplan_id, payment_plan, meta, lead_advisor_id, starting_price, bedrooms_text, total_units, handover_date, description, seo, developers:developer_id(name)",
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

  // Read before the fan-out: the neighbour options depend on what this record
  // already points at, so a pick that has since been unpublished stays listed.
  const savedMeta = (development.meta as Record<string, unknown> | null) ?? {};
  const savedNearbyIds = Array.isArray(savedMeta.nearby_ids)
    ? (savedMeta.nearby_ids as string[]).slice(0, 3)
    : [];

  const [content, media, options, role, links, unitTypes, units, chrome] =
    await Promise.all([
      // "bilingual" keeps the `_ar` twins in `values`. Without it the fold
      // strips them, the Arabic inputs render blank, and the save writes that
      // blank back over whatever the client typed.
      getDevelopmentPageContent(
        { name: development.name, slug: development.slug },
        "bilingual",
      ),
      fetchMedia(),
      fetchContentOptions(development.id, savedNearbyIds),
      getStaffRole(),
      fetchLinkCounts(development.id),
      listUnitTypesForAdmin(development.id),
      listDevelopmentUnitsForAdmin(development.id),
      getSearchPreviewChrome(),
    ]);

  // PostgREST returns an embedded to-one join as an object here, but its
  // generated types allow an array; normalise before reading the name.
  const joined = development.developers as
    | { name: string }
    | { name: string }[]
    | null;
  const developerName = Array.isArray(joined)
    ? (joined[0]?.name ?? null)
    : (joined?.name ?? null);

  // The layout picker offers this project's plans, flattened out of the unit
  // types they hang under and labelled with the type so two "Ground floor"
  // entries are distinguishable.
  const floorPlanOptions: FloorPlanOption[] = unitTypes.flatMap((t) =>
    t.plans
      .filter((p) => p.id !== null)
      .map((p) => ({
        id: p.id!,
        label: t.label.trim() ? `${t.label.trim()} · ${p.label}` : p.label,
      })),
  );

  // Editing this page is open to marketing; taking a project live — or
  // deleting it — is not. Both actions enforce this too; this just stops the
  // controls being offered to someone they would 404 on.
  const canManage = role === "admin" || role === "editor";
  const heroFactsGate = evaluateDevelopmentHeroFacts({
    starting_price:
      development.starting_price != null
        ? Number(development.starting_price)
        : null,
    bedrooms_text: development.bedrooms_text,
    total_units: development.total_units,
    handover_date: development.handover_date,
  });

  const meta = savedMeta;
  const cardLabelVocabulary = await getCardLabelSettings();
  const assignedCardLabels = Array.isArray(meta.labels)
    ? (meta.labels as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const contentInitial = {
    payment_plan: (development.payment_plan as never) ?? null,
    feature_blocks: Array.isArray(meta.feature_blocks)
      ? (meta.feature_blocks as never[])
      : [],
    faq: Array.isArray(meta.faq) ? (meta.faq as never[]) : [],
    coords: (meta.coords as { lat: number; lng: number } | null) ?? null,
    nearby_ids: savedNearbyIds,
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
        {/*
          Publishing lives here as well as on the record. This is the screen
          that owns the four hero facts the gate checks, so sending someone
          elsewhere to flip the switch was asking them to leave the page they
          had just finished filling in.
        */}
        <PublishCard
          developmentId={development.id}
          publishedAt={development.published_at}
          slug={development.slug}
          checks={heroFactsGate.checks}
          canPublish={canManage}
        />

        <DevelopmentFactsCard
          slug={development.slug}
          startingPrice={development.starting_price}
          bedroomsText={development.bedrooms_text}
          totalUnits={development.total_units}
          handoverDate={development.handover_date}
          published={development.published_at != null}
        />

        {/* Above the images, because the label sits ON the image and an
            operator picking one wants to see the render it lands over. */}
        <DevelopmentCardLabelsCard
          slug={development.slug}
          vocabulary={cardLabelVocabulary}
          initial={assignedCardLabels}
        />
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

        {/* Its own card rather than a row inside Page content: unit types and
            their layouts are separate tables, and the tree is tall enough that
            folding it away matters. */}
        <DevelopmentUnitPlansCard
          slug={development.slug}
          initial={unitTypes}
          media={media}
          bedroomsText={development.bedrooms_text}
        />

        {/* Stock, not catalogue. Sits under the card above because a layout has
            to exist before a unit can be linked to one. */}
        <DevelopmentUnitsCard
          slug={development.slug}
          initial={units}
          floorPlans={floorPlanOptions}
          totalUnits={development.total_units}
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

        {/*
          The fallbacks reproduce what generateMetadata on
          /developments/[slug] derives when nothing is saved: the project name
          against its developer, plus the root layout's title template, and the
          marketing description. The developer is joined into the select above
          purely so this preview can be accurate — a preview that showed
          "Off-plan" where the live page shows "Aldar" would send an editor
          rewriting a title that was already fine.
        */}
        <SearchAppearanceCard
          initial={readSearchAppearance(development.seo)}
          path={`/developments/${development.slug}`}
          fallbackTitle={withTitleTemplate(
            `${development.name} · ${developerName ?? "Off-plan"}`,
          )}
          fallbackDescription={development.description}
          faviconUrl={chrome.faviconUrl}
          brandName={chrome.brandName}
          onSave={saveDevelopmentSeo.bind(null, development.slug)}
          description="The title and description Google shows for this project page. Leave blank to keep what the page derives from the project record."
        />

        {/* Last on the page on purpose — it is the one thing here that can't
            be undone, so it should not sit next to anything routine. */}
        <DeleteDevelopmentCard
          developmentId={development.id}
          name={development.name}
          published={development.published_at != null}
          enquiryCount={links.enquiries}
          propertyCount={links.properties}
          canDelete={canManage}
          recordHref={`/admin/developments/${development.id}`}
        />
      </div>
    </CmsShell>
  );
}
