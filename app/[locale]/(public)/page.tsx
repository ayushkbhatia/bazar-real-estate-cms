import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  listPublishedProperties,
  propertyUrl,
  type ListingRow,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import { getPublicSiteSettings } from "@/lib/queries/site-settings";
import {
  HeroForVariant,
  type HeroVariant,
} from "./_components/hero-variants";
import { AreaMapSection } from "./_components/area-map-section";
import { ListingCardPriced } from "./_components/listing-card-priced";
import { CarouselGrid } from "@/components/brand/mobile";
import { LocationBrowsing } from "./_components/home/location-browsing";
import { OffPlanProjects } from "./_components/home/off-plan-projects";
import { ListYourProperty } from "./_components/home/list-your-property";
import { MortgageCalculatorSection } from "./_components/home/mortgage-calculator-section";
import { WhoWeAre } from "./_components/home/who-we-are";
import { DevelopersSection } from "./_components/developers-section";
import { PartnerEcosystemSection } from "./_components/partner-ecosystem-section";
import { HomeFaqs } from "./_components/home/home-faqs";
import { HomeTestimonials } from "./_components/home/home-testimonials";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { getForm } from "@/lib/queries/forms";
import { listPropertiesByReference } from "@/lib/queries/featured-properties";
import { HOME_FEATURED_LISTING_COUNT } from "./_components/home/section-copy";
import { faqPairs, img, list, statPairs, str } from "@/lib/master-pages";
import { masterPageMetadata } from "@/lib/queries/search-appearance";
import { asLocale } from "@/lib/i18n/locales";

export const revalidate = 60;

/**
 * The home page never declared its own metadata — it inherited the root
 * layout's `title.default` and `description`, which is exactly why it was the
 * page an editor could not touch. Those two strings are now the fallback in
 * MASTER_PAGE_SEO_DEFAULTS and the CMS can override them; with nothing saved
 * the head is byte-identical to what it was.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return masterPageMetadata("home", asLocale((await params).locale));
}

const VALID_VARIANTS: HeroVariant[] = [
  "fullbleed",
  "editorial",
  "map",
  "concierge",
];

function badgeFor(row: ListingRow):
  | { label: string; kind: "ink" | "accent" }
  | undefined {
  if (row.flags?.exclusive) return { label: "Exclusive", kind: "ink" };
  if (row.flags?.vacant_on_transfer)
    return { label: "Vacant on transfer", kind: "accent" };
  return undefined;
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Before any other await. `getMasterPageContent` resolves its locale from
  // the request, and without this `getLocale()` has nothing to resolve — the
  // page renders English content under `lang="ar"` in an RTL layout, which is
  // the failure `lib/i18n/current.ts` describes: it looks finished.
  setRequestLocale(asLocale((await params).locale));

  const [{ rows: latest }, settings, content, listForm] = await Promise.all([
    listPublishedProperties({ mode: "buy", limit: HOME_FEATURED_LISTING_COUNT }),
    getPublicSiteSettings(),
    getMasterPageContent("home"),
    getForm("home_list_property"),
  ]);

  // Hero variant is driven entirely by site_settings now — the page used to
  // also accept a `?hero=` querystring override, but reading `searchParams`
  // (even just to await it) forces Next.js to treat the whole route as fully
  // dynamic, which silently discards the `revalidate = 60` above and disables
  // static/ISR caching for the home page. To preview a different hero, change
  // it in /admin/settings/brand instead.
  const settingsVariant = settings.display?.hero_variant;
  const variant: HeroVariant = VALID_VARIANTS.includes(
    settingsVariant as HeroVariant,
  )
    ? (settingsVariant as HeroVariant)
    : "fullbleed";

  // Section copy, links, images and order come from
  // /admin/pages/master/home. Anything untouched falls back to the literals
  // the components ship with.
  const v = (key: string) => content.section(key)?.values ?? {};
  const heroV = v("hero");
  const areaMapV = v("area_map");
  const locationV = v("location_browsing");
  const offPlanV = v("off_plan_projects");
  const featuredV = v("featured_properties");
  const listV = v("list_your_property");
  const mortgageV = v("mortgage_calculator");
  const whoV = v("who_we_are");
  const faqV = v("faqs");
  const testimonialsV = v("testimonials");
  const listImage = img(listV, "image");
  const whoImage = img(whoV, "photo");
  const heroVideo = img(heroV, "video");
  const heroPoster = img(heroV, "poster");

  // Listings curated in the home master page, in the order they were picked.
  // Anything that no longer resolves — unpublished, deleted — drops out, and
  // an empty list keeps the most recent published listings for sale.
  const curatedRefs = list<Record<string, unknown>>(featuredV, "listings")
    .filter((l) => l.enabled !== false)
    .map((l) => (typeof l.slug === "string" ? l.slug : ""))
    .filter(Boolean);
  const curated = await listPropertiesByReference(curatedRefs);
  const featured = curated.length > 0 ? curated : latest;
  const overviewImage = img(locationV, "overview_image");

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <HeroForVariant
        key="hero"
        variant={variant}
        copy={{
          eyebrow: str(heroV, "eyebrow"),
          title: str(heroV, "title"),
          subtitle: str(heroV, "subtitle"),
          link1: {
            label: str(heroV, "link_1_label"),
            href: str(heroV, "link_1_href"),
          },
          link2: {
            label: str(heroV, "link_2_label"),
            href: str(heroV, "link_2_href"),
          },
          media: {
            videoUrl: heroVideo?.url ?? null,
            videoMime: heroVideo?.mime ?? null,
            posterUrl: heroPoster?.url ?? null,
          },
        }}
      />
    ),

    area_map: (
      <AreaMapSection
        key="area_map"
        eyebrow={str(areaMapV, "eyebrow")}
        heading={str(areaMapV, "heading")}
        body={str(areaMapV, "body")}
      />
    ),

    location_browsing: (
      <LocationBrowsing
        key="location_browsing"
        eyebrow={str(locationV, "eyebrow")}
        heading={str(locationV, "heading")}
        body={str(locationV, "body")}
        ctaLabel={str(locationV, "cta_label")}
        ctaHref={str(locationV, "cta_href")}
        overviewName={str(locationV, "overview_name")}
        overviewHref={str(locationV, "overview_href")}
        overviewImageUrl={overviewImage?.url ?? null}
        overviewImageAlt={overviewImage?.alt ?? null}
        overviewImageLabel={overviewImage?.label ?? null}
        cards={list<Record<string, unknown>>(locationV, "cards").map((c) => {
          const image = (c.image ?? null) as {
            url?: string | null;
            alt?: string | null;
            label?: string | null;
          } | null;
          return {
            enabled: c.enabled !== false,
            name: typeof c.name === "string" ? c.name : null,
            href: typeof c.href === "string" ? c.href : null,
            slug: typeof c.slug === "string" ? c.slug : null,
            imageUrl: image?.url ?? null,
            imageAlt: image?.alt ?? null,
            imageLabel: image?.label ?? null,
          };
        })}
      />
    ),

    off_plan_projects: (
      <OffPlanProjects
        key="off_plan_projects"
        featuredSlugs={list<Record<string, unknown>>(offPlanV, "projects")
          .filter((p) => p.enabled !== false)
          .map((p) => (typeof p.slug === "string" ? p.slug : ""))
          .filter(Boolean)}
        eyebrow={str(offPlanV, "eyebrow")}
        heading={str(offPlanV, "heading")}
        body={str(offPlanV, "body")}
        ctaLabel={str(offPlanV, "cta_label")}
        ctaHref={str(offPlanV, "cta_href")}
      />
    ),

    featured_properties: (
      <section key="featured_properties" className="px-4 md:px-12 py-14 md:py-20">
        <div className="mb-8 flex flex-col gap-5 md:mb-11 md:flex-row md:items-end md:justify-between">
          <div>
            <div
              className="text-[11px] font-medium uppercase text-bz-muted"
              style={{ letterSpacing: "0.12em" }}
            >
              {str(featuredV, "eyebrow")}
            </div>
            <h2 className="serif mt-2 text-[28px] md:text-[44px] font-normal leading-[1.05] tracking-tight">
              {str(featuredV, "heading")}
            </h2>
            <p className="mt-4 max-w-[56ch] text-[14.5px] md:text-[15.5px] text-bz-ink-2 leading-relaxed">
              {str(featuredV, "body")}
            </p>
          </div>
          {str(featuredV, "cta_label") ? (
            <Button asChild variant="outline" className="self-start">
              <Link href={str(featuredV, "cta_href") ?? "/buy/search"}>
                {str(featuredV, "cta_label")}
              </Link>
            </Button>
          ) : null}
        </div>
        {featured.length > 0 ? (
            <CarouselGrid cols={3}>
              {featured.map((row, index) => {
                const badge = badgeFor(row);
                return (
                  <Link
                    key={row.reference}
                    href={propertyUrl(row)}
                    className="block"
                  >
                    <ListingCardPriced
                      priceAed={row.price_aed}
                      title={row.title}
                      location={row.areas?.name ?? "United Arab Emirates"}
                      beds={row.beds}
                      baths={row.baths}
                      area={row.built_up_ft2 ?? 0}
                      badge={badge?.label}
                      badgeKind={badge?.kind}
                      imgLabel={row.reference}
                      heroSrc={
                        row.hero ? mediaPublicUrl(row.hero.storage_key) : null
                      }
                      heroAlt={row.hero?.alt_text ?? row.title}
                      priority={index === 0}
                      propertyId={row.id}
                    />
                  </Link>
                );
              })}
            </CarouselGrid>
        ) : (
          <p className="text-bz-muted text-[14px]">
            Listings appear here once published. Seed the database to see real
            entries.
          </p>
        )}
      </section>
    ),

    list_your_property: listForm.enabled ? (
      <ListYourProperty
        key="list_your_property"
        form={listForm}
        eyebrow={str(listV, "eyebrow")}
        heading={str(listV, "heading")}
        body={str(listV, "body")}
        imageUrl={listImage?.url ?? null}
        imageAlt={listImage?.alt ?? null}
        imageLabel={listImage?.label ?? null}
      />
    ) : null,

    mortgage_calculator: (
      <MortgageCalculatorSection
        key="mortgage_calculator"
        eyebrow={str(mortgageV, "eyebrow")}
        heading={str(mortgageV, "heading")}
      />
    ),

    who_we_are: (
      <WhoWeAre
        key="who_we_are"
        eyebrow={str(whoV, "eyebrow")}
        heading={str(whoV, "heading")}
        body={str(whoV, "body")}
        stats={statPairs(whoV)}
        imageUrl={whoImage?.url ?? null}
        imageAlt={whoImage?.alt ?? null}
        imageLabel={whoImage?.label ?? null}
      />
    ),

    developers: <DevelopersSection key="developers" />,
    partners: <PartnerEcosystemSection key="partners" />,

    faqs: (
      <HomeFaqs
        key="faqs"
        eyebrow={str(faqV, "eyebrow")}
        heading={str(faqV, "heading")}
        body={str(faqV, "body")}
        items={faqPairs(faqV)}
      />
    ),

    testimonials: (
      <HomeTestimonials
        key="testimonials"
        eyebrow={str(testimonialsV, "eyebrow")}
        heading={str(testimonialsV, "heading")}
      />
    ),
  };

  return (
    <div className="bg-bz-bg">
      {content.order.map((key) => (
        <React.Fragment key={key}>{nodes[key] ?? null}</React.Fragment>
      ))}
    </div>
  );
}
