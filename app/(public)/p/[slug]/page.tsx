import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, BedDouble, Bath, Maximize2, Home, Calendar, KeyRound } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { ListingCard } from "@/components/brand/listing-card";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import {
  extractReferenceFromSlug,
  formatPriceAED,
  getPublishedPropertyByReference,
  getSavedPropertyIds,
  getSimilarProperties,
  propertyUrl,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import { propertyJsonLd } from "@/lib/jsonld";
import { getSessionUser } from "@/lib/supabase/server";

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

  const jsonLd = propertyJsonLd(
    property,
    property.hero ? mediaPublicUrl(property.hero.storage_key) : null,
  );

  return (
    <article className="bg-bz-bg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Breadcrumb */}
      <div className="px-12 pt-8 pb-3 text-[12px] text-bz-muted flex items-center gap-1.5">
        <Link href="/" className="hover:text-bz-ink">Home</Link>
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
            <span>{property.areas.name}</span>
          </>
        ) : null}
        <ChevronRight size={12} />
        <span className="mono text-bz-ink">{property.reference}</span>
      </div>

      {/* Gallery — hero + placeholder slots until the full gallery picker lands */}
      <section className="px-12">
        <div className="grid grid-cols-3 grid-rows-2 gap-2 h-[480px]">
          {property.hero ? (
            <div className="relative col-span-2 row-span-2 rounded-lg overflow-hidden">
              <Image
                src={mediaPublicUrl(property.hero.storage_key)}
                alt={property.hero.alt_text ?? property.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 66vw"
                className="object-cover"
              />
            </div>
          ) : (
            <PlaceholderImage
              label={`${property.reference} · 1`}
              className="col-span-2 row-span-2 rounded-lg"
            />
          )}
          <PlaceholderImage
            label={`${property.reference} · 2`}
            className="rounded-lg"
          />
          <PlaceholderImage
            label={`${property.reference} · 3`}
            className="rounded-lg"
          />
        </div>
      </section>

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
        <div className="flex items-baseline justify-between mt-3 flex-wrap gap-x-8 gap-y-3">
          <div className="text-[14px] text-bz-muted">
            {property.areas?.name ?? "United Arab Emirates"} ·{" "}
            <span className="mono text-bz-ink-2">{property.reference}</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span
              className="serif text-[56px] font-normal leading-none"
              style={{ letterSpacing: "-0.025em" }}
            >
              {priceAed}
            </span>
            {aedPerFt ? (
              <span className="mono text-[13px] text-bz-muted">
                {aedPerFt.toLocaleString()} AED/ft²
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {/* Key facts */}
      <section className="px-12 pb-10">
        <div className="grid grid-cols-6 gap-3">
          <FactTile icon={<BedDouble size={16} strokeWidth={1.6} />} label="Bedrooms" value={String(property.beds)} />
          <FactTile icon={<Bath size={16} strokeWidth={1.6} />} label="Bathrooms" value={String(property.baths)} />
          <FactTile icon={<Maximize2 size={16} strokeWidth={1.6} />} label="Built-up" value={property.built_up_ft2 ? `${property.built_up_ft2} ft²` : "—"} />
          <FactTile icon={<Home size={16} strokeWidth={1.6} />} label="Type" value={titleCase(property.type)} />
          <FactTile icon={<KeyRound size={16} strokeWidth={1.6} />} label="Tenure" value={property.tenure ? titleCase(property.tenure) : "—"} />
          <FactTile icon={<Calendar size={16} strokeWidth={1.6} />} label="Year built" value={property.year_built ? String(property.year_built) : "—"} />
        </div>
      </section>

      {/* Description + sidebar */}
      <section className="px-12 pb-16 grid grid-cols-[1fr_320px] gap-10">
        <div className="space-y-10">
          {property.description ? (
            <div>
              <Eyebrow>Why this one</Eyebrow>
              <p className="mt-3 text-[17px] leading-[1.7] text-bz-ink whitespace-pre-line">
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

          {/* Location placeholder */}
          <div>
            <Eyebrow>Location</Eyebrow>
            <h3 className="serif text-[24px] mt-2 mb-4">
              {property.areas?.name ?? "Abu Dhabi"}
            </h3>
            <PlaceholderImage
              label="map · phase 1.2 (mapbox)"
              className="aspect-[16/9] rounded-lg"
            />
            {property.address_line ? (
              <p className="mt-3 text-[13px] text-bz-muted">
                {property.address_line}
              </p>
            ) : null}
          </div>
        </div>

        {/* Sticky sidebar */}
        <aside className="sticky top-6 self-start">
          <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
            <Eyebrow>Talk to an advisor</Eyebrow>
            <h4 className="serif text-[22px] mt-2 leading-tight">
              Schedule a viewing or send a brief.
            </h4>
            <p className="mt-3 text-[13px] text-bz-muted leading-relaxed">
              Our advisors respond within two hours during business hours and
              by next morning otherwise.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button asChild>
                <Link href={`/contact?ref=${property.reference}`}>
                  Send enquiry
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/concierge">Talk to an advisor</Link>
              </Button>
            </div>
            <div className="mt-5 pt-4 border-t border-bz-border space-y-1.5 text-[12px] text-bz-muted">
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
              {property.published_at ? (
                <div>
                  Listed{" "}
                  {new Date(property.published_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </section>

      {/* Similar */}
      {similar.length > 0 ? (
        <section className="px-12 py-16 border-t border-bz-border">
          <Eyebrow>
            More in {property.areas?.name ?? "the UAE"}
          </Eyebrow>
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
