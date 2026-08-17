import { getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/locales";
import * as React from "react";
import { getForm } from "@/lib/queries/forms";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { listSeedAgentsByArea } from "@/lib/seeds/agents";
import { withAgentPhotos } from "@/lib/queries/agent-photos";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";
import {
  getAreaProfile,
  listAreaDirectory,
  type AreaProfile,
} from "@/lib/queries/area-profile";
import {
  listAreaPins,
  listAreaListingDots,
  type AreaPin,
} from "@/lib/queries/area-map";
import { getAreaInventory } from "@/lib/queries/area-inventory";
import { developmentUrl } from "@/lib/queries/developments";
import { communityKey } from "@/lib/queries/community-key";
import { getAreaHeroImage, getAreaPageContent } from "@/lib/queries/subpages";
import { str, list, type SectionValues } from "@/lib/master-pages";
import { placeJsonLd, breadcrumbListJsonLd } from "@/lib/jsonld";
import { env } from "@/lib/env";
import { LifestyleDossier } from "./_components/lifestyle-dossier";
import {
  AreaCommunities,
  AreaFinalCta,
  AreaLandmarks,
  AreaLeadBand,
  AreaNearby,
  AreaStatsBand,
  AreaWhy,
  type BandItem,
  type BandStat,
} from "./_components/area-bands";
import { AreaFaq, type AreaFaqEntry } from "./_components/area-faq";
import { AreaLeadForm } from "./_components/area-lead-form";
import { AreaListingsBand } from "./_components/area-listings-band";
import {
  AreaUnitText,
  PricePerAreaValueText,
} from "../../_components/area-text";
import { DevelopmentCard } from "../../_components/marketing/development-card";
import { AreaMapDetail } from "../../_components/area-map/area-map-detail";
import { AreaReportsRail } from "../../_components/market-context-link";
import { ValuationLeadGate } from "../../tools/valuation/_components/lead-gate";

/**
 * An area the CMS created has a centroid but no inventory yet, so
 * `listAreaPins` (which only pins areas with published listings) leaves it
 * off the map. Synthesise its pin so the guide's map band still draws.
 */
function withOwnPin(pins: AreaPin[], profile: AreaProfile): AreaPin[] {
  if (!profile.geo) return pins;
  if (pins.some((p) => p.slug === profile.slug)) return pins;
  return [
    ...pins,
    {
      id: profile.id ?? `area:${profile.slug}`,
      slug: profile.slug,
      name: profile.name,
      emirate: "abu-dhabi",
      tag: profile.vibe,
      lng: profile.geo.lng,
      lat: profile.geo.lat,
      count: 0,
      medianPerFt2: profile.stats?.medianAptPerFt2 ?? null,
      yoyChange: profile.stats?.yoyChangePct ?? null,
    },
  ];
}

/** A list row is live unless it was explicitly switched off, and needs a name. */
function liveItems(values: SectionValues, key = "items"): BandItem[] {
  return list<BandItem>(values, key).filter(
    (i) => i.enabled !== false && (i.name ?? "").trim() !== "",
  );
}

function liveStats(values: SectionValues): BandStat[] {
  return list<{ enabled?: boolean; value?: string; label?: string }>(
    values,
    "stats",
  )
    .filter((s) => s.enabled !== false && (s.value ?? "").trim() !== "")
    .map((s) => ({ value: s.value!, label: s.label ?? "" }));
}

function liveFaq(values: SectionValues): AreaFaqEntry[] {
  return list<{ q?: string; a?: string }>(values, "items")
    .filter((e) => (e.q ?? "").trim() !== "" && (e.a ?? "").trim() !== "")
    .map((e) => ({ q: e.q!, a: e.a! }));
}

/**
 * The guide is prerendered per area, and its content comes from the CMS — so
 * without this it is built once and never rebuilt. Saving in the admin still
 * worked, because the server action calls `revalidatePath` on the running
 * deployment; anything that writes the section document out of band (a data
 * migration seeding the guides, an editor working straight against Postgres)
 * had no way to reach the page at all short of a redeploy.
 *
 * 300s matches /areas, /developers/[slug] and the marketing master pages.
 * This route was the only CMS-driven page missing the setting.
 */
export const revalidate = 300;

export async function generateStaticParams() {
  const entries = await listAreasWithCounts();
  return entries.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getAreaProfile(slug);
  if (!profile) return { title: "Area not found" };
  return {
    title: profile.metaTitle ?? `${profile.name} — Bazar community guide`,
    description: profile.metaDescription ?? profile.intro ?? undefined,
    alternates: { canonical: `/areas/${profile.slug}` },
  };
}

export default async function CommunityProfilePage({
  params,
}: {
  params: Promise<{ slug: string; locale: Locale }>;
}) {
  const { slug, locale } = await params;
  // Locale from params, never ambient — see #373 and #374. This route carries
  // `revalidate: 300`.
  const t = await getTranslations({ locale, namespace: "area" });
  // `t` is the area namespace; `tp` is the shared `pages` bag W6 extracts into.
  const tp = await getTranslations({ locale, namespace: "pages.area" });
  // The catalogue row is what makes an area real: any area in `areas` gets a
  // page, whether or not it has a seed guide or a published `area_guides`
  // overlay. Only a slug that matches nothing at all 404s.
  const profile = await getAreaProfile(slug);
  if (!profile) notFound();

  const advisors = await withAgentPhotos(listSeedAgentsByArea(profile.slug));
  // Forms Manager copy for the two lead surfaces on this page (#309).
  const [gateForm, leadForm] = await Promise.all([
    getForm("valuation_report_gate"),
    getForm("areas_guide_consultation"),
  ]);

  const [content, heroImage, rawPins, dots, inventory, directory] =
    await Promise.all([
      getAreaPageContent({ name: profile.name, slug: profile.slug }),
      getAreaHeroImage(profile.slug),
      listAreaPins(),
      listAreaListingDots({ areaSlug: slug }),
      // Sale, rental and project stock across this area *and its
      // sub-communities* — a villa filed under Saadiyat Lagoons belongs on the
      // Saadiyat Island guide. Six of each.
      getAreaInventory(slug, 6),
      listAreaDirectory(),
    ]);
  const pins = withOwnPin(rawPins, profile);
  const focusPin = pins.find((p) => p.slug === profile.slug) ?? null;
  const saleRows = inventory.forSale;
  const rentRows = inventory.forRent;

  // Related areas by slug — named from the live catalogue, falling back to
  // the pin set so a seed-only relation still resolves.
  const nameBySlug = new Map<string, string>([
    ...directory.map((d) => [d.slug, d.name] as const),
    ...directory.flatMap((d) =>
      d.children.map((c) => [c.slug, c.name] as const),
    ),
    ...pins.map((p) => [p.slug, p.name] as const),
  ]);
  const similar = profile.similarSlugs.flatMap((s) => {
    const name = nameBySlug.get(s);
    return name && s !== profile.slug ? [{ slug: s, name }] : [];
  });

  const siteBase = (
    env.NEXT_PUBLIC_SITE_URL ?? "https://www.bazarrealestate.ae"
  ).replace(/\/+$/, "");
  const placeLd = placeJsonLd({
    slug: profile.slug,
    name: profile.name,
    intro_md: profile.intro || null,
  });
  const breadcrumbsLd = breadcrumbListJsonLd([
    { name: "Home", url: siteBase },
    { name: "Areas", url: `${siteBase}/areas` },
    { name: profile.name, url: `${siteBase}/areas/${profile.slug}` },
  ]);

  // Copy overrides from /admin/pages/sub/area/<slug>. Blank fields fall
  // through to the guide copy that ships with the area.
  const values = (key: string): SectionValues =>
    content.section(key)?.values ?? {};
  const sv = (key: string, field: string) => str(values(key), field);

  // The communities band leads with project cards, so the editorial list drops
  // any entry a card already covers and points the rest at their project page
  // where one exists but didn't make the six shown.
  const shownProjectKeys = new Set(
    inventory.developments.slice(0, 6).map((d) => communityKey(d.name)),
  );
  const projectByKey = new Map(
    inventory.developments.map((d) => [communityKey(d.name), d] as const),
  );
  const editorialCommunities = liveItems(values("communities")).flatMap(
    (item) => {
      const key = communityKey(item.name ?? "");
      if (shownProjectKeys.has(key)) return [];
      const project = projectByKey.get(key);
      return [
        project
          ? { ...item, href: item.href ?? developmentUrl(project) }
          : item,
      ];
    },
  );

  // An area can have projects on the books and no unit-level listings yet —
  // that is most of the catalogue today, and Hudayriyat is the case that
  // surfaced it: three published developments, zero `properties` rows. Saying
  // only "nothing for sale" there is both discouraging and untrue, so the
  // empty state hands the visitor the projects that do exist.
  const projectCount = inventory.developmentTotal;
  //
  // The link goes to the communities band on this page, not to
  // /off-plan/search: that route searches `properties` with mode = 'off_plan',
  // so for an area with no property rows it is empty by construction — the
  // exact dead end this copy exists to avoid. The project cards are already
  //higher up the page.
  const saleEmpty =
    projectCount > 0
      ? {
          body: t("empty.offPlanOnly", {
            area: profile.name,
            count: projectCount,
          }),
          href: "#communities",
          label: t("cta.seeProjects", { count: projectCount }),
        }
      : {
          body: t("empty.noSaleListings", { area: profile.name }),
          href: "/contact",
          label: t("cta.talkToAdvisor"),
        };

  const heroIntro = sv("hero", "intro") ?? profile.intro;
  const heroPosition = sv("hero", "position") ?? profile.position;
  const stats = profile.stats;
  const buyHref = `/buy/search?area=${profile.slug}`;
  const rentHref = `/rent/search?area=${profile.slug}`;

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <>
        {/* Hero */}
        <section className="px-4 md:px-12 pt-8 pb-12">
          <Eyebrow>
            {sv("hero", "eyebrow") ??
              (profile.vibe
                ? t("hero.guideWithVibe", { vibe: profile.vibe })
                : t("hero.guide"))}
          </Eyebrow>
          <h1
            className="serif text-[40px] md:text-[80px] mt-3 font-normal leading-[0.98] max-w-[14ch]"
            style={{ letterSpacing: "-0.03em" }}
          >
            {sv("hero", "heading") ?? profile.name}
          </h1>
          {heroIntro ? (
            <p className="mt-6 text-[17px] text-bz-ink-2 leading-relaxed max-w-[64ch]">
              {heroIntro}
            </p>
          ) : null}
          {heroPosition ? (
            <p className="mt-4 mono text-[12.5px] text-bz-muted">
              {heroPosition}
            </p>
          ) : null}
        </section>
      </>
    ),
    "hero-image": (
      <>
        {/* Hero image */}
        <section className="px-4 md:px-12 pb-14">
          {heroImage ? (
            <div className="relative w-full aspect-[21/9] overflow-hidden rounded-md">
              <Image
                src={heroImage.url}
                alt={heroImage.alt ?? profile.name}
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-cover"
              />
            </div>
          ) : (
            <PlaceholderImage
              label={profile.heroLabel}
              className="w-full aspect-[21/9] rounded-md"
            />
          )}
        </section>
      </>
    ),
    stats: (
      <>
        {/* Market statistics. The editorial figures typed into the CMS win;
          without them the band falls back to the medians on the guide
          record, and hides entirely when there is neither. */}
        {liveStats(values("stats")).length > 0 ? (
          <AreaStatsBand
            heading={
              sv("stats", "heading") ??
              `${profile.name} property market at a glance`
            }
            intro={sv("stats", "intro")}
            stats={liveStats(values("stats"))}
            footnote={str(values("stats"), "footnote")}
          />
        ) : stats ? (
          <section className="border-y border-bz-border bg-bz-surface">
            <div className="px-4 md:px-12 py-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                <Stat
                  label={
                    <>
                      {tp("medianApt")} <AreaUnitText />
                    </>
                  }
                  value={
                    stats.medianAptPerFt2 == null ? null : (
                      <PricePerAreaValueText
                        aedPerFt2={stats.medianAptPerFt2}
                      />
                    )
                  }
                />
                <Stat
                  label={
                    <>
                      {tp("medianVilla")} <AreaUnitText />
                    </>
                  }
                  value={
                    stats.medianVillaPerFt2 == null ? null : (
                      <PricePerAreaValueText
                        aedPerFt2={stats.medianVillaPerFt2}
                      />
                    )
                  }
                />
                <Stat
                  label={t("stats.avgDays")}
                  value={stats.avgDaysOnMarket?.toString() ?? null}
                />
                <Stat
                  label={t("stats.yoy")}
                  value={
                    stats.yoyChangePct !== null
                      ? `${stats.yoyChangePct > 0 ? "+" : ""}${stats.yoyChangePct}%`
                      : null
                  }
                  tone={
                    stats.yoyChangePct === null || stats.yoyChangePct === 0
                      ? undefined
                      : stats.yoyChangePct > 0
                        ? "up"
                        : "down"
                  }
                />
              </div>
            </div>
          </section>
        ) : null}
      </>
    ),
    map: (
      <>
        {/* Interactive map band — deep-linked to this area with its listing
          dots. Self-hides for areas with no coordinates on record. */}
        {focusPin ? (
          <section className="px-4 md:px-12 py-14">
            <Eyebrow>{t("bands.location")}</Eyebrow>
            <h2
              className="serif text-[28px] md:text-[34px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              {sv("map", "heading") ?? `Find ${profile.name} on the map.`}
            </h2>
            {sv("map", "intro") ? (
              <p className="mt-3 text-[15.5px] text-bz-ink-2 leading-relaxed max-w-[68ch]">
                {sv("map", "intro")}
              </p>
            ) : null}
            {sv("map", "detail") ? (
              <p className="mt-2 text-[15.5px] text-bz-ink-2 leading-relaxed max-w-[68ch]">
                {sv("map", "detail")}
              </p>
            ) : null}
            <div className="mt-7 relative h-[420px] md:h-[520px] overflow-hidden rounded-md border border-bz-border bg-bz-surface">
              <AreaMapDetail areas={pins} dots={dots} areaSlug={profile.slug} />
            </div>
          </section>
        ) : null}
      </>
    ),
    landmarks: (
      <AreaLandmarks
        heading={sv("landmarks", "heading") ?? t("bands.landmarks")}
        intro={sv("landmarks", "intro")}
        items={liveItems(values("landmarks"))}
        footnote={str(values("landmarks"), "footnote")}
      />
    ),
    communities: (
      <AreaCommunities
        heading={sv("communities", "heading") ?? `Explore ${profile.name}`}
        intro={sv("communities", "intro")}
        items={editorialCommunities}
        projects={inventory.developments.slice(0, 6).map((d) => (
          <DevelopmentCard key={d.id} d={d} />
        ))}
        projectsTotal={inventory.developmentTotal}
        viewAllHref="/off-plan"
        footnote={str(values("communities"), "footnote")}
      />
    ),
    listings: (
      <AreaListingsBand
        eyebrow={t("cta.forSale")}
        heading={
          sv("listings", "heading") ?? `Properties for sale in ${profile.name}`
        }
        intro={sv("listings", "intro")}
        rows={saleRows}
        ctaLabel={sv("listings", "cta_label") ?? t("cta.viewAllSale")}
        ctaHref={sv("listings", "cta_href") ?? buyHref}
        emptyBody={saleEmpty.body}
        emptyHref={saleEmpty.href}
        emptyLabel={saleEmpty.label}
      />
    ),
    rentals: (
      <AreaListingsBand
        eyebrow={t("cta.toRent")}
        heading={
          sv("rentals", "heading") ?? `Properties for rent in ${profile.name}`
        }
        intro={sv("rentals", "intro")}
        rows={rentRows}
        ctaLabel={sv("rentals", "cta_label") ?? t("cta.viewAllRent")}
        ctaHref={sv("rentals", "cta_href") ?? rentHref}
        emptyBody={
          sv("rentals", "empty_body") ??
          `Looking to rent in ${profile.name}? Speak with our team about current and upcoming availability.`
        }
        emptyHref="/contact"
        emptyLabel={t("cta.enquireRentals")}
        tone="surface"
      />
    ),
    nearby: (
      <AreaNearby
        heading={sv("nearby", "heading") ?? t("bands.connectedHeading")}
        intro={sv("nearby", "intro")}
        items={liveItems(values("nearby"))}
        footnote={str(values("nearby"), "footnote")}
      />
    ),
    why: (
      <AreaWhy
        heading={sv("why", "heading") ?? `Why choose ${profile.name}?`}
        intro={sv("why", "intro")}
        items={liveItems(values("why"))}
      />
    ),
    "lead-form": (
      <AreaLeadBand
        heading={
          sv("lead-form", "heading") ??
          `Looking for a property in ${profile.name}?`
        }
        intro={
          sv("lead-form", "intro") ??
          "Get a free property consultation and discover available opportunities that match your requirements."
        }
      >
        <AreaLeadForm
          form={leadForm}
          areaName={profile.name}
          submitLabel={sv("lead-form", "cta_label")}
        />
      </AreaLeadBand>
    ),
    faq: (
      <AreaFaq
        heading={
          sv("faq", "heading") ??
          `Frequently asked questions about ${profile.name}`
        }
        intro={sv("faq", "intro")}
        entries={liveFaq(values("faq"))}
      />
    ),
    "final-cta": (
      <AreaFinalCta
        heading={
          sv("final-cta", "heading") ?? `Find your property in ${profile.name}`
        }
        intro={
          sv("final-cta", "intro") ??
          "Explore opportunities to buy, rent or invest with trusted property guidance from Bazar Real Estate."
        }
        primary={{
          label: sv("final-cta", "cta_label") ?? t("cta.exploreProperties"),
          href: sv("final-cta", "cta_href") ?? buyHref,
        }}
        secondary={{
          label: sv("final-cta", "cta2_label") ?? t("cta.getConsultation"),
          href: sv("final-cta", "cta2_href") ?? "/contact",
        }}
      />
    ),
    schools: (
      <>
        {/* Schools + amenities — each column drops when it has nothing. */}
        {profile.schools.length > 0 || profile.amenities.length > 0 ? (
          <section className="px-4 md:px-12 py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              {profile.schools.length > 0 ? (
                <div>
                  <Eyebrow>{t("bands.schools")}</Eyebrow>
                  <ul className="mt-5 flex flex-col gap-3">
                    {profile.schools.map((s) => (
                      <li
                        key={s.name}
                        className="flex items-baseline justify-between gap-4 border-b border-bz-border pb-3"
                      >
                        <div>
                          <div className="text-[15px] text-bz-ink">
                            {s.name}
                          </div>
                          {s.curriculum || s.rating ? (
                            <div className="text-[12px] text-bz-ink-2">
                              {s.curriculum}
                              {s.rating ? (
                                <>
                                  {s.curriculum ? " · " : null}
                                  <span
                                    className={
                                      s.rating === "Outstanding"
                                        ? "text-bz-accent font-medium"
                                        : "text-bz-ink-2"
                                    }
                                  >
                                    ADEK / KHDA · {s.rating}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {s.distance_km !== null ? (
                          <div className="mono text-[12px] text-bz-ink-2">
                            {s.distance_km} km
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {profile.amenities.length > 0 ? (
                <div>
                  <Eyebrow>{t("bands.amenities")}</Eyebrow>
                  <ul className="mt-5 grid grid-cols-1 gap-2">
                    {profile.amenities.map((a) => (
                      <li key={a} className="text-[14px] text-bz-ink">
                        · {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </>
    ),
    reports: (
      <>
        {/* T1-A cleanup: cross-link rail into the area's quarterly market
          reports.  Closes the moat-orphan gap — visitors browsing the
          area can pivot directly into the data. */}
        <AreaReportsRail area_slug={profile.slug} area_name={profile.name} />
      </>
    ),
    valuation: (
      <>
        {/* T1-E cleanup: lead-gate surfaced on the area page — owners of
          property in this community are the highest-intent valuation
          lead source. */}
        <section className="px-4 md:px-12 py-12 border-t border-bz-border bg-bz-surface-2">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <Eyebrow>Own property in {profile.name}?</Eyebrow>
              <h2
                className="serif text-[28px] mt-2 leading-tight max-w-[36ch]"
                style={{ letterSpacing: "-0.018em" }}
              >
                {tp("valuationPrompt")}
              </h2>
              <p className="mt-3 text-[14px] text-bz-ink-2 max-w-[58ch]">
                Instant data-backed range from our model, then a senior advisor
                reviews and sends a refined valuation within 24 hours.
              </p>
            </div>
            {gateForm.enabled ? (
              <ValuationLeadGate
                form={gateForm}
                triggerLabel={`Value my ${profile.name} property`}
              />
            ) : null}
          </div>
        </section>
      </>
    ),
    lifestyle: (
      <>
        {/* T3-E: lifestyle dossier — commute chips, prose, dining picks.
          Seed-shaped, so it only draws for editorially-enriched areas. */}
        {profile.seed ? <LifestyleDossier area={profile.seed} /> : null}
      </>
    ),
    advisors: (
      <>
        {/* Advisors who cover this area */}
        {advisors.length > 0 ? (
          <section className="px-4 md:px-12 py-16">
            <Eyebrow>{t("bands.advisors")}</Eyebrow>
            <h2
              className="serif text-[32px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.015em" }}
            >
              Who to talk to about {profile.name}.
            </h2>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-8">
              {advisors.map((a) => (
                <Link
                  key={a.slug}
                  href={`/agents/${a.slug}`}
                  className="group block"
                >
                  {a.photo_url ? (
                    <div className="relative w-full aspect-[4/5] overflow-hidden rounded-md">
                      <Image
                        src={a.photo_url}
                        alt={a.display_name}
                        fill
                        sizes="(max-width: 768px) 50vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <PlaceholderImage
                      label={a.slug}
                      className="w-full aspect-[4/5] rounded-md"
                    />
                  )}
                  <div className="mt-3">
                    <div className="text-[15px] text-bz-ink group-hover:text-bz-accent transition-colors">
                      {a.display_name}
                    </div>
                    <div className="text-[12px] text-bz-muted mt-0.5">
                      {a.title}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </>
    ),
    similar: (
      <>
        {/* Similar areas */}
        {similar.length > 0 ? (
          <section className="border-t border-bz-border bg-bz-surface">
            <div className="px-4 md:px-12 py-12">
              <Eyebrow>{t("bands.similar")}</Eyebrow>
              <div className="mt-5 flex flex-wrap gap-3">
                {similar.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/areas/${s.slug}`}
                    className="inline-flex items-center h-9 px-3 rounded border border-bz-border bg-bz-bg text-[13px] text-bz-ink-2 hover:border-bz-border-strong hover:text-bz-ink transition-colors"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </>
    ),
  };

  return (
    <div className="bg-bz-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsLd) }}
      />
      {/* Crumb */}
      <div className="px-4 md:px-12 pt-10">
        <Link
          href="/areas"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-teal hover:text-bz-navy transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          {tp("allAreas")}
        </Link>
      </div>

      {content.order
        .filter((key) => key in nodes)
        .map((key) => (
          <React.Fragment key={key}>{nodes[key]}</React.Fragment>
        ))}
    </div>
  );
}

/**
 * One figure in the fallback stats band. An absent value renders an em-dash.
 *
 * `label`, `value` and `unit` are ReactNode so a tile can carry the
 * preference-aware leaves from `_components/area-text` — the page itself is a
 * server component and can't read the visitor's currency or area unit. Callers
 * must still pass `null` (not an empty element) for a missing figure, so the
 * em-dash branch below stays reachable.
 */
function Stat({
  label,
  value,
  unit,
  tone,
}: {
  label: React.ReactNode;
  value: React.ReactNode | null;
  unit?: React.ReactNode;
  tone?: "up" | "down";
}) {
  return (
    <div>
      <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
        {label}
      </div>
      <div
        className="serif text-[36px] mt-1 leading-none"
        style={{
          letterSpacing: "-0.018em",
          color:
            tone === "up"
              ? "var(--bz-success, oklch(0.55 0.14 145))"
              : tone === "down"
                ? "var(--bz-danger, oklch(0.5 0.18 25))"
                : undefined,
        }}
      >
        {value ?? "—"}
        {value && unit ? (
          <span className="mono text-[14px] text-bz-muted ms-1.5">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}
