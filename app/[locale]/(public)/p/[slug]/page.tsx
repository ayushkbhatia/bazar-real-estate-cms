import { getTranslations } from "next-intl/server";

import { arabicFor } from "@/lib/i18n/arabic-store";
import { localeDateTag } from "@/lib/i18n/dates";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import type { Locale } from "@/lib/i18n/locales";
import type { Metadata } from "next";
import { getForm } from "@/lib/queries/forms";
import { notFound, redirect } from "next/navigation";
import Link from "@/components/i18n/link";
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
import { cn } from "@/lib/utils";
import { getCardLabelResolver } from "@/lib/queries/card-labels";
import type { ResolvedCardLabel } from "@/lib/card-labels";
import {
  extractReferenceFromSlug,
  formatPriceAED,
  getPropertyExistenceByReference,
  getPublishedPropertyByReference,
  getSimilarProperties,
  propertyUrl,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import {
  authoredTitle,
  getPropertySearchAppearance,
} from "@/lib/queries/search-appearance";
import { localiseSearchAppearance } from "@/lib/schemas/seo";
import { listAmenitiesTaxonomy } from "@/lib/queries/amenities-taxonomy";
import { getAdvisorByUserId } from "@/lib/queries/property-advisor";
import { getPropertyPageCopy } from "@/lib/queries/property-page";
import { isolateForLocale } from "@/lib/i18n/bidi";
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
import { TokenText } from "./_components/token-text";
import type { EnquiryDialogCopy } from "./_components/enquiry-dialog";
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
  const { slug, locale } = await params;
  const ref = extractReferenceFromSlug(slug);
  if (!ref) return { title: "Property not found" };
  const property = await getPublishedPropertyByReference(ref);
  if (!property) return { title: "Property not found" };

  /*
   * The listing's own Search appearance — the SEO tab in the property editor.
   *
   * It has been writing `properties.seo` since the editor shipped and this
   * route read neither half of it, so an advisor who wrote
   * "3BR + Maid at Yas Park Place | Yas Island" published "Yas Park Place"
   * and never found out. Read separately rather than through
   * `getPublishedPropertyByReference`, whose `DETAIL_FIELDS` does not select
   * `seo` — see `getPropertySearchAppearance`.
   */
  const seo = localiseSearchAppearance(
    await getPropertySearchAppearance(ref),
    locale,
  );

  const description =
    seo.meta_description ??
    property.short_description ??
    `${formatPriceAED(property.price_aed)} · ${property.beds}-bed ${property.type} in ${property.areas?.name ?? "the UAE"}`;

  const canonical = propertyUrl(property);
  const ogImage = property.hero
    ? [{ url: mediaPublicUrl(property.hero.storage_key), alt: property.title }]
    : undefined;

  return {
    title: authoredTitle(seo.meta_title, property.title),
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

/** The five chip styles the listing card draws, mirrored for the header band. */
const DETAIL_LABEL_STYLES: Record<ResolvedCardLabel["kind"], string> = {
  ink: "bg-bz-navy text-bz-bg",
  accent: "bg-bz-accent-soft text-bz-accent",
  success: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  warn: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  danger: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
};

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
  // `t` is already this page's own namespace; `tp` is the shared
  // `pages` bag for the strings W6 extracted out of the JSX. The band
  // eyebrows it used to hold are in the listing-page copy document now —
  // see `copy` below.
  const tp = await getTranslations({ locale, namespace: "pages.property" });
  const tl = await getTranslations({ locale, namespace: "listing" });
  const cardLabels = await getCardLabelResolver(locale);
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
  //
  // `locale` so the advisor's Arabic name, title and languages fold in. They
  // were on the row all along; this read never asked for them.
  const leadAdvisor = await getAdvisorByUserId(extras.assignedAgentId, locale);

  /*
   * The page's own words — every band's eyebrow and heading, the enquiry card
   * and dialog, the lead-advisor card's label and button, the shared FAQ
   * questions and the similar-listings rail — from the one document every
   * listing shares (Pages → Sub-pages → Property pages).
   *
   * `{area}` falls back to "the UAE" for a listing with no area, which is what
   * the similar rail said before; the valuation prompt overrides it with "this
   * area" at its call site, which is what that line said.
   */
  const typeLabel = propertyTypeLabel(property.type, locale);
  const copy = await getPropertyPageCopy(
    {
      reference: property.reference,
      title: property.title,
      area: property.areas?.name ?? t("fallbackRegion"),
      advisor: leadAdvisor?.display_name ?? "",
      type: typeLabel,
    },
    locale,
  );

  const dialogCopy: EnquiryDialogCopy = {
    title: copy.text("enquiry", "dialog_title"),
    note: copy.template(
      "enquiry",
      leadAdvisor ? "dialog_note" : "dialog_note_no_advisor",
    ),
    tokens: copy.tokens,
  };

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
            value: formatListedDate(property.published_at, locale),
          }
        : null,
    ] as (SpecRow | null)[]
  ).filter((r): r is SpecRow => r !== null);

  const siteUrl = (
    env.NEXT_PUBLIC_SITE_URL ?? "https://www.bazarrealestate.ae"
  ).replace(/\/+$/, "");

  const jsonLd = propertyJsonLd(property, heroPublicUrl);
  const crumbHome = t("breadcrumb.home");
  const crumbMode = t(property.mode === "rent" ? "mode.rent" : "mode.buy");
  const breadcrumbLd = breadcrumbListJsonLd([
    { name: crumbHome, url: `${siteUrl}/` },
    {
      name: crumbMode,
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
          {crumbHome}
        </Link>
        <ChevronRight size={12} className="rtl:-scale-x-100" />
        <Link
          href={property.mode === "rent" ? "/rent" : "/buy"}
          className="text-bz-teal hover:text-bz-navy"
        >
          {crumbMode}
        </Link>
        {property.areas ? (
          <>
            <ChevronRight size={12} className="rtl:-scale-x-100" />
            <Link
              href={`/areas/${property.areas.slug}`}
              className="text-bz-teal hover:text-bz-navy"
            >
              {property.areas.name}
            </Link>
          </>
        ) : null}
        <ChevronRight size={12} className="rtl:-scale-x-100" />
        <span className="mono text-bz-navy">{property.reference}</span>
      </div>

      {/* Action row */}
      <PropertyActionRow
        enquiryForm={enquiryForm}
        dialogCopy={dialogCopy}
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
        {/*
          The same labels the card wears, from the same vocabulary — otherwise
          a client who renamed "Exclusive" to "Sole agency" would get the new
          word on every card and the old one here, on the page a buyer reads
          most carefully.

          No `limit`: this is a header band with a whole row to itself, not a
          22px strip over a thumbnail, so a listing carrying four says four.

          `mortgage_eligible` stays on the catalogue below. It is a fact about
          financing rather than a marketing label — it has never appeared on a
          card, and putting it in the editable vocabulary would offer to let
          someone rename a regulatory statement.
        */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {cardLabels(property.flags, Number.MAX_SAFE_INTEGER).map((l) => (
            <span
              key={l.id}
              className={cn(
                "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                DETAIL_LABEL_STYLES[l.kind],
              )}
            >
              {l.label}
            </span>
          ))}
          {property.flags?.mortgage_eligible ? (
            <span className="inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium bg-bz-surface-2 text-bz-ink-2">
              {tl("badge.mortgageEligible")}
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
            {property.areas?.name ?? t("fallbackArea")} ·{" "}
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
            value={term(property.type, locale)}
          />
          <FactTile
            icon={<KeyRound size={16} strokeWidth={1.6} />}
            label={t("stat.tenure")}
            value={tenureLabel(property.tenure, t)}
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
              eyebrow={copy.text("advisor-note", "eyebrow")}
              note={advisorNoteCopy}
              advisorName={leadAdvisor?.display_name}
            />
          ) : null}

          {property.description ? (
            <div>
              <Eyebrow>{copy.text("description", "eyebrow")}</Eyebrow>
              <p className="mt-3 text-[16.5px] leading-[1.7] text-bz-ink whitespace-pre-line max-w-[64ch]">
                {property.description}
              </p>
            </div>
          ) : null}

          {/* Floor plan section */}
          <FloorPlanSection
            eyebrow={copy.text("floor-plan", "eyebrow")}
            heading={copy.text("floor-plan", "heading")}
            locale={locale}
            imageUrl={floorPlanUrl}
            beds={property.beds}
            baths={property.baths}
            builtUpFt2={property.built_up_ft2}
            reference={property.reference}
          />

          {property.amenities.length > 0 ? (
            <div>
              <Eyebrow>{copy.text("amenities", "eyebrow")}</Eyebrow>
              <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5 text-[14px]">
                {orderAmenities(property.amenities, amenityOptions).map((a) => (
                  <li key={a} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-bz-accent" />
                    {/* `locale` picks the taxonomy's Arabic twin; `arabicFor`
                        catches the free-text values that predate the picker
                        writing to the taxonomy at all — 55 of them are in the
                        catalogue, and they have no row to carry a twin. Same
                        fallback the compare table uses, so the two surfaces
                        now agree on the same page's worth of words. */}
                    {amenityLabel(a, amenityOptions, {
                      locale,
                      fallback: arabicFor,
                    })}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Location */}
          <div id="location" className="scroll-mt-16">
            <Eyebrow>{copy.text("location", "eyebrow")}</Eyebrow>
            <h3
              className="serif text-[24px] mt-2 mb-4"
              style={{ letterSpacing: "-0.012em" }}
            >
              {property.areas?.name ?? t("fallbackCity")}
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
                label={tp("noCoordinates")}
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
            eyebrow={copy.text("specification", "eyebrow")}
            heading={copy.text("specification", "heading")}
            labels={{
              permit: t("spec.permit"),
              validTo: (date) => t("spec.validTo", { date }),
              dldPlot: t("spec.dldPlot"),
            }}
            rows={specRows}
            permitNo={property.listing_permit_no}
            permitExpiry={
              extras.permitExpiresAt
                ? formatListedDate(extras.permitExpiresAt, locale)
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
              dialogCopy={dialogCopy}
              copy={{
                eyebrow: copy.text("advisor", "eyebrow"),
                enquire: copy.text("advisor", "enquire_label"),
                call: t("agent.call"),
                whatsapp: t("agent.whatsapp"),
                email: t("agent.email"),
                brn: t("agent.brn"),
                // Plain text inside a URL, so the isolates are the only way to
                // keep the reference reading `BAZ-AD-09790` in an Arabic
                // message. Identity under English.
                whatsappMessage: t("agent.whatsappMessage", {
                  name: isolateForLocale(
                    leadAdvisor.display_name.split(" ")[0] ?? "",
                    locale,
                  ),
                  reference: isolateForLocale(property.reference, locale),
                }),
                mailSubject: t("agent.mailSubject", {
                  reference: isolateForLocale(property.reference, locale),
                }),
              }}
              advisor={leadAdvisor}
              propertyId={property.id}
              propertyReference={property.reference}
            />
          ) : null}

          <div
            id="send-brief"
            className="bg-bz-surface border border-bz-border rounded-lg p-5 scroll-mt-24"
          >
            <Eyebrow>{copy.text("enquiry", "eyebrow")}</Eyebrow>
            <h4 className="serif text-[18px] mt-2 leading-tight mb-4">
              <TokenText
                template={copy.template("enquiry", "heading")}
                tokens={{
                  // Every token, so `{title}` or `{area}` typed in the CMS is
                  // filled here as it is everywhere else on the page.
                  ...copy.tokens,
                  // `whitespace-nowrap`: the Arabic sentence is longer, and
                  // the reference otherwise breaks at its hyphen — `BAZ-`
                  // on one line, `AD-09790` on the next.
                  reference: (
                    <span className="mono text-[14px] whitespace-nowrap">
                      {property.reference}
                    </span>
                  ),
                }}
              />
            </h4>
            <FormRenderer
              form={{
                ...enquiryForm,
                copy: { ...enquiryForm.copy, title: null, subtitle: null },
              }}
              // Isolated for the pre-filled message, which is a textarea —
              // see the same line in `enquiry-dialog.tsx`.
              tokens={{
                reference: isolateForLocale(property.reference, locale),
              }}
              context={{
                propertyId: property.id,
                propertyReference: property.reference,
              }}
              successStyle="soft"
              allowAnother
              toastErrors
            />
            {/* T1-E cleanup: secondary CTA — visitors who own elsewhere
                in the same area are a high-intent valuation source.

                The whole block follows the gate's switch at /admin/forms. It
                used to be only the button, so a disabled gate left the
                question standing over nothing. */}
            {valuationGate.enabled ? (
              <div className="mt-4 pt-4 border-t border-bz-border">
                <div className="text-[11px] uppercase tracking-wider text-bz-ink-2 mb-2">
                  {copy.text(
                    "enquiry",
                    "valuation_prompt",
                    property.areas ? undefined : { area: t("thisArea") },
                  )}
                </div>
                <ValuationLeadGate
                  form={valuationGate}
                  triggerLabel={copy.text("enquiry", "valuation_cta")}
                />
              </div>
            ) : null}
            {/* Permit + DLD plot moved into the Specification block, which
                now carries the full compliance line. */}
          </div>
        </aside>
      </section>

      {/* Similar */}
      {/* T1.5 quick win: property FAQ with JSON-LD FAQPage schema.
          Lifts long-tail SEO on every property page. */}
      <PropertyFaq
        locale={locale}
        eyebrow={copy.text("faq", "eyebrow")}
        heading={copy.text("faq", "heading")}
        shared={copy.faq}
        reference={property.reference}
        title={property.title}
        areaName={property.areas?.name ?? null}
        propertyType={typeLabel}
        beds={property.beds}
        baths={property.baths}
        tenure={property.tenure ?? null}
        listingPermitNo={property.listing_permit_no ?? null}
      />

      {similar.length > 0 ? (
        <section className="px-4 md:px-12 py-12 md:py-16 border-t border-bz-border">
          <Eyebrow>{copy.text("similar", "eyebrow")}</Eyebrow>
          <h2
            className="serif text-[26px] md:text-[32px] font-normal mt-2 mb-8"
            style={{ letterSpacing: "-0.02em" }}
          >
            {copy.text("similar", "heading")}
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
                  location={row.areas?.name ?? t("fallbackArea")}
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
          advisorId={leadAdvisor.user_id}
          propertyId={property.id}
          /* `{context}` is the listing's headline, not its reference. A
             visitor opening WhatsApp should see the home they were looking at;
             BAZ-AD-07620 means nothing to them and everything to us, so the
             reference stays available as its own token and is recorded on
             every click regardless. */
          contextRef={property.title}
          tokens={{
            property_title: property.title,
            reference: property.reference,
            price: formatPriceAED(property.price_aed),
            beds: property.beds === null ? null : String(property.beds),
            baths: property.baths === null ? null : String(property.baths),
            property_type: titleCase(property.type),
            area_name: property.areas?.name ?? null,
            development_name: property.developments?.name ?? null,
            advisor_title: leadAdvisor.title,
            advisor_brn: leadAdvisor.brn,
          }}
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

/**
 * A DB enum as a reader sees it: title-cased, then translated if the store
 * knows the term.
 *
 * `titleCase` alone turned `apartment` into "Apartment" and stopped, so the
 * spec table said "Apartment" under an Arabic label while شقة sat in the
 * store. `arabicFor` keeps the English for anything it has never seen —
 * Townhouse, Duplex and Plot have no entry yet, and an untranslated term is a
 * better outcome than a guessed one.
 *
 * TENURE deliberately does not use this. `Freehold` has Arabic and
 * `Leasehold`, `Usufruct` and `Musataha` do not, so one field would come back
 * half-translated; and those last two are a known collision — both render حق
 * انتفاع, which misstates what a buyer is acquiring. That is a vocabulary
 * decision for the client, tracked separately, not something to settle here.
 */
function term(value: string, locale: Locale): string {
  const english = titleCase(value);
  if (locale === DEFAULT_LOCALE) return english;
  return arabicFor(english) ?? english;
}

/**
 * The property type as it reads inside a sentence — "villa" in English, فيلا
 * in Arabic — for the FAQ and the shared questions' `{type}` token.
 *
 * Lower case in English because it sits mid-sentence ("a 4-bed villa in Al
 * Ghadeer"), which is what the FAQ has always printed. Arabic has no case, and
 * takes the store's rendering of the title-cased term, as the key-facts tile
 * does; a type the store has never seen stays English rather than guessed.
 */
function propertyTypeLabel(value: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return value.split("_").join(" ");
  return term(value, locale);
}

/**
 * The tenure tile.
 *
 * Freehold only, deliberately. It is the settled term (تملك حر, bound in
 * `lib/i18n/mt/glossary.ts`) and 63 of the 65 live listings carry it. Leasehold
 * and usufruct keep their English: the glossary renders both as حق انتفاع,
 * which is the collision the note on `term()` below describes, and splitting
 * them is the client's compliance contact's decision rather than this file's.
 */
function tenureLabel(
  tenure: string | null,
  t: (key: "tenure.freehold") => string,
): string {
  if (!tenure) return "—";
  return tenure === "freehold" ? t("tenure.freehold") : titleCase(tenure);
}

function titleCase(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * `2026-08-07` / ISO timestamp → `7 Aug 2026` / `7 أغسطس 2026`.
 *
 * The tag comes from the locale rather than being written here: this line sat
 * under "Listed" and beside a permit expiry on an otherwise fully translated
 * Arabic listing. `timeZone: "UTC"` stays — it is the reason a server and a
 * client render the same string, which is a different concern from language
 * and the one the old comment was actually about.
 */
function formatListedDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(localeDateTag(locale), {
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
