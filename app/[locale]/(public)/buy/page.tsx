import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import {
  listExclusiveProperties,
  listRandomListings,
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

/**
 * How many listings each featured category hands the grid. The grid shows
 * four, picked at random per visit from this pool (`CategoryFeatured`), so a
 * bucket bigger than four rotates instead of always showing its newest.
 */
const FEATURED_POOL = 24;

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
export default async function BuyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Before any other await. `getMasterPageContent` resolves its locale from
  // the request, and without this `getLocale()` has nothing to resolve — the
  // page renders English content under `lang="ar"` in an RTL layout, which is
  // the failure `lib/i18n/current.ts` describes: it looks finished.
  setRequestLocale(asLocale((await params).locale));

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
    listExclusiveProperties({ mode: "buy", limit: FEATURED_POOL }),
    listFeaturedByType({ mode: "buy", type: "apartment", limit: FEATURED_POOL }),
    listFeaturedByType({ mode: "buy", type: "villa", limit: FEATURED_POOL }),
    listFeaturedByType({ mode: "buy", type: "penthouse", limit: FEATURED_POOL }),
    listFeaturedByType({ segment: "commercial", limit: FEATURED_POOL }),
    listAreaPins("abu-dhabi"),
    listAreaPins("dubai"),
    listAreaListingDots(),
  ]);

  // The general featured row — what the grid shows whenever no category is
  // active, which is always while every hero chip is a link. Exclusives when
  // there are enough to fill it; otherwise a random sample of everything for
  // sale. Either way a pool, not four, so the grid's per-visit shuffle picks
  // from the catalogue rather than reordering the four newest listings.
  const fallbackRows =
    exclusiveRows.length >= 4
      ? exclusiveRows
      : await listRandomListings({ mode: "buy", limit: FEATURED_POOL });
  const featured = fallbackRows.map(listingRowToCard);

  const featuredByCategory: Record<string, ReturnType<typeof listingRowToCard>[]> = {
    apartment: apartmentRows.map(listingRowToCard),
    villa: villaRows.map(listingRowToCard),
    penthouse: penthouseRows.map(listingRowToCard),
    commercial: commercialRows.map(listingRowToCard),
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

  // The hero chips' labels double as the featured grid's category keys. A
  // chip with a link goes to that type's search results; one without stays a
  // toggle for the grid.
  const categories: BuyCategory[] = (c.chips ?? []).map((label, i) => ({
    key: label.toLowerCase(),
    label,
    href: c.chipHrefs?.[i],
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
            // Opens on who they are and what they want — name, phone and
            // email, purpose, type and bedrooms — and unfolds the rest of the
            // brief once they start answering. About half the card's height.
            foldAfterRows={4}
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
            ctaLabel={str(map, "cta") ?? undefined}
            ctaHref={str(map, "cta_href") ?? undefined}
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
