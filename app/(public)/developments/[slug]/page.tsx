import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { mediaPublicUrl } from "@/lib/media";
import { getDevelopmentPageContent } from "@/lib/queries/subpages";
import { withAgentPhoto } from "@/lib/queries/agent-photos";
import {
  getAdvisorForBanner,
  listDevelopmentsByIds,
  withFeatureImages,
} from "@/lib/queries/development-content";
import { img, list, str } from "@/lib/master-pages";
import {
  developmentUrl,
  getPublishedDevelopmentBySlug,
  listDevelopmentMedia,
  listDevelopmentUnits,
  listFloorPlans,
} from "@/lib/queries/developments";
import {
  formatStartingPrice,
  quarterLabel,
} from "@/lib/schemas/development";
import { PaymentPlanSection, type CalculatorUnit } from "./_payment-plan";
import { UnitsTable } from "./_units-table";
import { LeadAdvisorBanner } from "./_components/lead-advisor-banner";
import { BrochureGate } from "./_components/brochure-gate";
import { InterestDialog } from "./_components/interest-dialog";
import { DevelopmentFaq } from "./_components/development-faq";
import { DeveloperProjectsStrip } from "./_components/developer-projects-strip";
import { NearbyDevelopments } from "./_components/nearby-developments";
import { FeatureBlocks } from "./_components/feature-blocks";
import { FloorplanGate } from "./_components/floorplan-gate";
import { UnitFloorPlans } from "./_components/unit-floor-plans";
import {
  listUnitTypesForPage,
  placeholderUnitTypes,
} from "@/lib/queries/development-unit-plans";
import { MapEmbed } from "../../p/[slug]/_components/map-embed";
import { AdvisorContactRail } from "../../_components/advisor-contact-rail";
import {
  getDevelopmentMeta,
  listOtherDevelopmentsByDeveloper,
  listOtherDevelopmentsInArea,
} from "@/lib/queries/development-extras";
import { SEED_AGENTS } from "@/lib/seeds/agents";

export const revalidate = 60;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const d = await getPublishedDevelopmentBySlug(slug);
  if (!d) return { title: "Development not found" };

  const description =
    d.description ??
    `${d.name} by ${d.developer?.name ?? "Bazar"} — handover ${quarterLabel(d.handover_date)}`;

  const canonical = developmentUrl(d);
  const ogImage = d.hero
    ? [{ url: mediaPublicUrl(d.hero.storage_key), alt: d.name }]
    : undefined;

  return {
    title: `${d.name} · ${d.developer?.name ?? "Off-plan"}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: d.name,
      description,
      url: canonical,
      images: ogImage,
      siteName: "Bazar Real Estate",
      locale: "en_AE",
    },
    twitter: {
      card: "summary_large_image",
      title: d.name,
      description,
      images: ogImage?.map((i) => i.url),
    },
    robots: { index: true, follow: true },
  };
}

/**
 * Sections the sticky nav can jump to — the ones that render with an `id`.
 * The nav follows the editor's order and drops anything switched off, so a
 * hidden section never leaves a dead anchor behind.
 */
const ANCHORED_SECTIONS = new Set([
  "overview",
  "master-plan",
  "payment-plan",
  "units",
  "floor-plans",
  "renders",
  "features",
  "unit-plans",
  "location",
  "developer",
  "faq",
]);

export default async function DevelopmentDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const development = await getPublishedDevelopmentBySlug(slug);
  if (!development) notFound();

  const [
    content,
    units,
    floorPlans,
    unitTypes,
    media,
    meta,
    siblingsByDeveloper,
    siblingsInArea,
  ] = await Promise.all([
      getDevelopmentPageContent({
        name: development.name,
        slug: development.slug,
      }),
      listDevelopmentUnits(development.id),
      listFloorPlans(development.id),
      listUnitTypesForPage(development.id),
      listDevelopmentMedia(development.id),
      getDevelopmentMeta(development.id),
      development.developer_id
        ? listOtherDevelopmentsByDeveloper({
            excludeId: development.id,
            developerId: development.developer_id,
            limit: 4,
          })
        : Promise.resolve([]),
      development.area_id
        ? listOtherDevelopmentsInArea({
            excludeId: development.id,
            areaId: development.area_id,
            limit: 3,
          })
        : Promise.resolve([]),
    ]);

  // Curated neighbours win over the same-area fallback, in the order they
  // were picked in the page editor.
  const curatedIds = Array.isArray(meta?.nearby_ids)
    ? (meta.nearby_ids as string[]).slice(0, 3)
    : [];
  const curatedNeighbours = curatedIds.length
    ? await listDevelopmentsByIds(curatedIds)
    : [];
  const neighbours = curatedNeighbours.length
    ? curatedNeighbours
    : siblingsInArea;

  // Sprint 5a: lead advisor lookup — pick seeded advisor whose areas
  // overlap with the development's area. Sprint 9 wires real assignment.
  // An advisor picked on the record wins; otherwise fall back to whoever
  // covers the project's area.
  const pickedAdvisor = development.lead_advisor_id
    ? await getAdvisorForBanner(development.lead_advisor_id)
    : null;
  // SEED_AGENTS[0] is always present, so the overlay can't return null here.
  const leadAdvisor = (await withAgentPhoto(
    pickedAdvisor ??
      SEED_AGENTS.find((a) =>
        a.areas.includes(development.area?.slug ?? ""),
      ) ??
      SEED_AGENTS[0],
  ))!;

  // Curated feature blocks carry a media id; resolve them once for the page.
  const featureImages = await withFeatureImages(meta?.feature_blocks);
  const featureBlocks = meta?.feature_blocks?.map((b) => ({
    ...b,
    image_url: b.media_id ? (featureImages[b.media_id] ?? null) : null,
  }));

  // Section copy overrides from /admin/pages/sub/development/<slug>. Blank
  // fields fall through to the template's own wording.
  const sv = (key: string, field: string) =>
    str(content.section(key)?.values ?? {}, field);

  const heroUrl = development.hero
    ? mediaPublicUrl(development.hero.storage_key)
    : null;

  // Brochure PDF picked in the sub-page editor. `attachImageUrls` has already
  // resolved the media_id into a public URL — a file field stores the same
  // shape as an image field precisely so that works.
  const heroValues = content.section("hero")?.values ?? {};
  const brochure = img(heroValues, "brochure");

  // A gallery curated in the sub-page editor wins over the record's media.
  const curatedRenders = list<Record<string, unknown>>(
    content.section("renders")?.values ?? {},
    "images",
  )
    .filter((i) => i.enabled !== false)
    .map((i) => {
      const image = (i.image ?? null) as {
        url?: string | null;
        alt?: string | null;
      } | null;
      return {
        url: image?.url ?? null,
        alt: image?.alt ?? null,
        caption: typeof i.caption === "string" ? i.caption : null,
      };
    })
    .filter((i) => i.url !== null);

  const renderMedia = media.filter(
    (m) => (m.role === "render" || m.role === "gallery") && m.media,
  );

  const rendersValues = content.section("renders")?.values ?? {};
  const galleryTiles =
    curatedRenders.length > 0
      ? curatedRenders
      : renderMedia.map((m, i) => ({
          url: m.media ? mediaPublicUrl(m.media.storage_key) : null,
          alt: m.media?.alt_text ?? `${development.name} render ${i + 1}`,
          caption: null as string | null,
        }));
  // From the `masterplan_id` column, which is where the CMS's Page images card
  // saves the site plan. It used to be looked up in `development_media` under
  // the `masterplan` role — a row nothing creates, so the upload never showed.
  const masterplanMedia = development.masterplan;

  const legacyFloorPlans = floorPlans.filter((fp) => fp.unit_type_id === null);

  // A project with no unit-type records still gets the section, built from the
  // bedroom range it publishes. Migration 0079 seeds real, editable rows for
  // everything in the catalogue, so in practice this covers a project created
  // since — the page says something true about it rather than leaving a hole,
  // and it fills itself in the moment someone opens the CMS card.
  const unitTypeCards =
    unitTypes.length > 0
      ? unitTypes
      : placeholderUnitTypes(development.bedrooms_text);

  const availableUnits = units.filter((u) => u.status === "available");
  // Most projects carry a payment plan but no unit inventory, and the
  // calculator priced entirely off units showed "—" in every figure for them.
  // The starting price is the number those projects publish, so it stands in
  // as a single pricing option — labelled as the floor, not as a unit.
  const calculatorUnits: CalculatorUnit[] =
    availableUnits.length > 0
      ? availableUnits.map((u) => ({
          id: u.id,
          label: `${u.unit_type}${u.beds ? ` · ${u.beds}-bed` : ""}${u.built_up_ft2 ? ` · ${u.built_up_ft2.toLocaleString()} ft²` : ""}`,
          price_aed: u.price_aed ?? development.starting_price ?? 0,
        }))
      : development.starting_price
        ? [
            {
              id: "starting-price",
              label: `From ${formatStartingPrice(development.starting_price)}`,
              price_aed: development.starting_price,
            },
          ]
        : [];

  const nodes: Record<string, React.ReactNode> = {
    "overview": (
      <section
        id="overview"
        className="px-4 md:px-12 py-16 grid grid-cols-1 md:grid-cols-2 gap-16 scroll-mt-16"
      >
        <div>
          <Eyebrow>Overview</Eyebrow>
          <h2
            className="serif text-[30px] md:text-[44px] mt-3 leading-[1.1]"
            style={{ letterSpacing: "-0.025em" }}
          >
            {development.area?.name
              ? `A community within ${development.area.name}.`
              : "About this development"}
          </h2>
          {development.vision ? (
            <div className="mt-6 space-y-4">
              {development.vision.split("\n\n").map((para, i) => (
                <p
                  key={i}
                  className="text-[16px] text-bz-ink-2 leading-[1.7]"
                >
                  {para}
                </p>
              ))}
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 self-start">
          {factPairs(development.facts).map(([l, v]) => (
            <div
              key={l}
              className="p-[18px] bg-bz-surface-2 rounded-lg border border-bz-border"
            >
              <div className="eyebrow">{l}</div>
              <div className="text-[16px] font-medium mt-1.5">{v}</div>
            </div>
          ))}
        </div>
      </section>
    ),
    "master-plan": (
      <section id="master-plan" className="px-4 md:px-12 pb-16 scroll-mt-16">
        <Eyebrow>Master plan</Eyebrow>
        <h2
          className="serif text-[36px] mt-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          {sv("master-plan", "heading") ?? "The site"}
        </h2>
        <div className="relative mt-6 rounded-lg overflow-hidden aspect-[21/9] bg-bz-surface-2">
          {masterplanMedia ? (
            <Image
              src={mediaPublicUrl(masterplanMedia.storage_key)}
              alt={masterplanMedia.alt_text ?? `${development.name} masterplan`}
              fill
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <PlaceholderImage
              label={`${development.slug} · masterplan`}
              className="absolute inset-0 w-full h-full"
            />
          )}
          {(development.master_plan.pins ?? []).map((pin) => (
            <div
              key={pin.key}
              className="absolute"
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="w-9 h-9 rounded-full bg-bz-accent text-white flex items-center justify-center text-[15px] font-semibold serif shadow-[0_4px_12px_rgba(0,0,0,.3)]">
                {pin.key}
              </div>
              <div className="absolute left-11 top-1.5 whitespace-nowrap bg-white/95 px-2.5 py-1 rounded text-[11px] font-medium text-bz-ink">
                {pin.label}
              </div>
            </div>
          ))}
        </div>
      </section>
    ),
    "payment-plan": development.payment_plan ? (
        <PaymentPlanSection
          id="payment-plan"
          plan={development.payment_plan}
          heading={sv("payment-plan", "heading") ?? "Cash flow timeline"}
          developmentName={development.name}
          units={calculatorUnits}
        />
    ) : null,
    "units": units.length > 0 ? (
        <section id="units" className="px-4 md:px-12 py-16 scroll-mt-16">
          <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
            <div>
              <Eyebrow>
                Available units · {availableUnits.length} of{" "}
                {development.total_units ?? units.length} remaining
              </Eyebrow>
              <h2
                className="serif text-[28px] md:text-[40px] mt-2"
                style={{ letterSpacing: "-0.02em" }}
              >
                {sv("units", "heading") ?? "What's left"}
              </h2>
            </div>
          </div>
          <UnitsTable units={units} />
        </section>
    ) : null,
    // Only the plans nobody has filed under a unit type. The rest render in
    // "Units & floor plans" below the features, and one drawing appearing
    // twice on the same page reads as a bug rather than as emphasis.
    "floor-plans": legacyFloorPlans.length > 0 ? (
        <section
          id="floor-plans"
          className="px-4 md:px-12 pb-16 scroll-mt-16"
        >
          <Eyebrow>Floor plans</Eyebrow>
          <h2
            className="serif text-[36px] mt-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            {sv("floor-plans", "heading") ?? "How the units lay out"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
            {legacyFloorPlans.map((fp) =>
              meta?.floorplan_gated ? (
                // T2-B: gated when `development.meta.floorplan_gated === true`.
                // Renders a blurred preview behind a lead modal; the request
                // funnels through the valuation-lead endpoint until we want
                // separate conversion telemetry for floor-plan requests.
                <FloorplanGate
                  key={fp.id}
                  developmentName={development.name}
                  developmentSlug={development.slug}
                  plan={fp}
                />
              ) : (
                <div
                  key={fp.id}
                  className="rounded-lg border border-bz-border bg-bz-surface p-4"
                >
                  {fp.media ? (
                    <div className="relative aspect-square rounded">
                      <Image
                        src={mediaPublicUrl(fp.media.storage_key)}
                        alt={fp.media.alt_text ?? fp.label}
                        fill
                        sizes="33vw"
                        className="object-cover rounded"
                      />
                    </div>
                  ) : (
                    <PlaceholderImage
                      label={fp.label
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")}
                      className="aspect-square rounded"
                    />
                  )}
                  <div className="flex justify-between items-center mt-3">
                    <div>
                      <div className="text-[14px] font-medium">{fp.label}</div>
                      <div className="text-[11.5px] text-bz-ink-2">
                        {fp.area_ft2 ? `${fp.area_ft2.toLocaleString()} ft²` : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
    ) : null,
    "renders": galleryTiles.length > 0 ? (
        <section id="renders" className="px-4 md:px-12 pb-16 scroll-mt-16">
          <Eyebrow>{str(rendersValues, "eyebrow") ?? "The vision"}</Eyebrow>
          <h2
            className="serif text-[36px] mt-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            {str(rendersValues, "heading") ?? "Renders & inspiration"}
          </h2>
          <div className="grid mt-6 gap-3 grid-cols-1 md:grid-cols-[2fr_1fr_1fr] md:grid-rows-[320px_320px]">
            {galleryTiles.slice(0, 5).map((tile, i) => (
              <div
                key={`${tile.url ?? "placeholder"}-${i}`}
                className={`relative rounded-lg overflow-hidden aspect-[16/9] md:aspect-auto ${
                  i === 0 ? "md:row-span-2" : ""
                }`}
              >
                {tile.url ? (
                  <Image
                    src={tile.url}
                    alt={tile.alt ?? `${development.name} render ${i + 1}`}
                    fill
                    sizes={i === 0 ? "50vw" : "25vw"}
                    className="object-cover"
                  />
                ) : (
                  <PlaceholderImage
                    label={`render-${i + 1}`}
                    className="absolute inset-0 w-full h-full"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
    ) : null,
    "features": (
      <section id="features" className="scroll-mt-16">
        <FeatureBlocks
          developmentName={development.name}
          developmentSlug={development.slug}
          blocks={featureBlocks}
          amenitiesFallback={development.amenities}
        />
      </section>
    ),
    // Unit-type buttons and their layouts. Sits between the named features and
    // the map by default; the page editor can move or hide it like any other.
    "unit-plans": (
      <section id="unit-plans" className="scroll-mt-16 border-t border-bz-border">
        <UnitFloorPlans
          types={unitTypeCards}
          developmentName={development.name}
          developmentSlug={development.slug}
          gated={meta?.floorplan_gated === true}
          eyebrow={sv("unit-plans", "eyebrow")}
          heading={sv("unit-plans", "heading")}
          intro={sv("unit-plans", "intro")}
        />
      </section>
    ),
    "location": (
      <section id="location" className="px-4 md:px-12 pb-16 scroll-mt-16">
        <Eyebrow>Location</Eyebrow>
        <h2
          className="serif text-[32px] mt-2 leading-tight"
          style={{ letterSpacing: "-0.018em" }}
        >
          {sv("location", "heading") ?? `Where ${development.name} sits.`}
        </h2>
        <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          Master-plan position + commute times to key Abu Dhabi destinations.
        </p>
        {meta?.coords ? (
          <MapEmbed
            lat={meta.coords.lat}
            lng={meta.coords.lng}
            title={development.name}
            className="mt-6 w-full aspect-[16/9] rounded-lg overflow-hidden"
          />
        ) : (
          <PlaceholderImage
            label={`${development.slug} · map`}
            className="mt-6 w-full aspect-[16/9] rounded-lg"
          />
        )}
      </section>
    ),
    // Map of other projects in the same area.
    "nearby": (
        <NearbyDevelopments
          areaName={development.area?.name ?? "this area"}
          nearby={neighbours}
        />
    ),
    "developer": development.developer_profile ? (
        <section id="developer" className="px-4 md:px-12 pb-16 scroll-mt-16">
          <Eyebrow>Developer</Eyebrow>
          <div className="mt-3 rounded-xl border border-bz-border bg-bz-surface p-6 md:p-9 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12 items-center">
            <div>
              <div
                className="serif text-[30px] md:text-[48px] leading-tight"
                style={{ letterSpacing: "-0.025em" }}
              >
                {development.developer_profile.name}
              </div>
              {development.developer_profile.founded_year ? (
                <div className="text-[12.5px] text-bz-muted mt-1">
                  Founded {development.developer_profile.founded_year}
                </div>
              ) : null}
            </div>
            <div>
              {development.developer_profile.description ? (
                <p className="text-[15px] text-bz-ink-2 leading-[1.65]">
                  {development.developer_profile.description}
                </p>
              ) : null}
            </div>
          </div>
        </section>
    ) : null,
    "other-projects": development.developer?.name ? (
        <DeveloperProjectsStrip
          developerName={development.developer.name}
          siblings={siblingsByDeveloper}
        />
    ) : null,
    // DevelopmentFaq carries its own `id="faq"` anchor.
    "faq": (
        <DevelopmentFaq development={development} curated={meta?.faq} />
    ),
    "advisor": (
        <LeadAdvisorBanner
        agent={leadAdvisor}
        developmentName={development.name}
        />
    ),
  };

  // Only link to sections that are switched on *and* actually render — a
  // project with no units shouldn't get a "Units" tab that jumps nowhere.
  const navItems = content.sections
    .filter(
      (s) => s.enabled && ANCHORED_SECTIONS.has(s.key) && nodes[s.key] != null,
    )
    .map((s) => ({ key: s.key, label: s.def.label }));

  return (
    <article className="bg-bz-bg pb-24 md:pb-0">
      {/* Hero */}
      <section className="relative h-[640px] text-white overflow-hidden">
        {heroUrl ? (
          <Image
            src={heroUrl}
            alt={development.hero?.alt_text ?? development.name}
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        ) : (
          <PlaceholderImage
            label={`${development.slug} · render`}
            dark
            className="absolute inset-0 w-full h-full"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,.1) 0%, rgba(0,0,0,.62) 100%)",
          }}
        />
        <div className="relative h-full flex flex-col px-4 md:px-12 pt-12 pb-12">
          <div className="flex gap-2 flex-wrap">
            {development.tagline ? (
              <span className="inline-flex items-center h-[26px] px-2.5 rounded-full text-[11.5px] font-medium bg-bz-accent text-white">
                {sv("hero", "intro") ?? development.tagline}
              </span>
            ) : null}
            <span className="inline-flex items-center h-[26px] px-2.5 rounded-full text-[11.5px] font-medium bg-black/70 text-white">
              Off-plan
            </span>
            {development.handover_date ? (
              <span className="inline-flex items-center h-[26px] px-2.5 rounded-full text-[11.5px] font-medium bg-white/15 text-white backdrop-blur-sm">
                Handover {quarterLabel(development.handover_date)}
              </span>
            ) : null}
          </div>
          <div className="mt-auto">
            <div className="eyebrow" style={{ color: "rgba(255,255,255,.72)" }}>
              {development.developer?.name ?? "Developer"} ·{" "}
              {development.area?.name ?? "Abu Dhabi"}
            </div>
            <h1
              className="serif text-[48px] md:text-[96px] font-normal mt-3"
              style={{ letterSpacing: "-0.03em", lineHeight: 0.96 }}
            >
              {sv("hero", "heading") ?? development.name}
            </h1>
            {development.description ? (
              <p
                className="mt-5 text-[17px] max-w-[640px] leading-[1.55]"
                style={{ color: "rgba(255,255,255,.85)" }}
              >
                {development.description}
              </p>
            ) : null}
            <div
              className="mt-9 pt-7 flex gap-9 flex-wrap items-end"
              style={{ borderTop: "1px solid rgba(255,255,255,.2)" }}
            >
              <HeroStat
                value={formatStartingPrice(development.starting_price)}
                label="Starting price"
              />
              <HeroStat
                value={development.bedrooms_text ?? "—"}
                label="Bedrooms"
              />
              <HeroStat
                value={
                  development.total_units != null
                    ? development.total_units.toString()
                    : "—"
                }
                label="Total units"
              />
              <HeroStat
                value={quarterLabel(development.handover_date)}
                label="Handover"
              />
              {development.payment_plan ? (
                // "60/40 Payment Plan" → value "60/40", label "Payment plan".
                // The label used to repeat the whole plan name after the
                // value's first word, which read as a stutter.
                <HeroStat
                  value={development.payment_plan.name.split(" ")[0]}
                  label="Payment plan"
                />
              ) : null}
              {/* Wraps on narrow screens — "Register your interest" is a wider
                  label than the dead "Book a viewing" button it replaced, and
                  the pair ran off the right edge at 375px. */}
              <div className="w-full md:w-auto md:ml-auto flex flex-wrap gap-2 items-end">
                <BrochureGate
                  developmentName={development.name}
                  developmentId={development.id}
                  brochureUrl={brochure?.url ?? null}
                  buttonLabel={sv("hero", "brochure_label")}
                />
                <InterestDialog
                  developmentName={development.name}
                  developmentId={development.id}
                  buttonLabel={sv("hero", "interest_label")}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sub-nav */}
      <div
        className="sticky top-0 z-[5] bg-bz-bg border-b border-bz-border px-4 md:px-12 flex items-center gap-7 h-14 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ borderBottom: "1px solid var(--bz-border)" }}
      >
        {navItems.map((item, i) => (
          <a
            key={item.key}
            href={`#${item.key}`}
            className={`shrink-0 text-[13px] py-4 -mb-px border-b-2 ${
              i === 0
                ? "text-bz-teal border-bz-teal font-medium"
                : "text-bz-muted border-transparent hover:text-bz-ink"
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>

      {/* Overview */}
      {content.order
        .filter((key) => key in nodes)
        .map((key) => (
          <React.Fragment key={key}>{nodes[key]}</React.Fragment>
        ))}

      {/* T2-D: floating advisor contact rail — same component used on
          property detail. Desktop sticky / mobile bottom-dock.
          T2-D cleanup: adds Email + Call-me-back to the action set. */}
      <AdvisorContactRail
        advisorName={leadAdvisor.display_name}
        advisorPhone={leadAdvisor.whatsapp ?? leadAdvisor.phone ?? null}
        advisorEmail={leadAdvisor.email ?? null}
        contextRef={development.name}
        kind="development"
      />
    </article>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div
        className="serif text-[28px]"
        style={{ letterSpacing: "-0.015em" }}
      >
        {value}
      </div>
      <div
        className="text-[12px] mt-1"
        style={{ color: "rgba(255,255,255,.62)" }}
      >
        {label}
      </div>
    </div>
  );
}

const FACT_LABELS: Record<string, string> = {
  architecture: "Architecture",
  landscape: "Landscape",
  total_area_ft2: "Total area",
  lagoon_area_ft2: "Lagoon area",
  density: "Density",
  rera_escrow: "RERA escrow",
  service_charge_estimate: "Service charge",
  tenure: "Tenure",
};

function factPairs(
  facts: Record<string, string | undefined>,
): [string, string][] {
  const out: [string, string][] = [];
  for (const [key, label] of Object.entries(FACT_LABELS)) {
    const v = facts[key];
    if (v) out.push([label, v]);
  }
  return out;
}
