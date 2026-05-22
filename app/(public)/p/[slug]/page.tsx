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
import { ListingCard } from "@/components/brand/listing-card";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import {
  extractReferenceFromSlug,
  formatPriceAED,
  getPublishedPropertyByReference,
  getSavedPropertyIds,
  getSimilarProperties,
  propertyUrl,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import {
  propertyJsonLd,
  breadcrumbListJsonLd,
} from "@/lib/jsonld";
import { getSessionUser } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { EnquiryForm } from "../../_components/enquiry-form";
import { SEED_AGENTS } from "@/lib/seeds/agents";
import { Gallery, type GalleryImage } from "./_components/gallery";
import { PropertyActionRow } from "./_components/action-row";
import { PriceBlock } from "./_components/price-block";
import { AdvisorNote } from "./_components/advisor-note";
import { TrueCostBlock } from "./_components/true-cost-block";
import { AgentCard } from "./_components/agent-card";
import { ScheduleViewing } from "./_components/schedule-viewing";

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
  if (!property) notFound();

  // Redirect to canonical URL if slug prefix is off
  const canonical = propertyUrl({
    slug: property.slug,
    reference: property.reference,
  });
  if (`/p/${slug}` !== canonical) redirect(canonical);

  const [similar, user] = await Promise.all([
    getSimilarProperties(
      property.id,
      property.areas?.slug ?? null,
      property.mode,
    ),
    getSessionUser(),
  ]);
  const savedSet = await getSavedPropertyIds([
    property.id,
    ...similar.map((s) => s.id),
  ]);
  const isAuthed = user !== null;

  const priceAed = formatPriceAED(property.price_aed);
  const aedPerFt =
    property.built_up_ft2 && property.built_up_ft2 > 0
      ? Math.round(property.price_aed / property.built_up_ft2)
      : null;

  const heroPublicUrl = property.hero
    ? mediaPublicUrl(property.hero.storage_key)
    : null;

  // Gallery — for Sprint 4c we only have the hero in the query shape;
  // Sprint 7c's Media tab will populate property_media so all images flow
  // through here.
  const galleryImages: GalleryImage[] = [];
  if (property.hero) {
    galleryImages.push({
      src: heroPublicUrl,
      alt: property.hero.alt_text ?? property.title,
      label: `${property.reference} · 1`,
    });
  }

  // Sprint 4c: pick a lead advisor from the seed set by area overlap.
  // Sprint 9 swaps to property.assigned_agent_id → real staff lookup.
  const leadAdvisor =
    SEED_AGENTS.find((a) =>
      a.areas.includes(property.areas?.slug ?? ""),
    ) ?? SEED_AGENTS[0];

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
    <article className="bg-bz-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* Breadcrumb */}
      <div className="px-12 pt-8 pb-3 text-[12px] text-bz-muted flex items-center gap-1.5">
        <Link href="/" className="hover:text-bz-ink">
          Home
        </Link>
        <ChevronRight size={12} />
        <Link
          href={property.mode === "rent" ? "/rent" : "/buy"}
          className="hover:text-bz-ink"
        >
          {property.mode === "rent" ? "For rent" : "For sale"}
        </Link>
        {property.areas ? (
          <>
            <ChevronRight size={12} />
            <Link
              href={`/areas/${property.areas.slug}`}
              className="hover:text-bz-ink"
            >
              {property.areas.name}
            </Link>
          </>
        ) : null}
        <ChevronRight size={12} />
        <span className="mono text-bz-ink">{property.reference}</span>
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
        <Gallery images={galleryImages} reference={property.reference} />
      </div>

      {/* Header band */}
      <section className="px-12 pt-10 pb-8">
        <div className="flex gap-2 mb-4">
          {property.flags?.exclusive ? (
            <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium bg-bz-ink text-bz-bg">
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
          className="serif text-[48px] font-normal leading-tight"
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
      <section className="px-12 pb-10">
        <div className="grid grid-cols-6 gap-3">
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
      <section className="px-12 pb-16 grid grid-cols-[1fr_360px] gap-12">
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
              <ul className="mt-4 grid grid-cols-3 gap-x-6 gap-y-2.5 text-[14px]">
                {property.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-bz-accent" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Floor plan section */}
          <div>
            <Eyebrow>Floor plan</Eyebrow>
            <h3 className="serif text-[24px] mt-2 mb-4">Unit layout</h3>
            <PlaceholderImage
              label="floor plan · upload via property editor (Sprint 7c)"
              className="aspect-[16/10] rounded-lg"
            />
          </div>

          {/* Location */}
          <div>
            <Eyebrow>Location</Eyebrow>
            <h3 className="serif text-[24px] mt-2 mb-4">
              {property.areas?.name ?? "Abu Dhabi"}
            </h3>
            <PlaceholderImage
              label="map · mapbox wires up in Sprint 12"
              className="aspect-[16/9] rounded-lg"
            />
            {property.address_line ? (
              <p className="mt-3 text-[13px] text-bz-muted">
                {property.address_line}
              </p>
            ) : null}
          </div>

          {/* True cost */}
          <TrueCostBlock priceAed={property.price_aed} />
        </div>

        {/* Sticky sidebar */}
        <aside className="sticky top-6 self-start space-y-4">
          <AgentCard agent={leadAdvisor} />

          <ScheduleViewing propertyReference={property.reference} />

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
      {similar.length > 0 ? (
        <section className="px-12 py-16 border-t border-bz-border">
          <Eyebrow>More in {property.areas?.name ?? "the UAE"}</Eyebrow>
          <h2
            className="serif text-[32px] font-normal mt-2 mb-8"
            style={{ letterSpacing: "-0.02em" }}
          >
            Similar properties
          </h2>
          <div className="grid grid-cols-4 gap-5">
            {similar.map((row) => (
              <Link
                key={row.reference}
                href={propertyUrl(row)}
                className="block"
              >
                <ListingCard
                  price={formatPriceAED(row.price_aed)}
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
          </div>
        </section>
      ) : null}
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
