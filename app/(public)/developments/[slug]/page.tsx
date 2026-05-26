import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Calendar, Download } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import { mediaPublicUrl } from "@/lib/media";
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
import { PaymentPlanCalculator } from "./_payment-plan";
import { UnitsTable } from "./_units-table";
import { LeadAdvisorBanner } from "./_components/lead-advisor-banner";
import { BrochureGate } from "./_components/brochure-gate";
import { DevelopmentFaq } from "./_components/development-faq";
import { DeveloperProjectsStrip } from "./_components/developer-projects-strip";
import { NearbyDevelopments } from "./_components/nearby-developments";
import { FeatureBlocks } from "./_components/feature-blocks";
import { MapEmbed } from "../../p/[slug]/_components/map-embed";
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

const SECTIONS = [
  "Overview",
  "Master plan",
  "Payment plan",
  "Units",
  "Floor plans",
  "Features",
  "Location",
  "Developer",
  "FAQ",
  "Advisor",
];

export default async function DevelopmentDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const development = await getPublishedDevelopmentBySlug(slug);
  if (!development) notFound();

  const [units, floorPlans, media, meta, siblingsByDeveloper, siblingsInArea] =
    await Promise.all([
      listDevelopmentUnits(development.id),
      listFloorPlans(development.id),
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

  // Sprint 5a: lead advisor lookup — pick seeded advisor whose areas
  // overlap with the development's area. Sprint 9 wires real assignment.
  const leadAdvisor =
    SEED_AGENTS.find((a) =>
      a.areas.includes(development.area?.slug ?? ""),
    ) ?? SEED_AGENTS[0];

  const heroUrl = development.hero
    ? mediaPublicUrl(development.hero.storage_key)
    : null;

  const renderMedia = media.filter(
    (m) => (m.role === "render" || m.role === "gallery") && m.media,
  );
  const masterplanMedia =
    media.find((m) => m.role === "masterplan")?.media ?? null;

  const availableUnits = units.filter((u) => u.status === "available");
  const calculatorUnits = availableUnits.map((u) => ({
    id: u.id,
    label: `${u.unit_type}${u.beds ? ` · ${u.beds}-bed` : ""}${u.built_up_ft2 ? ` · ${u.built_up_ft2.toLocaleString()} ft²` : ""}`,
    price_aed: u.price_aed ?? development.starting_price ?? 0,
  }));

  return (
    <article className="bg-bz-bg">
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
        <div className="relative h-full flex flex-col px-12 pt-12 pb-12">
          <div className="flex gap-2 flex-wrap">
            {development.tagline ? (
              <span className="inline-flex items-center h-[26px] px-2.5 rounded-full text-[11.5px] font-medium bg-bz-accent text-white">
                {development.tagline}
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
              className="serif text-[96px] font-normal mt-3"
              style={{ letterSpacing: "-0.03em", lineHeight: 0.96 }}
            >
              {development.name}
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
                <HeroStat
                  value={development.payment_plan.name.split(" ")[0]}
                  label={`Payment plan · ${development.payment_plan.name}`}
                />
              ) : null}
              <div className="ml-auto flex gap-2 items-end">
                <BrochureGate developmentName={development.name} />
                <Button className="bg-white text-bz-ink hover:bg-white/90">
                  <Calendar size={14} strokeWidth={1.6} />
                  Book a viewing
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sub-nav */}
      <div
        className="sticky top-0 z-[5] bg-bz-bg border-b border-bz-border px-12 flex items-center gap-7 h-14"
        style={{ borderBottom: "1px solid var(--bz-border)" }}
      >
        {SECTIONS.map((s, i) => (
          <a
            key={s}
            href={`#${s.toLowerCase().replace(/\s+/g, "-")}`}
            className={`text-[13px] py-4 -mb-px border-b-2 ${
              i === 0
                ? "text-bz-ink border-bz-ink font-medium"
                : "text-bz-muted border-transparent hover:text-bz-ink"
            }`}
          >
            {s}
          </a>
        ))}
      </div>

      {/* Overview */}
      <section
        id="overview"
        className="px-12 py-16 grid grid-cols-2 gap-16 scroll-mt-16"
      >
        <div>
          <Eyebrow>Overview</Eyebrow>
          <h2
            className="serif text-[44px] mt-3 leading-[1.1]"
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
        <div className="grid grid-cols-2 gap-3 self-start">
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

      {/* Master plan */}
      <section id="master-plan" className="px-12 pb-16 scroll-mt-16">
        <Eyebrow>Master plan</Eyebrow>
        <h2
          className="serif text-[36px] mt-2"
          style={{ letterSpacing: "-0.02em" }}
        >
          The site
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

      {/* Payment plan */}
      {development.payment_plan ? (
        <section
          id="payment-plan"
          className="px-12 py-16 bg-bz-surface-2 scroll-mt-16"
        >
          <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
            <div>
              <Eyebrow>Payment plan · {development.payment_plan.name}</Eyebrow>
              <h2
                className="serif text-[40px] mt-2"
                style={{ letterSpacing: "-0.02em" }}
              >
                Cash flow timeline
              </h2>
            </div>
            <Button variant="outline" size="sm">
              <Download size={14} strokeWidth={1.6} />
              Custom plan as PDF
            </Button>
          </div>
          <PaymentPlanCalculator
            plan={development.payment_plan}
            units={calculatorUnits}
          />
        </section>
      ) : null}

      {/* Units */}
      {units.length > 0 ? (
        <section id="units" className="px-12 py-16 scroll-mt-16">
          <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
            <div>
              <Eyebrow>
                Available units · {availableUnits.length} of{" "}
                {development.total_units ?? units.length} remaining
              </Eyebrow>
              <h2
                className="serif text-[40px] mt-2"
                style={{ letterSpacing: "-0.02em" }}
              >
                What&apos;s left
              </h2>
            </div>
          </div>
          <UnitsTable units={units} />
        </section>
      ) : null}

      {/* Floor plans */}
      {floorPlans.length > 0 ? (
        <section
          id="floor-plans"
          className="px-12 pb-16 scroll-mt-16"
        >
          <Eyebrow>Floor plans</Eyebrow>
          <h2
            className="serif text-[36px] mt-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            How the units lay out
          </h2>
          <div className="grid grid-cols-3 gap-5 mt-6">
            {floorPlans.map((fp) => (
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
                    <div className="text-[11.5px] text-bz-muted">
                      {fp.area_ft2 ? `${fp.area_ft2.toLocaleString()} ft²` : "—"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Renders */}
      {renderMedia.length > 0 ? (
        <section className="px-12 pb-16">
          <Eyebrow>The vision</Eyebrow>
          <h2
            className="serif text-[36px] mt-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            Renders &amp; inspiration
          </h2>
          <div
            className="grid mt-6 gap-3"
            style={{
              gridTemplateColumns: "2fr 1fr 1fr",
              gridTemplateRows: "320px 320px",
            }}
          >
            {renderMedia.slice(0, 5).map((m, i) => (
              <div
                key={`${m.media?.storage_key}-${i}`}
                className={`relative rounded-lg overflow-hidden ${
                  i === 0 ? "row-span-2" : ""
                }`}
              >
                {m.media ? (
                  <Image
                    src={mediaPublicUrl(m.media.storage_key)}
                    alt={m.media.alt_text ?? `${development.name} render ${i + 1}`}
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
      ) : null}

      {/* Features (T1-C) */}
      <section id="features" className="scroll-mt-16">
        <FeatureBlocks
          developmentName={development.name}
          developmentSlug={development.slug}
          blocks={meta?.feature_blocks}
          amenitiesFallback={development.amenities}
        />
      </section>

      {/* Location */}
      <section id="location" className="px-12 pb-16 scroll-mt-16">
        <Eyebrow>Location</Eyebrow>
        <h2
          className="serif text-[32px] mt-2 leading-tight"
          style={{ letterSpacing: "-0.018em" }}
        >
          Where {development.name} sits.
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

      {/* Nearby developments (T1-C) */}
      <NearbyDevelopments
        areaName={development.area?.name ?? "this area"}
        nearby={siblingsInArea}
      />

      {/* Developer */}
      {development.developer_profile ? (
        <section id="developer" className="px-12 pb-16 scroll-mt-16">
          <Eyebrow>Developer</Eyebrow>
          <div className="mt-3 rounded-xl border border-bz-border bg-bz-surface p-9 grid grid-cols-[1fr_2fr] gap-12 items-center">
            <div>
              <div
                className="serif text-[48px] leading-tight"
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
      ) : null}

      {/* Other projects by this developer (T1-C) */}
      {development.developer?.name ? (
        <DeveloperProjectsStrip
          developerName={development.developer.name}
          siblings={siblingsByDeveloper}
        />
      ) : null}

      {/* FAQ (T1-C) — JSON-LD FAQPage schema for SEO */}
      <DevelopmentFaq development={development} curated={meta?.faq} />

      {/* Lead advisor banner */}
      <LeadAdvisorBanner
        agent={leadAdvisor}
        developmentName={development.name}
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
