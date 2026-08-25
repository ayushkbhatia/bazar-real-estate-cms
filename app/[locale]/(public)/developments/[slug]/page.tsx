import { getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/locales";
import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getForms } from "@/lib/queries/forms";
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
import { resolveHeroImage } from "./_hero-image";
import {
  developmentUrl,
  getPublishedDevelopmentBySlug,
  listDevelopmentMedia,
  listDevelopmentUnits,
  listFloorPlans,
} from "@/lib/queries/developments";
import { quarterLabel } from "@/lib/schemas/development";
import { handoverQuarter, quarterArgs } from "@/lib/developments/handover";
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
import { RendersGallery, type RenderTile } from "./_components/renders-gallery";
import { UnitFloorPlans } from "./_components/unit-floor-plans";
import {
  listUnitTypesForPage,
  placeholderUnitTypes,
} from "@/lib/queries/development-unit-plans";
import { MapEmbed } from "../../p/[slug]/_components/map-embed";
import { FloatingCtaTarget } from "../../_components/floating-cta-context";
import { AreaText, PriceText } from "../../_components/area-text";
import {
  getDevelopmentMeta,
  listOtherDevelopmentsByDeveloper,
  listOtherDevelopmentsInArea,
} from "@/lib/queries/development-extras";
import { SEED_AGENTS } from "@/lib/seeds/agents";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";

export const revalidate = 60;

/**
 * Prerender every published development. Without `generateStaticParams` the
 * route is `ƒ (Dynamic)` and Vercel serves it `no-store`, so `revalidate` above
 * never applies and each project page is a cold render per visit.
 * `dynamicParams` stays true, so a project published after the deploy still
 * resolves and is cached on first request.
 *
 * `/off-plan/[slug]` re-exports this alongside the page itself — both URLs
 * surface the same record, so both warm the same way.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("developments")
      .select("slug")
      .not("published_at", "is", null)
      .limit(1000);
    return (data ?? []).map((d) => ({ slug: d.slug }));
  } catch (err) {
    console.error("[developments/[slug]] generateStaticParams failed", err);
    return [];
  }
}

type PageProps = { params: Promise<{ slug: string; locale: Locale }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const d = await getPublishedDevelopmentBySlug(slug);
  if (!d) return { title: "Development not found" };

  // CMS first, then the derivations this page has always used. The fallbacks
  // are unchanged, so a project nobody has given a search appearance to
  // publishes exactly what it published before. Already folded to the request
  // locale by the query — see DevelopmentDetail.seo.
  const { meta_title, meta_description } = d.seo;

  const description =
    meta_description ??
    d.description ??
    `${d.name} by ${d.developer?.name ?? "Bazar"} — handover ${quarterLabel(d.handover_date)}`;

  const canonical = developmentUrl(d);
  const ogImage = d.hero
    ? [{ url: mediaPublicUrl(d.hero.storage_key), alt: d.name }]
    : undefined;

  return {
    // Absolute when authored, so what the editor typed is what ships — the
    // CMS preview shows it untemplated and the two have to agree.
    title: meta_title
      ? { absolute: meta_title }
      : `${d.name} · ${d.developer?.name ?? "Off-plan"}`,
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

/**
 * Scroll offset for everything the sub-nav jumps to.
 *
 * Two sticky bars end up above a jumped-to section, so the anchor has to
 * clear both: the public header (`--bz-header-h`, 72px) plus this page's own
 * sub-nav (`h-14`, 56px) = 128px. The old `scroll-mt-16` was 64px — less
 * than the header alone, so every jump put the heading it aimed at behind
 * the chrome, and it had been that way since before the header settled at
 * 72px.
 *
 * A const rather than the class written out nine times: the sub-nav's height
 * and this offset have to move together, and Tailwind still sees the literal
 * (it scans source text for candidate strings, not JSX attributes).
 *
 * Two of the eleven anchored sections are rendered by files this does not
 * reach — `payment-plan` from `_payment-plan.tsx`, `faq` from
 * `_components/development-faq.tsx` — and both still carry `scroll-mt-16`.
 * They are the only jumps on this page that still land short.
 */
const ANCHOR_SCROLL_MT = "scroll-mt-[calc(var(--bz-header-h)+3.5rem)]";

export default async function DevelopmentDetailPage({ params }: PageProps) {
  /*
   * Locale from `params`, never ambient. `getTranslations("development")` on
   * its own reads `getLocale()`, which falls through to `headers()` unless
   * setRequestLocale ran in the same pass — that is what took /p/[slug] off
   * prerendering in #373. This route carries `revalidate: 60`, so the same
   * mistake here would be more expensive, not less.
   */
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "development" });
  // `t` is already this page's own namespace; `tp` is the shared
  // `pages` bag for the strings W6 extracted out of the JSX.
  const tp = await getTranslations({ locale, namespace: "pages.development" });
  const tc = await getTranslations({ locale, namespace: "development.card" });
  const { slug } = await params;
  const development = await getPublishedDevelopmentBySlug(slug);
  if (!development) notFound();
  const handover = handoverQuarter(development.handover_date);

  // The two hero lead forms. Fields, copy and button come from /admin/forms.
  const leadForms = await getForms([
    "development_interest",
    "development_brochure",
  ]);

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
      SEED_AGENTS.find((a) => a.areas.includes(development.area?.slug ?? "")) ??
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

  // Brochure PDF picked in the sub-page editor. `attachImageUrls` has already
  // resolved the media_id into a public URL — a file field stores the same
  // shape as an image field precisely so that works.
  const heroValues = content.section("hero")?.values ?? {};
  const brochure = img(heroValues, "brochure");

  // The hero band prefers its own wide crop, uploaded in the Hero section, and
  // falls back to the record's cover image — see _hero-image.ts.
  const hero = resolveHeroImage({
    banner: img(heroValues, "image"),
    coverUrl: development.hero
      ? mediaPublicUrl(development.hero.storage_key)
      : null,
    coverAlt: development.hero?.alt_text ?? null,
    name: development.name,
  });

  // Two galleries curated in the sub-page editor — interiors and exteriors —
  // rendered side by side in one section. Either can be left empty; the half
  // that has imagery then spans the width.
  const curatedRenders = (key: string): RenderTile[] =>
    list<Record<string, unknown>>(content.section("renders")?.values ?? {}, key)
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
      // A trashed asset resolves to a null url; drop it rather than draw a hole.
      .filter((i): i is RenderTile => i.url !== null);

  const renderMedia = media.filter(
    (m) => (m.role === "render" || m.role === "gallery") && m.media,
  );

  const interiorTiles = curatedRenders("interior_images");
  // The record's own media has no interior/exterior split — nothing in the CMS
  // writes `development_media` — so it stands in for the exteriors, which is
  // what those images have always been.
  const curatedExterior = curatedRenders("exterior_images");
  const exteriorTiles: RenderTile[] =
    curatedExterior.length > 0
      ? curatedExterior
      : renderMedia.flatMap((m, i) =>
          m.media
            ? [
                {
                  url: mediaPublicUrl(m.media.storage_key),
                  alt:
                    m.media.alt_text ?? `${development.name} render ${i + 1}`,
                  caption: null,
                },
              ]
            : [],
        );
  // From the `masterplan_id` column, which is where the CMS's Page images card
  // saves the site plan. It used to be looked up in `development_media` under
  // the `masterplan` role — a row nothing creates, so the upload never showed.
  const masterplanMedia = development.masterplan;

  const legacyFloorPlans = floorPlans.filter((fp) => fp.unit_type_id === null);

  // A project with no unit-type records still gets the section, built from the
  // bedroom range it publishes. Migration 0081 seeds real, editable rows for
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
  // Raw fields, not a finished label: the dropdown text carries an area unit
  // and a price, and only the client knows which the visitor wants.
  const calculatorUnits: CalculatorUnit[] =
    availableUnits.length > 0
      ? availableUnits.map((u) => ({
          id: u.id,
          price_aed: u.price_aed ?? development.starting_price ?? 0,
          unitType: u.unit_type,
          beds: u.beds,
          builtUpFt2: u.built_up_ft2,
          isStartingPrice: false,
        }))
      : development.starting_price
        ? [
            {
              id: "starting-price",
              price_aed: development.starting_price,
              unitType: null,
              beds: null,
              builtUpFt2: null,
              isStartingPrice: true,
            },
          ]
        : [];

  const overviewBody = sv("overview", "intro") ?? development.vision;

  const nodes: Record<string, React.ReactNode> = {
    overview: (
      <section
        id="overview"
        className={`px-4 md:px-12 py-16 grid grid-cols-1 md:grid-cols-2 gap-16 ${ANCHOR_SCROLL_MT}`}
      >
        <div>
          <Eyebrow>{sv("overview", "eyebrow") ?? "Overview"}</Eyebrow>
          <h2
            className="serif text-[30px] md:text-[44px] mt-3 leading-[1.1]"
            style={{ letterSpacing: "-0.025em" }}
          >
            {sv("overview", "heading") ??
              (development.area?.name
                ? `A community within ${development.area.name}.`
                : "About this development")}
          </h2>
          {/* The built-in copy here is the project's own vision statement, so
              an override stands in for it rather than stacking on top. */}
          {overviewBody ? (
            <div className="mt-6 space-y-4">
              {overviewBody.split("\n\n").map((para, i) => (
                <p key={i} className="text-[16px] text-bz-ink-2 leading-[1.7]">
                  {para}
                </p>
              ))}
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 self-start">
          {factPairs(development.facts, (k) => t(`facts.${k}`)).map(
            ([l, v]) => (
              <div
                key={l}
                className="p-[18px] bg-bz-surface-2 rounded-lg border border-bz-border"
              >
                <div className="eyebrow">{l}</div>
                <div className="text-[16px] font-medium mt-1.5">{v}</div>
              </div>
            ),
          )}
        </div>
      </section>
    ),
    "master-plan": (
      <section id="master-plan" className={`px-4 md:px-12 pb-16 ${ANCHOR_SCROLL_MT}`}>
        <Eyebrow>{sv("master-plan", "eyebrow") ?? "Master plan"}</Eyebrow>
        <h2
          className="serif text-[36px] mt-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          {sv("master-plan", "heading") ?? "The site"}
        </h2>
        {sv("master-plan", "intro") ? (
          <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
            {sv("master-plan", "intro")}
          </p>
        ) : null}
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
              <div className="absolute start-11 top-1.5 whitespace-nowrap bg-white/95 px-2.5 py-1 rounded text-[11px] font-medium text-bz-ink">
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
        eyebrow={sv("payment-plan", "eyebrow")}
        heading={sv("payment-plan", "heading") ?? "Cash flow timeline"}
        intro={sv("payment-plan", "intro")}
        developmentName={development.name}
        units={calculatorUnits}
      />
    ) : null,
    units:
      units.length > 0 ? (
        <section id="units" className={`px-4 md:px-12 py-16 ${ANCHOR_SCROLL_MT}`}>
          <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
            <div>
              <Eyebrow>
                {sv("units", "eyebrow") ??
                  `Available units · ${availableUnits.length} of ${development.total_units ?? units.length} remaining`}
              </Eyebrow>
              <h2
                className="serif text-[28px] md:text-[40px] mt-2"
                style={{ letterSpacing: "-0.02em" }}
              >
                {sv("units", "heading") ?? "What's left"}
              </h2>
              {sv("units", "intro") ? (
                <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
                  {sv("units", "intro")}
                </p>
              ) : null}
            </div>
          </div>
          <UnitsTable units={units} />
        </section>
      ) : null,
    // Only the plans nobody has filed under a unit type. The rest render in
    // "Units & floor plans" below the features, and one drawing appearing
    // twice on the same page reads as a bug rather than as emphasis.
    "floor-plans":
      legacyFloorPlans.length > 0 ? (
        <section id="floor-plans" className={`px-4 md:px-12 pb-16 ${ANCHOR_SCROLL_MT}`}>
          <Eyebrow>{sv("floor-plans", "eyebrow") ?? "Floor plans"}</Eyebrow>
          <h2
            className="serif text-[36px] mt-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            {sv("floor-plans", "heading") ?? "How the units lay out"}
          </h2>
          {sv("floor-plans", "intro") ? (
            <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
              {sv("floor-plans", "intro")}
            </p>
          ) : null}
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
                      label={fp.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
                      className="aspect-square rounded"
                    />
                  )}
                  <div className="flex justify-between items-center mt-3">
                    <div>
                      <div className="text-[14px] font-medium">{fp.label}</div>
                      <div className="text-[11.5px] text-bz-ink-2">
                        <AreaText ft2={fp.area_ft2} />
                      </div>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      ) : null,
    renders:
      interiorTiles.length + exteriorTiles.length > 0 ? (
        <section id="renders" className={ANCHOR_SCROLL_MT}>
          <RendersGallery
            eyebrow={sv("renders", "eyebrow")}
            heading={sv("renders", "heading")}
            intro={sv("renders", "intro")}
            interiorHeading={sv("renders", "interior_heading")}
            exteriorHeading={sv("renders", "exterior_heading")}
            interior={interiorTiles}
            exterior={exteriorTiles}
          />
        </section>
      ) : null,
    features: (
      <section id="features" className={ANCHOR_SCROLL_MT}>
        <FeatureBlocks
          developmentName={development.name}
          developmentSlug={development.slug}
          blocks={featureBlocks}
          amenitiesFallback={development.amenities}
          eyebrow={sv("features", "eyebrow")}
          heading={sv("features", "heading")}
          intro={sv("features", "intro")}
        />
      </section>
    ),
    // Unit-type buttons and their layouts. Sits between the named features and
    // the map by default; the page editor can move or hide it like any other.
    "unit-plans": (
      <section
        id="unit-plans"
        className={`${ANCHOR_SCROLL_MT} border-t border-bz-border`}
      >
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
    location: (
      <section id="location" className={`px-4 md:px-12 pb-16 ${ANCHOR_SCROLL_MT}`}>
        <Eyebrow>{sv("location", "eyebrow") ?? "Location"}</Eyebrow>
        <h2
          className="serif text-[32px] mt-2 leading-tight"
          style={{ letterSpacing: "-0.018em" }}
        >
          {sv("location", "heading") ?? `Where ${development.name} sits.`}
        </h2>
        <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          {sv("location", "intro") ??
            "Master-plan position + commute times to key Abu Dhabi destinations."}
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
    nearby: (
      <NearbyDevelopments
        areaName={development.area?.name ?? "this area"}
        nearby={neighbours}
        eyebrow={sv("nearby", "eyebrow")}
        heading={sv("nearby", "heading")}
        intro={sv("nearby", "intro")}
      />
    ),
    developer: development.developer_profile ? (
      <section id="developer" className={`px-4 md:px-12 pb-16 ${ANCHOR_SCROLL_MT}`}>
        <Eyebrow>{sv("developer", "eyebrow") ?? "Developer"}</Eyebrow>
        {/* The card below is built from the developer's own record, so an
              override introduces a section heading above it rather than
              overwriting the partner's name and profile copy. */}
        {sv("developer", "heading") ? (
          <h2
            className="serif text-[32px] mt-2 leading-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            {sv("developer", "heading")}
          </h2>
        ) : null}
        {sv("developer", "intro") ? (
          <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
            {sv("developer", "intro")}
          </p>
        ) : null}
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
        eyebrow={sv("other-projects", "eyebrow")}
        heading={sv("other-projects", "heading")}
        intro={sv("other-projects", "intro")}
      />
    ) : null,
    // DevelopmentFaq carries its own `id="faq"` anchor.
    faq: (
      <DevelopmentFaq
        development={development}
        curated={meta?.faq}
        eyebrow={sv("faq", "eyebrow")}
        heading={sv("faq", "heading")}
        intro={sv("faq", "intro")}
      />
    ),
    advisor: (
      <LeadAdvisorBanner
        agent={leadAdvisor}
        developmentName={development.name}
        eyebrow={sv("advisor", "eyebrow")}
        heading={sv("advisor", "heading")}
        intro={sv("advisor", "intro")}
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
        {hero.url ? (
          <Image
            src={hero.url}
            alt={hero.alt}
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
              {tc("offPlan")}
            </span>
            {handover ? (
              <span className="inline-flex items-center h-[26px] px-2.5 rounded-full text-[11.5px] font-medium bg-white/15 text-white backdrop-blur-sm">
                {tc("handover", quarterArgs(handover))}
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
                value={<PriceText aed={development.starting_price} />}
                label={tp("startingPrice")}
              />
              <HeroStat
                value={development.bedrooms_text ?? "—"}
                label={tp("bedrooms")}
              />
              <HeroStat
                value={
                  development.total_units != null
                    ? development.total_units.toString()
                    : "—"
                }
                label={tp("totalUnits")}
              />
              <HeroStat
                value={
                  handover ? tc("quarter", quarterArgs(handover)) : "—"
                }
                label={tp("handover")}
              />
              {development.payment_plan ? (
                // "60/40 Payment Plan" → value "60/40", label "Payment plan".
                // The label used to repeat the whole plan name after the
                // value's first word, which read as a stutter.
                <HeroStat
                  value={development.payment_plan.name.split(" ")[0]}
                  label={tp("paymentPlan")}
                />
              ) : null}
              {/* Wraps on narrow screens — "Register your interest" is a wider
                  label than the dead "Book a viewing" button it replaced, and
                  the pair ran off the right edge at 375px. */}
              <div className="w-full md:w-auto md:ms-auto flex flex-wrap gap-2 items-end">
                {leadForms.development_brochure!.enabled ? (
                  <BrochureGate
                    form={leadForms.development_brochure!}
                    developmentName={development.name}
                    developmentId={development.id}
                    brochureUrl={brochure?.url ?? null}
                    buttonLabel={sv("hero", "brochure_label")}
                  />
                ) : null}
                {leadForms.development_interest!.enabled ? (
                  <InterestDialog
                    form={leadForms.development_interest!}
                    developmentName={development.name}
                    developmentId={development.id}
                    buttonLabel={sv("hero", "interest_label")}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/*
        Sub-nav — docked under the public header, not at `top-0`.

        `public-mega-nav.tsx` is `sticky top-0 z-40 h-[72px]` at every
        breakpoint, so this bar's old `top-0 z-[5]` put it in the same 72px
        band and it lost the overlap on z-index: on a phone it was pinned
        permanently out of sight, taking the page's whole section index with
        it. Same defect, same cause, as the search filter bar.

        Not `md:`-gated, because the header is not, and nothing between this
        bar and the viewport absorbs the offset — the public layout is
        `<body flex flex-col>` → `<main flex-1>`, all plain blocks, so the
        sticky containing block is the document scroller at every width.

        `h-14` here is the other half of `ANCHOR_SCROLL_MT`: change one and
        the anchors land wrong.
      */}
      <div
        /* `pe-[var(--bz-locale-pill-gutter)]` keeps the inline end clear of
           the layout's floating `LocaleToggle`, which is `fixed top-[84px]
           end-4 z-[25]` and so hangs over this row's 72-128 band. z-[5] means
           the pill wins the overlap; without the gutter it would sit on the
           end of a horizontally scrollable list of anchors, which is the one
           part of a scroll row a thumb reaches for. Padding-end is inside the
           scrollable overflow, so the last link still scrolls clear of it. */
        className="sticky top-[var(--bz-header-h)] z-[5] bg-bz-bg border-b border-bz-border px-4 md:px-12 pe-[var(--bz-locale-pill-gutter)] flex items-center gap-7 h-14 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

      {/* The floating CTA rail is mounted once in the public layout. This
          publishes the project's lead advisor to it, so the buttons route to
          that person and the draft message names the project. Renders nothing. */}
      <FloatingCtaTarget
        advisorName={leadAdvisor.display_name}
        advisorPhone={leadAdvisor.whatsapp ?? leadAdvisor.phone ?? null}
        advisorEmail={leadAdvisor.email ?? null}
        /* The lead advisor here falls back to a seeded agent when no staff
           member is assigned, and a seed has no `staff` row to point at —
           so the click is logged against the project with no advisor
           rather than against an id that would fail the foreign key. */
        advisorId={
          "user_id" in leadAdvisor && typeof leadAdvisor.user_id === "string"
            ? leadAdvisor.user_id
            : null
        }
        developmentId={development.id}
        contextRef={development.name}
        tokens={{
          development_name: development.name,
          developer_name: development.developer?.name ?? null,
          handover: quarterLabel(development.handover_date),
          area_name: development.area?.name ?? null,
          advisor_title: leadAdvisor.title ?? null,
          advisor_brn: leadAdvisor.brn ?? null,
        }}
        kind="development"
      />
    </article>
  );
}

function HeroStat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="serif text-[28px]" style={{ letterSpacing: "-0.015em" }}>
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

/**
 * Which facts to show, in order. The labels come from the catalogue; this list
 * is the ordering and the whitelist — a key absent from it is never rendered,
 * which is what stops an editor's stray `facts` entry appearing unlabelled.
 */
const FACT_KEYS = [
  "architecture",
  "landscape",
  "total_area_ft2",
  "lagoon_area_ft2",
  "density",
  "rera_escrow",
  "service_charge_estimate",
  "tenure",
] as const;

function factPairs(
  facts: Record<string, string | undefined>,
  label: (key: string) => string,
): [string, string][] {
  const out: [string, string][] = [];
  for (const key of FACT_KEYS) {
    const v = facts[key];
    if (v) out.push([label(key), v]);
  }
  return out;
}
