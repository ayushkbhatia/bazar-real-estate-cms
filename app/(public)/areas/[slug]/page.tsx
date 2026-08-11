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
import { listAreaPins, listAreaListingDots, type AreaPin } from "@/lib/queries/area-map";
import { listPublishedProperties } from "@/lib/queries/properties";
import { getAreaHeroImage, getAreaPageContent } from "@/lib/queries/subpages";
import { str, list, type SectionValues } from "@/lib/master-pages";
import { parseFilters } from "@/lib/filters/property";
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
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // The catalogue row is what makes an area real: any area in `areas` gets a
  // page, whether or not it has a seed guide or a published `area_guides`
  // overlay. Only a slug that matches nothing at all 404s.
  const profile = await getAreaProfile(slug);
  if (!profile) notFound();

  const advisors = await withAgentPhotos(listSeedAgentsByArea(profile.slug));
  const areaFilters = parseFilters({ area: slug });
  const [gateForm, leadForm] = await Promise.all([
    getForm("valuation_report_gate"),
    getForm("areas_guide_consultation"),
  ]);

  const [content, heroImage, rawPins, dots, saleStock, rentStock, directory] =
    await Promise.all([
      getAreaPageContent({ name: profile.name, slug: profile.slug }),
      getAreaHeroImage(profile.slug),
      listAreaPins(),
      listAreaListingDots({ areaSlug: slug }),
      // Sale stock is everything that isn't a tenancy — ready, resale,
      // off-plan and commercial all belong under "for sale". Filtering in
      // memory keeps it to one roundtrip instead of one per mode.
      listPublishedProperties({ filters: areaFilters, limit: 24 }),
      listPublishedProperties({ mode: "rent", filters: areaFilters, limit: 6 }),
      listAreaDirectory(),
    ]);
  const pins = withOwnPin(rawPins, profile);
  const focusPin = pins.find((p) => p.slug === profile.slug) ?? null;
  const saleRows = saleStock.rows.filter((r) => r.mode !== "rent").slice(0, 6);
  const rentRows = rentStock.rows;

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

  const heroIntro = sv("hero", "intro") ?? profile.intro;
  const heroPosition = sv("hero", "position") ?? profile.position;
  const stats = profile.stats;
  const buyHref = `/buy/search?area=${profile.slug}`;
  const rentHref = `/rent/search?area=${profile.slug}`;

  const nodes: Record<string, React.ReactNode> = {
    "hero": (
      <>
      {/* Hero */}
      <section className="px-4 md:px-12 pt-8 pb-12 max-w-[1280px]">
        <Eyebrow>
          {sv("hero", "eyebrow") ??
            (profile.vibe
              ? `Community guide · ${profile.vibe}`
              : "Community guide")}
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
          <p className="mt-4 mono text-[12.5px] text-bz-muted">{heroPosition}</p>
        ) : null}
      </section>
      </>
    ),
    "hero-image": (
      <>
      {/* Hero image */}
      <section className="px-4 md:px-12 pb-14 max-w-[1280px]">
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
    "stats": (
      <>
      {/* Market statistics. The editorial figures typed into the CMS win;
          without them the band falls back to the medians on the guide
          record, and hides entirely when there is neither. */}
      {liveStats(values("stats")).length > 0 ? (
        <AreaStatsBand
          heading={
            sv("stats", "heading") ?? `${profile.name} property market at a glance`
          }
          intro={sv("stats", "intro")}
          stats={liveStats(values("stats"))}
          footnote={str(values("stats"), "footnote")}
        />
      ) : stats ? (
        <section className="border-y border-bz-border bg-bz-surface">
          <div className="px-4 md:px-12 py-10 max-w-[1280px]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
              <Stat
                label="Median apt / ft²"
                value={stats.medianAptPerFt2?.toLocaleString() ?? null}
                unit="AED"
              />
              <Stat
                label="Median villa / ft²"
                value={stats.medianVillaPerFt2?.toLocaleString() ?? null}
                unit="AED"
              />
              <Stat
                label="Avg days on market"
                value={stats.avgDaysOnMarket?.toString() ?? null}
              />
              <Stat
                label="YoY change"
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
    "map": (
      <>
      {/* Interactive map band — deep-linked to this area with its listing
          dots. Self-hides for areas with no coordinates on record. */}
      {focusPin ? (
        <section className="px-4 md:px-12 py-14 max-w-[1280px]">
          <Eyebrow>Location</Eyebrow>
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
    "landmarks": (
      <AreaLandmarks
        heading={sv("landmarks", "heading") ?? "Landmarks & attractions"}
        intro={sv("landmarks", "intro")}
        items={liveItems(values("landmarks"))}
        footnote={str(values("landmarks"), "footnote")}
      />
    ),
    "communities": (
      <AreaCommunities
        heading={sv("communities", "heading") ?? `Explore ${profile.name}`}
        intro={sv("communities", "intro")}
        items={liveItems(values("communities"))}
        footnote={str(values("communities"), "footnote")}
      />
    ),
    "listings": (
      <AreaListingsBand
        eyebrow="For sale"
        heading={
          sv("listings", "heading") ?? `Properties for sale in ${profile.name}`
        }
        intro={sv("listings", "intro")}
        rows={saleRows}
        ctaLabel={sv("listings", "cta_label") ?? "View all properties for sale"}
        ctaHref={sv("listings", "cta_href") ?? buyHref}
        emptyBody={`No published sale listings in ${profile.name} right now — an advisor can tell you what is coming to market.`}
        emptyHref="/contact"
        emptyLabel="Talk to an advisor"
      />
    ),
    "rentals": (
      <AreaListingsBand
        eyebrow="To rent"
        heading={
          sv("rentals", "heading") ?? `Properties for rent in ${profile.name}`
        }
        intro={sv("rentals", "intro")}
        rows={rentRows}
        ctaLabel={sv("rentals", "cta_label") ?? "View all properties for rent"}
        ctaHref={sv("rentals", "cta_href") ?? rentHref}
        emptyBody={
          sv("rentals", "empty_body") ??
          `Looking to rent in ${profile.name}? Speak with our team about current and upcoming availability.`
        }
        emptyHref="/contact"
        emptyLabel="Enquire about rentals"
        tone="surface"
      />
    ),
    "nearby": (
      <AreaNearby
        heading={sv("nearby", "heading") ?? "Connected to Abu Dhabi"}
        intro={sv("nearby", "intro")}
        items={liveItems(values("nearby"))}
        footnote={str(values("nearby"), "footnote")}
      />
    ),
    "why": (
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
    "faq": (
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
        heading={sv("final-cta", "heading") ?? `Find your property in ${profile.name}`}
        intro={
          sv("final-cta", "intro") ??
          "Explore opportunities to buy, rent or invest with trusted property guidance from Bazar Real Estate."
        }
        primary={{
          label: sv("final-cta", "cta_label") ?? "Explore properties",
          href: sv("final-cta", "cta_href") ?? buyHref,
        }}
        secondary={{
          label: sv("final-cta", "cta2_label") ?? "Get a free consultation",
          href: sv("final-cta", "cta2_href") ?? "/contact",
        }}
      />
    ),
    "schools": (
      <>
      {/* Schools + amenities — each column drops when it has nothing. */}
      {profile.schools.length > 0 || profile.amenities.length > 0 ? (
        <section className="px-4 md:px-12 py-16 max-w-[1280px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            {profile.schools.length > 0 ? (
              <div>
                <Eyebrow>Schools nearby</Eyebrow>
                <ul className="mt-5 flex flex-col gap-3">
                  {profile.schools.map((s) => (
                    <li
                      key={s.name}
                      className="flex items-baseline justify-between gap-4 border-b border-bz-border pb-3"
                    >
                      <div>
                        <div className="text-[15px] text-bz-ink">{s.name}</div>
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
                <Eyebrow>Amenities</Eyebrow>
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
    "reports": (
      <>
      {/* T1-A cleanup: cross-link rail into the area's quarterly market
          reports.  Closes the moat-orphan gap — visitors browsing the
          area can pivot directly into the data. */}
      <AreaReportsRail area_slug={profile.slug} area_name={profile.name} />
      </>
    ),
    "valuation": (
      <>
      {/* T1-E cleanup: lead-gate surfaced on the area page — owners of
          property in this community are the highest-intent valuation
          lead source. */}
      <section className="px-4 md:px-12 py-12 max-w-[1280px] border-t border-bz-border bg-bz-surface-2">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <Eyebrow>Own property in {profile.name}?</Eyebrow>
            <h2
              className="serif text-[28px] mt-2 leading-tight max-w-[36ch]"
              style={{ letterSpacing: "-0.018em" }}
            >
              See what an advisor would price it at, free.
            </h2>
            <p className="mt-3 text-[14px] text-bz-ink-2 max-w-[58ch]">
              Instant data-backed range from our model, then a senior
              advisor reviews and sends a refined valuation within 24
              hours.
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
    "lifestyle": (
      <>
      {/* T3-E: lifestyle dossier — commute chips, prose, dining picks.
          Seed-shaped, so it only draws for editorially-enriched areas. */}
      {profile.seed ? <LifestyleDossier area={profile.seed} /> : null}
      </>
    ),
    "advisors": (
      <>
      {/* Advisors who cover this area */}
      {advisors.length > 0 ? (
        <section className="px-4 md:px-12 py-16 max-w-[1280px]">
          <Eyebrow>Advisors who cover this area</Eyebrow>
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
    "similar": (
      <>
      {/* Similar areas */}
      {similar.length > 0 ? (
        <section className="border-t border-bz-border bg-bz-surface">
          <div className="px-4 md:px-12 py-12 max-w-[1280px]">
            <Eyebrow>Similar areas</Eyebrow>
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
      <div className="px-4 md:px-12 pt-10 max-w-[1280px]">
        <Link
          href="/areas"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-teal hover:text-bz-navy transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          All areas
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

/** One figure in the fallback stats band. An absent value renders an em-dash. */
function Stat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string | null;
  unit?: string;
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
          <span className="mono text-[14px] text-bz-muted ml-1.5">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}
