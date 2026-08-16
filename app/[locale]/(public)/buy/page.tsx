import type { Metadata } from "next";
import {
  listExclusiveProperties,
  listNewThisWeek,
  listFeaturedByType,
} from "@/lib/queries/curated-listings";
import { listAreaPins, listAreaListingDots } from "@/lib/queries/area-map";
import { BuyRentLanding } from "../_components/marketing/buy-rent-landing";
import { listingRowToCard } from "../_components/marketing/map-listing";
import { BuyPropertiesMap } from "../_components/marketing/buy-properties-map";
import { LeadBand } from "../_components/marketing/lead-band";
import { FormRenderer } from "../_components/forms/form-renderer";
import { getForms } from "@/lib/queries/forms";
import type { BuyCategory } from "../_components/marketing/buy-category-explorer";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { str } from "@/lib/master-pages";
import { buyRentContent } from "../_components/marketing/master-content";
import { masterPageMetadata } from "@/lib/queries/search-appearance";
import { asLocale } from "@/lib/i18n/locales";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Title and description are CMS-owned: Pages & blocks → this page →
  // Search appearance. Unedited, they fall back to the strings that used
  // to be the literal here, now in MASTER_PAGE_SEO_DEFAULTS.
  return masterPageMetadata("buy", asLocale((await params).locale),
  {
    alternates: { canonical: "/buy" },
  });
}

// Old deep-links (/buy?type=apartment) are redirected to the relocated search
// route by proxy.ts. Deliberately no `searchParams` here: reading it — even
// just to await it — makes the route fully dynamic and silently discards the
// `revalidate = 300` above, which is what took this page out of the CDN.
export default async function BuyPage() {
  const [
    content,
    exclusiveRows,
    apartmentRows,
    villaRows,
    penthouseRows,
    commercialRows,
    abuDhabiPins,
    dubaiPins,
    dots,
  ] = await Promise.all([
    getMasterPageContent("buy"),
    listExclusiveProperties({ limit: 4 }),
    listFeaturedByType({ mode: "buy", type: "apartment", limit: 4 }),
    listFeaturedByType({ mode: "buy", type: "villa", limit: 4 }),
    listFeaturedByType({ mode: "buy", type: "penthouse", limit: 4 }),
    listFeaturedByType({ mode: "commercial", limit: 4 }),
    listAreaPins("abu-dhabi"),
    listAreaPins("dubai"),
    listAreaListingDots(),
  ]);

  // General featured fallback (used when a category bucket is empty).
  const fallbackRows =
    exclusiveRows.length >= 4
      ? exclusiveRows
      : await listNewThisWeek({ limit: 4 });
  const featured = fallbackRows.slice(0, 4).map(listingRowToCard);

  const featuredByCategory: Record<string, ReturnType<typeof listingRowToCard>[]> = {
    apartment: apartmentRows.slice(0, 4).map(listingRowToCard),
    villa: villaRows.slice(0, 4).map(listingRowToCard),
    penthouse: penthouseRows.slice(0, 4).map(listingRowToCard),
    commercial: commercialRows.slice(0, 4).map(listingRowToCard),
  };

  const mapAreas = [...abuDhabiPins, ...dubaiPins];

  // Copy, links, images and section order all come from the master-page editor
  // (/admin/pages/master/buy). Untouched fields fall back to the defaults in
  // lib/master-pages, which are this page's original copy.
  const c = buyRentContent(content);

  // The two lead forms on this page. Fields, order, button and confirmation
  // come from /admin/forms; a form switched off there drops its card rather
  // than leaving a heading over an empty box.
  const resolved = await getForms(["buy_hero_enquiry", "buy_lead_band"]);
  const forms = { hero: resolved["buy_hero_enquiry"]!, band: resolved["buy_lead_band"]! };

  // Map section copy — blank fields fall through to BuyPropertiesMap's own
  // defaults, which are this section's original strings.
  const map = content.section("map")?.values ?? {};

  // The hero chips drive the interactive featured grid, so their labels double
  // as category keys.
  const categories: BuyCategory[] = (c.chips ?? []).map((label) => ({
    key: label.toLowerCase(),
    label,
  }));
  const categoryCtaHref: Record<string, string> = {};
  (c.chips ?? []).forEach((label, i) => {
    const href = c.chipHrefs?.[i];
    if (href) categoryCtaHref[label.toLowerCase()] = href;
  });
  const byCategory: Record<string, ReturnType<typeof listingRowToCard>[]> = {};
  for (const category of categories) {
    byCategory[category.key] = featuredByCategory[category.key] ?? [];
  }

  return (
    <BuyRentLanding
      eyebrow={c.eyebrow}
      title={c.title}
      sub={c.sub}
      heroImageUrl={c.heroImageUrl}
      heroImageAlt={c.heroImageAlt}
      wide
      categories={categories}
      heroForm={
        forms.hero.enabled ? (
          <FormRenderer
            form={forms.hero}
            className="mt-5"
            successStyle="soft"
            allowAnother
          />
        ) : null
      }
      formTitle={c.formTitle}
      formSub={c.formSub}
      featured={featured}
      featuredByCategory={byCategory}
      featuredCtaHrefByCategory={categoryCtaHref}
      featuredTitle={c.featuredTitle}
      featuredCta={c.featuredCta}
      featuredCtaHref={c.featuredCtaHref}
      sectionOrder={c.sectionOrder}
      mapSlot={
        mapAreas.length > 0 ? (
          <BuyPropertiesMap
            areas={mapAreas}
            dots={dots}
            eyebrow={str(map, "eyebrow") ?? undefined}
            heading={str(map, "heading") ?? undefined}
            body={str(map, "body")}
          />
        ) : null
      }
      leadBand={
        <LeadBand
          form={
            forms.band.enabled ? (
              <FormRenderer
                form={forms.band}
                successStyle="soft"
                allowAnother
              />
            ) : null
          }
          eyebrow={c.lead.eyebrow}
          title={c.lead.title}
          sub={c.lead.sub}
          image={c.lead.image.label}
          imageUrl={c.lead.image.url}
          imageAlt={c.lead.image.alt}
        />
      }
      waysEyebrow={c.waysEyebrow}
      waysTitle={c.waysTitle}
      categoryTiles={c.categoryTiles}
      propTypesTitle={c.propTypesTitle}
      propTypes={c.propTypes}
      communitiesEyebrow={c.communitiesEyebrow}
      communitiesTitle={c.communitiesTitle}
      communitiesSub={c.communitiesSub}
      communityChips={c.communityChips}
      communitiesCta={c.communitiesCta}
      communitiesCtaHref={c.communitiesCtaHref}
      why={c.why}
      faqEyebrow={c.faqEyebrow}
      faqTitle={c.faqTitle}
      faqs={c.faqs}
    />
  );
}
