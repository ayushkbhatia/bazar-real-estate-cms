import { getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/locales";
import type { Metadata } from "next";
import { getForm } from "@/lib/queries/forms";
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
  getSimilarProperties,
  propertyUrl,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import { listAmenitiesTaxonomy } from "@/lib/queries/amenities-taxonomy";
import { getAdvisorByUserId } from "@/lib/queries/property-advisor";
import { amenityLabel, orderAmenities, toOptions } from "@/lib/amenities";
import { propertyJsonLd, breadcrumbListJsonLd } from "@/lib/jsonld";
// Cookie-free client on purpose: everything this route reads is public, and
// `createSupabaseServerClient` calls `cookies()`, which opts the whole route
// into dynamic rendering and discards the `revalidate = 60` below. Anonymous
// visitors already resolved these reads under the anon role, so the RLS result
// is unchanged — signed-in staff now see the same page the public sees, which
// is what a public listing page should show anyway.
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { env, isSupabaseConfigured } from "@/lib/env";

type PropertyExtras = {
  geo: { lat: number; lng: number } | null;
  assignedAgentId: string | null;
  permitExpiresAt: string | null;
};

/**
 * Columns the shared detail query (`DETAIL_FIELDS`) doesn't select, fetched
 * route-locally rather than editing that shared file. RLS still gates the
 * read to published listings.
 *
 * `assigned_agent_id` is the one that matters most: it's how the page finds
 * the advisor staff actually put on the listing.
 */
async function fetchPropertyExtras(id: string): Promise<PropertyExtras> {
  const empty: PropertyExtras = {
    geo: null,
    assignedAgentId: null,
    permitExpiresAt: null,
  };
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("properties")
      .select("geo, assigned_agent_id, listing_permit_expires_at")
      .eq("id", id)
      .maybeSingle();
    if (!data) return empty;
    const g = (data.geo ?? null) as { lat?: unknown; lng?: unknown } | null;
    return {
      geo:
        g && typeof g.lat === "number" && typeof g.lng === "number"
          ? { lat: g.lat, lng: g.lng }
          : null,
      assignedAgentId: data.assigned_agent_id ?? null,
      permitExpiresAt: data.listing_permit_expires_at ?? null,
    };
  } catch {
    return empty;
  }
}

type GalleryMediaRow = { storage_key: string; alt: string | null };

/**
 * Gallery images and the floor plan attached to the property, ordered.
 * Fetched route-locally because the shared detail query reduces
 * `property_media` down to just the hero.
 *
 * The floor plan comes from the same table (role `floor_plan`, uploaded from
 * the Floor plan card in the admin editor's Details tab). The page used to
 * hardcode `hasFloorPlan={false}` and `imageUrl={null}`, so an uploaded plan
 * was never shown.
 */
async function fetchPropertyMedia(id: string): Promise<{
  gallery: GalleryMediaRow[];
  floorPlan: GalleryMediaRow | null;
}> {
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("property_media")
      .select("role, sort_order, media:media_assets(storage_key, alt_text)")
      .eq("property_id", id)
      .in("role", ["gallery", "floor_plan"])
      .order("sort_order", { ascending: true });
    const rows = (data ?? []).map((r) => {
      const row = r as {
        role: string;
        media: { storage_key?: string; alt_text?: string | null } | null;
      };
      return row.media?.storage_key
        ? {
            role: row.role,
            storage_key: row.media.storage_key,
            alt: row.media.alt_text ?? null,
          }
        : null;
    });
    const present = rows.filter(
      (x): x is { role: string } & GalleryMediaRow => x !== null,
    );
    return {
      gallery: present
        .filter((r) => r.role === "gallery")
        .map(({ storage_key, alt }) => ({ storage_key, alt })),
      floorPlan:
        present
          .filter((r) => r.role === "floor_plan")
          .map(({ storage_key, alt }) => ({ storage_key, alt }))[0] ?? null,
    };
  } catch {
    return { gallery: [], floorPlan: null };
  }
}
import { FormRenderer } from "../../_components/forms/form-renderer";
import { Gallery, type GalleryImage } from "./_components/gallery";
import { GalleryTabs } from "./_components/gallery-tabs";
import { FloorPlanSection } from "./_components/floor-plan-section";
import { MapEmbed } from "./_components/map-embed";
import { PropertyActionRow } from "./_components/action-row";
import { PriceBlock } from "./_components/price-block";
import { AdvisorNote } from "./_components/advisor-note";
import { SpecificationTable, type SpecRow } from "./_components/specification";
import { AgentCard } from "./_components/agent-card";
import { FloatingCtaTarget } from "../../_components/floating-cta-context";
import { ValuationLeadGate } from "../../tools/valuation/_components/lead-gate";
import { PropertyFaq } from "./_components/property-faq";
import { AreaText, PricePerAreaText } from "../../_components/area-text";

export const revalidate = 60;

/**
 * Prerender the published catalogue at build time.
 *
 * Without this the route is `ƒ (Dynamic)` and Vercel serves it with
 * `no-store` — every listing view was a cold server render plus a round-trip
 * to Supabase, which measured ~4s TTFB in production on the site's most
 * visited pages. `dynamicParams` stays at its default of `true`, so a listing
 * published after the deploy still renders on demand and is then cached for
 * `revalidate` seconds; this only decides what is warm on day one.
 *
 * Returning `[]` on failure is deliberate: a Supabase hiccup during a build
 * should cost warm pages, never the build itself.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("properties")
      .select("slug, reference")
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(5000);
    return (data ?? []).map((p) => ({
      slug: propertyUrl(p).replace("/p/", ""),
    }));
  } catch (err) {
    console.error("[p/[slug]] generateStaticParams failed", err);
    return [];
  }
}

type PageProps = { params: Promise<{ slug: string; locale: Locale }> };

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
  const { slug, locale } = await params;
  /*
   * The locale comes from `params`, not from the ambient request.
   *
   * `getTranslations("property")` on its own reads `getLocale()`, which falls
   * through to `headers()` unless setRequestLocale has already run in the same
   * render pass — and that made this route dynamic. `npm run check:routes`
   * caught it immediately:
   *
   *     These routes were prerendered and are now rendered on demand:
   *       /p/[slug]
   *
   * On the busiest template on the site. Nothing else would have noticed: the
   * page still renders, just uncached, with its `revalidate` discarded.
   */
  const t = await getTranslations({ locale, namespace: "property" });
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

  // No session lookup: with customer accounts gone the property page is the
  // same for everyone, which keeps it out of dynamic rendering.
  const [amenityTaxonomy, similar, enquiryForm, valuationGate] =
    await Promise.all([
      listAmenitiesTaxonomy(),
      getSimilarProperties(
        property.id,
        property.areas?.slug ?? null,
        property.mode,
      ),
      // The listing enquiry dialog — fields and copy come from /admin/forms.
      getForm("property_enquiry"),
      getForm("valuation_report_gate"),
    ]);

  const amenityOptions = toOptions(amenityTaxonomy);
  const [extras, media] = await Promise.all([
    fetchPropertyExtras(property.id),
    fetchPropertyMedia(property.id),
  ]);
  const geo = extras.geo;
  const galleryMedia = media.gallery;
  const floorPlanUrl = media.floorPlan
    ? mediaPublicUrl(media.floorPlan.storage_key)
    : null;

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

  // The advisor staff assigned in the admin editor. Null when the listing is
  // unassigned, or the assignee isn't a publicly-visible active agent — the
  // advisor card and contact rail then drop out rather than falling back to a
  // seeded name, which is what this page used to do.
  const leadAdvisor = await getAdvisorByUserId(extras.assignedAgentId);

  const advisorNoteCopy = property.short_description ?? property.description;

  // Everything the listing stores that the key-facts tiles above don't
  // already show. Empty values are dropped, not rendered as em-dashes.
  const specRows: SpecRow[] = (
    [
      property.developments
        ? { label: t("spec.development"), value: property.developments.name }
        : null,
      property.furnishing
        ? {
            label: t("spec.furnishing"),
            value: t(`furnishing.${property.furnishing}`),
          }
        : null,
      property.floor != null
        ? { label: t("spec.floor"), value: String(property.floor) }
        : null,
      property.parking_bays != null
        ? {
            label: t("spec.parking"),
            value: t("spec.parkingBays", { count: property.parking_bays }),
          }
        : null,
      property.plot_ft2
        ? {
            label: t("spec.plotSize"),
            value: <AreaText ft2={property.plot_ft2} />,
          }
        : null,
      // Deliberately no AED/ft² row — the price block in the header band
      // already carries it, and repeating it here reads as filler.
      property.view ? { label: t("spec.view"), value: property.view } : null,
      property.orientation
        ? { label: t("spec.orientation"), value: property.orientation }
        : null,
      property.service_charge_per_ft2
        ? {
            label: t("spec.serviceCharge"),
            value: (
              <PricePerAreaText aedPerFt2={property.service_charge_per_ft2} />
            ),
            note: t("spec.perYear"),
          }
        : null,
      { label: t("spec.listingType"), value: t(`mode.${property.mode}`) },
      property.published_at
        ? {
            label: t("spec.listed"),
            value: formatListedDate(property.published_at),
          }
        : null,
    ] as (SpecRow | null)[]
  ).filter((r): r is SpecRow => r !== null);

  const siteUrl = (
    env.NEXT_PUBLIC_SITE_URL ?? "https://www.bazarrealestate.ae"
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
        enquiryForm={enquiryForm}
        propertyId={property.id}
        reference={property.reference}
        title={property.title}
        advisorName={leadAdvisor?.display_name}
      />

      <div className="mt-4">
        <GalleryTabs floorPlanUrl={floorPlanUrl} reference={property.reference}>
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
          />
        </div>
      </section>

      {/* Key facts */}
      <section className="px-4 md:px-12 pb-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <FactTile
            icon={<BedDouble size={16} strokeWidth={1.6} />}
            label={t("stat.bedrooms")}
            value={String(property.beds)}
          />
          <FactTile
            icon={<Bath size={16} strokeWidth={1.6} />}
            label={t("stat.bathrooms")}
            value={String(property.baths)}
          />
          <FactTile
            icon={<Maximize2 size={16} strokeWidth={1.6} />}
            label={t("stat.builtUp")}
            value={<AreaText ft2={property.built_up_ft2} />}
          />
          <FactTile
            icon={<Home size={16} strokeWidth={1.6} />}
            label={t("stat.type")}
            value={titleCase(property.type)}
          />
          <FactTile
            icon={<KeyRound size={16} strokeWidth={1.6} />}
            label={t("stat.tenure")}
            value={property.tenure ? titleCase(property.tenure) : "—"}
          />
          <FactTile
            icon={<Calendar size={16} strokeWidth={1.6} />}
            label={t("stat.yearBuilt")}
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
              advisorName={leadAdvisor?.display_name}
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
                {orderAmenities(property.amenities, amenityOptions).map((a) => (
                  <li key={a} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-bz-accent" />
                    {amenityLabel(a, amenityOptions)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Floor plan section */}
          <FloorPlanSection
            imageUrl={floorPlanUrl}
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

          {/* Specification — replaces the old "True cost of buying" block */}
          <SpecificationTable
            rows={specRows}
            permitNo={property.listing_permit_no}
            permitExpiry={
              extras.permitExpiresAt
                ? formatListedDate(extras.permitExpiresAt)
                : null
            }
            plotNumber={property.dld_plot_number}
          />
        </div>

        {/* Sidebar — sticky on desktop, folds inline on mobile */}
        <aside className="lg:sticky lg:top-6 self-start space-y-4">
          {leadAdvisor ? (
            <AgentCard
              enquiryForm={enquiryForm}
              advisor={leadAdvisor}
              propertyId={property.id}
              propertyReference={property.reference}
              propertyTitle={property.title}
            />
          ) : null}

          <div
            id="send-brief"
            className="bg-bz-surface border border-bz-border rounded-lg p-5 scroll-mt-24"
          >
            <Eyebrow>Enquire about this property</Eyebrow>
            <h4 className="serif text-[18px] mt-2 leading-tight mb-4">
              Ask anything about{" "}
              <span className="mono text-[14px]">{property.reference}</span>.
            </h4>
            <FormRenderer
              form={{
                ...enquiryForm,
                copy: { ...enquiryForm.copy, title: null, subtitle: null },
              }}
              tokens={{ reference: property.reference }}
              context={{
                propertyId: property.id,
                propertyReference: property.reference,
              }}
              successStyle="soft"
              allowAnother
              toastErrors
            />
            {/* T1-E cleanup: secondary CTA — visitors who own elsewhere
                in the same area are a high-intent valuation source. */}
            <div className="mt-4 pt-4 border-t border-bz-border">
              <div className="text-[11px] uppercase tracking-wider text-bz-ink-2 mb-2">
                Own elsewhere in {property.areas?.name ?? "this area"}?
              </div>
              {valuationGate.enabled ? (
                <ValuationLeadGate
                  form={valuationGate}
                  triggerLabel="Get a free valuation report"
                />
              ) : null}
            </div>
            {/* Permit + DLD plot moved into the Specification block, which
                now carries the full compliance line. */}
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
            Nearby Properties
          </h2>
          <CarouselGrid cols={4}>
            {similar.map((row) => (
              <Link
                key={row.reference}
                href={propertyUrl(row)}
                className="block"
              >
                <SimilarCard
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
                />
              </Link>
            ))}
          </CarouselGrid>
        </section>
      ) : null}

      {/* The floating CTA rail is mounted once in the public layout. This
          publishes the listing's advisor to it, so the buttons route to that
          person and the draft message names the reference. Renders nothing. */}
      {leadAdvisor ? (
        <FloatingCtaTarget
          advisorName={leadAdvisor.display_name}
          advisorPhone={leadAdvisor.whatsapp ?? leadAdvisor.phone ?? null}
          advisorEmail={leadAdvisor.email ?? null}
          contextRef={property.reference}
          kind="property"
        />
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
  value: React.ReactNode;
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

/** `2026-08-07` / ISO timestamp → `7 Aug 2026`. Fixed en-GB locale so the
 *  server-rendered string matches on the client. */
function formatListedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
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
