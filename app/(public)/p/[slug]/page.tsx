import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  BedDouble,
  Bath,
  Maximize2,
  Home,
  Calendar,
  KeyRound,
} from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { CarouselGrid } from "@/components/brand/mobile";
import { SimilarCard } from "./_components/similar-card";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import {
  extractReferenceFromSlug,
  formatPriceAED,
  getPropertyExistenceByReference,
  getPublishedPropertyByReference,
  getSavedPropertyIds,
  getSimilarProperties,
  propertyUrl,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import { listAmenitiesTaxonomy } from "@/lib/queries/amenities-taxonomy";
import { withAgentPhoto } from "@/lib/queries/agent-photos";
import { amenityLabel, orderAmenities, toOptions } from "@/lib/amenities";
import {
  propertyJsonLd,
  breadcrumbListJsonLd,
} from "@/lib/jsonld";
import {
  getSessionUser,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { recordView } from "@/lib/queries/recently-viewed";
import { env } from "@/lib/env";

/**
 * The shared detail query (`DETAIL_FIELDS`) doesn't select `geo`, so we fetch
 * the map coordinates route-locally rather than editing that shared file. RLS
 * still gates the read to published listings.
 */
async function fetchPropertyGeo(
  id: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("properties")
      .select("geo")
      .eq("id", id)
      .maybeSingle();
    const g = (data?.geo ?? null) as { lat?: unknown; lng?: unknown } | null;
    if (g && typeof g.lat === "number" && typeof g.lng === "number") {
      return { lat: g.lat, lng: g.lng };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Gallery images attached to the property (role `gallery`), ordered.
 * Fetched route-locally because the shared detail query reduces
 * `property_media` down to just the hero.
 */
async function fetchGalleryMedia(
  id: string,
): Promise<{ storage_key: string; alt: string | null }[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("property_media")
      .select("sort_order, media:media_assets(storage_key, alt_text)")
      .eq("property_id", id)
      .eq("role", "gallery")
      .order("sort_order", { ascending: true });
    return (data ?? [])
      .map((r) => {
        const m = (r as { media: { storage_key?: string; alt_text?: string | null } | null }).media;
        return m?.storage_key
          ? { storage_key: m.storage_key, alt: m.alt_text ?? null }
          : null;
      })
      .filter((x): x is { storage_key: string; alt: string | null } => x !== null);
  } catch {
    return [];
  }
}
import { EnquiryForm } from "../../_components/enquiry-form";
import { SEED_AGENTS } from "@/lib/seeds/agents";
import { Gallery, type GalleryImage } from "./_components/gallery";
import { GalleryTabs } from "./_components/gallery-tabs";
import { FloorPlanSection } from "./_components/floor-plan-section";
import { MapEmbed } from "./_components/map-embed";
import { PropertyActionRow } from "./_components/action-row";
import { PriceBlock } from "./_components/price-block";
import { AdvisorNote } from "./_components/advisor-note";
import { TrueCostBlock } from "./_components/true-cost-block";
import { AgentCard } from "./_components/agent-card";
import { ScheduleViewing } from "./_components/schedule-viewing";
import { ViewingCta } from "./_components/viewing-cta";
import { AdvisorContactRail } from "../../_components/advisor-contact-rail";
import {
  MarketContextBlock,
  reportableType,
} from "../../_components/market-context-link";
import { ValuationLeadGate } from "../../tools/valuation/_components/lead-gate";
import { PropertyFaq } from "./_components/property-faq";

export const revalidate = 60;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const ref = extractReferenceFromSlug(slug);
  if (!ref) return { title: "Property not found" };
  const property = await getPublishedPropertyByReference(ref);
  if (!property) return { title: "Property not found" };

  const description =
    property.short_description ??
    `${formatPriceAED(property.price_aed)} · ${property.beds}-bed ${property.type} in ${property.areas?.name ?? "the UAE"}`;

  const canonical = propertyUrl(property);
  const ogImage = property.hero
    ? [{ url: mediaPublicUrl(property.hero.storage_key), alt: property.title }]
    : undefined;

  return {
    title: property.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: property.title,
      description,
      url: canonical,
      images: ogImage,
      siteName: "Bazar Real Estate",
      locale: "en_AE",
    },
    twitter: {
      card: "summary_large_image",
      title: property.title,
      description,
      images: ogImage?.map((i) => i.url),
    },
    robots: { index: true, follow: true },
  };
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const ref = extractReferenceFromSlug(slug);
  if (!ref) notFound();

  const property = await getPublishedPropertyByReference(ref);
  if (!property) {
    // Property may exist but be off-market / archived (e.g. sold). Look
    // up unfiltered and redirect to /sold/[ref] so we return 410 Gone
    // instead of 404 — preserves backlinks + SERP signals.
    const existence = await getPropertyExistenceByReference(ref);
    if (
      existence &&
      (existence.status === "off_market" ||
        existence.status === "archived" ||
        existence.sold_at !== null)
    ) {
      redirect(`/sold/${existence.reference}`);
    }
    notFound();
  }

  // Redirect to canonical URL if slug prefix is off
  const canonical = propertyUrl({
    slug: property.slug,
    reference: property.reference,
  });
  if (`/p/${slug}` !== canonical) redirect(canonical);

  const [amenityTaxonomy, similar, user] = await Promise.all([
    listAmenitiesTaxonomy(),
    getSimilarProperties(
      property.id,
      property.areas?.slug ?? null,
      property.mode,
    ),
    getSessionUser(),
  ]);

  const amenityOptions = toOptions(amenityTaxonomy);
  const savedSet = await getSavedPropertyIds([
    property.id,
    ...similar.map((s) => s.id),
  ]);
  const geo = await fetchPropertyGeo(property.id);
  const galleryMedia = await fetchGalleryMedia(property.id);
  const isAuthed = user !== null;

  // Best-effort recently-viewed tracking. Anonymous views aren't tracked.
  if (user) {
    void recordView(user.id, property.id);
  }

  const priceAed = formatPriceAED(property.price_aed);
  const aedPerFt =
    property.built_up_ft2 && property.built_up_ft2 > 0
      ? Math.round(property.price_aed / property.built_up_ft2)
      : null;

  const heroPublicUrl = property.hero
    ? mediaPublicUrl(property.hero.storage_key)
    : null;

  // Gallery — hero first, then the property's uploaded gallery photos
  // (deduped against the hero in case one was promoted from a gallery row).
  const galleryImages: GalleryImage[] = [];
  const usedKeys = new Set<string>();
  if (property.hero) {
    galleryImages.push({
      src: heroPublicUrl,
      alt: property.hero.alt_text ?? property.title,
      label: `${property.reference} · 1`,
    });
    usedKeys.add(property.hero.storage_key);
  }
  for (const g of galleryMedia) {
    if (usedKeys.has(g.storage_key)) continue;
    usedKeys.add(g.storage_key);
    galleryImages.push({
      src: mediaPublicUrl(g.storage_key),
      alt: g.alt ?? property.title,
      label: `${property.reference} · ${galleryImages.length + 1}`,
    });
  }

  // Sprint 4c: pick a lead advisor from the seed set by area overlap.
  // Sprint 9 swaps to property.assigned_agent_id → real staff lookup.
  const leadAdvisor = (await withAgentPhoto(
    SEED_AGENTS.find((a) => a.areas.includes(property.areas?.slug ?? "")) ??
      SEED_AGENTS[0],
  ))!;

  const advisorNoteCopy = property.short_description ?? property.description;

  const siteUrl = (
    env.NEXT_PUBLIC_SITE_URL ?? "https://bazar-real-estate-cms.vercel.app"
  ).replace(/\/+$/, "");

  const jsonLd = propertyJsonLd(property, heroPublicUrl);
  const breadcrumbLd = breadcrumbListJsonLd([
    { name: "Home", url: `${siteUrl}/` },
    {
      name: property.mode === "rent" ? "For rent" : "For sale",
      url: `${siteUrl}/${property.mode === "rent" ? "rent" : "buy"}`,
    },
    ...(property.areas
      ? [
          {
            name: property.areas.name,
            url: `${siteUrl}/areas/${property.areas.slug}`,
          },
        ]
      : []),
    {
      name: property.reference,
      url: `${siteUrl}${canonical}`,
    },
  ]);

  return (
    <article className="bg-bz-bg pb-24 md:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* Breadcrumb */}
      <div className="px-4 md:px-12 pt-8 pb-3 text-[12px] text-bz-muted flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
        <Link href="/" className="text-bz-teal hover:text-bz-navy">
          Home
        </Link>
        <ChevronRight size={12} />
        <Link
          href={property.mode === "rent" ? "/rent" : "/buy"}
          className="text-bz-teal hover:text-bz-navy"
        >
          {property.mode === "rent" ? "For rent" : "For sale"}
        </Link>
        {property.areas ? (
          <>
            <ChevronRight size={12} />
            <Link
              href={`/areas/${property.areas.slug}`}
              className="text-bz-teal hover:text-bz-navy"
            >
              {property.areas.name}
            </Link>
          </>
        ) : null}
        <ChevronRight size={12} />
        <span className="mono text-bz-navy">{property.reference}</span>
      </div>

      {/* Action row */}
      <PropertyActionRow
        propertyId={property.id}
        reference={property.reference}
        title={property.title}
        initialSaved={savedSet.has(property.id)}
        isAuthed={isAuthed}
      />

      <div className="mt-4">
        <GalleryTabs
          hasFloorPlan={false}
          hasVideo={false}
          hasVirtualTour={false}
        >
          <Gallery images={galleryImages} reference={property.reference} />
        </GalleryTabs>
      </div>

      {/* Header band */}
      <section className="px-4 md:px-12 pt-8 md:pt-10 pb-8">
        <div className="flex gap-2 mb-4 flex-wrap">
          {property.flags?.exclusive ? (
            <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium bg-bz-navy text-bz-bg">
              Exclusive
            </span>
          ) : null}
          {property.flags?.vacant_on_transfer ? (
            <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium bg-bz-accent-soft text-bz-accent">
              Vacant on transfer
            </span>
          ) : null}
          {property.flags?.mortgage_eligible ? (
            <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium bg-bz-surface-2 text-bz-ink-2">
              Mortgage eligible
            </span>
          ) : null}
        </div>
        <h1
          className="serif text-[30px] md:text-[48px] font-normal leading-tight"
          style={{ letterSpacing: "-0.025em" }}
        >
          {property.title}
        </h1>
        <div className="flex items-baseline justify-between mt-4 flex-wrap gap-x-8 gap-y-4">
          <div className="text-[14px] text-bz-muted">
            {property.areas?.name ?? "United Arab Emirates"} ·{" "}
            <span className="mono text-bz-ink-2">{property.reference}</span>
          </div>
          <PriceBlock
            priceAed={property.price_aed}
            aedPerFt2={aedPerFt}
            listedDays={daysSince(property.published_at)}
            formattedAed={priceAed}
          />
        </div>
      </section>

      {/* Key facts */}
      <section className="px-4 md:px-12 pb-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <FactTile
            icon={<BedDouble size={16} strokeWidth={1.6} />}
            label="Bedrooms"
            value={String(property.beds)}
          />
          <FactTile
            icon={<Bath size={16} strokeWidth={1.6} />}
            label="Bathrooms"
            value={String(property.baths)}
          />
          <FactTile
            icon={<Maximize2 size={16} strokeWidth={1.6} />}
            label="Built-up"
            value={
              property.built_up_ft2 ? `${property.built_up_ft2} ft²` : "—"
            }
          />
          <FactTile
            icon={<Home size={16} strokeWidth={1.6} />}
            label="Type"
            value={titleCase(property.type)}
          />
          <FactTile
            icon={<KeyRound size={16} strokeWidth={1.6} />}
            label="Tenure"
            value={property.tenure ? titleCase(property.tenure) : "—"}
          />
          <FactTile
            icon={<Calendar size={16} strokeWidth={1.6} />}
            label="Year built"
            value={property.year_built ? String(property.year_built) : "—"}
          />
        </div>
      </section>

      {/* Description + sidebar */}
      <section className="px-4 md:px-12 pb-16 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-12">
        <div className="space-y-12">
          {advisorNoteCopy ? (
            <AdvisorNote
              note={advisorNoteCopy}
              advisorName={leadAdvisor.display_name}
            />
          ) : null}

          {property.description ? (
            <div>
              <Eyebrow>Why this one</Eyebrow>
              <p className="mt-3 text-[16.5px] leading-[1.7] text-bz-ink whitespace-pre-line max-w-[64ch]">
                {property.description}
              </p>
            </div>
          ) : null}

          {property.amenities.length > 0 ? (
            <div>
              <Eyebrow>Features &amp; amenities</Eyebrow>
              <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5 text-[14px]">
                {orderAmenities(property.amenities, amenityOptions).map(
                  (a) => (
                    <li key={a} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-bz-accent" />
                      {amenityLabel(a, amenityOptions)}
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : null}

          {/* Floor plan section */}
          <FloorPlanSection
            imageUrl={null}
            beds={property.beds}
            baths={property.baths}
            builtUpFt2={property.built_up_ft2}
            reference={property.reference}
          />

          {/* Location */}
          <div id="location" className="scroll-mt-16">
            <Eyebrow>Location</Eyebrow>
            <h3
              className="serif text-[24px] mt-2 mb-4"
              style={{ letterSpacing: "-0.012em" }}
            >
              {property.areas?.name ?? "Abu Dhabi"}
            </h3>
            {geo ? (
              <MapEmbed
                lat={geo.lat}
                lng={geo.lng}
                title={property.title}
                className="w-full aspect-[16/9] rounded-lg overflow-hidden border border-bz-border"
              />
            ) : (
              <PlaceholderImage
                label="No coordinates set on this listing"
                className="aspect-[16/9] rounded-lg"
              />
            )}
            {property.address_line ? (
              <p className="mt-3 text-[13px] text-bz-muted">
                {property.address_line}
              </p>
            ) : null}
          </div>

          {/* True cost */}
          <TrueCostBlock priceAed={property.price_aed} />
        </div>

        {/* Sidebar — sticky on desktop, folds inline on mobile */}
        <aside className="lg:sticky lg:top-6 self-start space-y-4">
          <AgentCard agent={leadAdvisor} />

          {/* T1-A cleanup: market context block in the sidebar — links to
              the report that matches this property's area + type. */}
          {property.areas?.slug ? (
            <MarketContextBlock
              area_slug={property.areas.slug}
              area_name={property.areas.name}
              property_type={reportableType(property.type)}
              variant="card"
            />
          ) : null}

          {/* T2-C: video tour + live viewing dual CTA above the existing
              schedule-viewing form. The "Live viewing" pill anchor-jumps
              down to the form so we keep the existing flow intact. */}
          <ViewingCta
            propertyReference={property.reference}
            propertyTitle={property.title}
          />

          <div id="schedule-viewing" className="scroll-mt-24">
            <ScheduleViewing
              propertyId={property.id}
              propertyReference={property.reference}
            />
          </div>

          <div
            id="send-brief"
            className="bg-bz-surface border border-bz-border rounded-lg p-5 scroll-mt-24"
          >
            <Eyebrow>Send a brief</Eyebrow>
            <h4 className="serif text-[18px] mt-2 leading-tight mb-4">
              Ask anything about{" "}
              <span className="mono text-[14px]">{property.reference}</span>.
            </h4>
            <EnquiryForm
              source="property_page"
              propertyId={property.id}
              propertyReference={property.reference}
              compact
            />
            {/* T1-E cleanup: secondary CTA — visitors who own elsewhere
                in the same area are a high-intent valuation source. */}
            <div className="mt-4 pt-4 border-t border-bz-border">
              <div className="text-[11px] uppercase tracking-wider text-bz-ink-2 mb-2">
                Own elsewhere in {property.areas?.name ?? "this area"}?
              </div>
              <ValuationLeadGate triggerLabel="Get a free valuation report" />
            </div>
            <div className="mt-4 pt-3 border-t border-bz-border space-y-1 text-[11.5px] text-bz-muted">
              {property.listing_permit_no ? (
                <div>
                  Permit:{" "}
                  <span className="mono text-bz-ink-2">
                    {property.listing_permit_no}
                  </span>
                </div>
              ) : null}
              {property.dld_plot_number ? (
                <div>
                  Plot:{" "}
                  <span className="mono text-bz-ink-2">
                    {property.dld_plot_number}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </section>

      {/* Similar */}
      {/* T1.5 quick win: property FAQ with JSON-LD FAQPage schema.
          Lifts long-tail SEO on every property page. */}
      <PropertyFaq
        reference={property.reference}
        title={property.title}
        areaName={property.areas?.name ?? null}
        propertyType={property.type}
        beds={property.beds}
        baths={property.baths}
        tenure={property.tenure ?? null}
        listingPermitNo={property.listing_permit_no ?? null}
      />

      {similar.length > 0 ? (
        <section className="px-4 md:px-12 py-12 md:py-16 border-t border-bz-border">
          <Eyebrow>More in {property.areas?.name ?? "the UAE"}</Eyebrow>
          <h2
            className="serif text-[26px] md:text-[32px] font-normal mt-2 mb-8"
            style={{ letterSpacing: "-0.02em" }}
          >
            Similar properties
          </h2>
          <CarouselGrid cols={4}>
            {similar.map((row) => (
              <Link
                key={row.reference}
                href={propertyUrl(row)}
                className="block"
              >
                <SimilarCard
                  price={formatPriceAED(row.price_aed)}
                  priceAed={row.price_aed}
                  title={row.title}
                  location={row.areas?.name ?? "United Arab Emirates"}
                  beds={row.beds}
                  baths={row.baths}
                  area={row.built_up_ft2 ?? 0}
                  imgLabel={row.reference}
                  heroSrc={
                    row.hero ? mediaPublicUrl(row.hero.storage_key) : null
                  }
                  heroAlt={row.hero?.alt_text ?? row.title}
                  propertyId={row.id}
                  initialSaved={savedSet.has(row.id)}
                  isAuthed={isAuthed}
                  compareEnabled
                />
              </Link>
            ))}
          </CarouselGrid>
        </section>
      ) : null}

      {/* T2-D: floating advisor contact rail. Fades in past the hero on
          desktop, slides up as a mobile bottom dock.
          T2-D cleanup: adds Email + Call-me-back to the action set. */}
      <AdvisorContactRail
        advisorName={leadAdvisor.display_name}
        advisorPhone={leadAdvisor.whatsapp ?? leadAdvisor.phone ?? null}
        advisorEmail={leadAdvisor.email ?? null}
        contextRef={property.reference}
        kind="property"
      />
    </article>
  );
}

function FactTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-bz-border rounded-lg p-4 bg-bz-surface">
      <div className="text-bz-muted">{icon}</div>
      <div className="mt-3 text-[11px] text-bz-muted uppercase tracking-wider">
        {label}
      </div>
      <div className="text-[16px] font-medium mt-1">{value}</div>
    </div>
  );
}

function titleCase(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Server-side helper — kept outside the render body so the React Compiler
 *  doesn't flag the Date.now() call as impure. */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000),
  );
}
