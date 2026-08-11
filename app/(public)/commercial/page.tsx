import type { Metadata } from "next";
import { listFeaturedByType } from "@/lib/queries/curated-listings";
import { BuyRentLanding } from "../_components/marketing/buy-rent-landing";
import { RentAreaMap } from "../_components/marketing/rent-area-map";
import { LeadBand } from "../_components/marketing/lead-band";
import { listingRowToCard } from "../_components/marketing/map-listing";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { str } from "@/lib/master-pages";
import { buyRentContent } from "../_components/marketing/master-content";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Commercial Property in Abu Dhabi",
  description:
    "Office, retail, and industrial leases and freeholds across Abu Dhabi's business districts — advised on whole cost of occupancy, not headline rent.",
  alternates: { canonical: "/commercial" },
};

// Old deep-links (/commercial?type=office) are redirected to /commercial/search
// by proxy.ts. Deliberately no `searchParams` here: reading it — even just to
// await it — makes the route fully dynamic and discards the `revalidate` above.
// This page was landing-and-search in one file, which is why it was the last
// marketing route that could never be cached.
export default async function CommercialPage() {
  const [content, rows] = await Promise.all([
    getMasterPageContent("commercial"),
    listFeaturedByType({ mode: "commercial", limit: 4 }),
  ]);
  const featured = rows.slice(0, 4).map(listingRowToCard);

  // Copy, links, images and section order come from
  // /admin/pages/master/commercial. Untouched fields fall back to the defaults
  // in lib/master-pages, which are this page's original copy.
  const c = buyRentContent(content);

  // Map section copy — blank fields fall through to RentAreaMap's own defaults.
  const map = content.section("map")?.values ?? {};

  return (
    <BuyRentLanding
      eyebrow={c.eyebrow}
      title={c.title}
      sub={c.sub}
      heroImageUrl={c.heroImageUrl}
      heroImageAlt={c.heroImageAlt}
      wide
      chips={c.chips}
      chipHrefs={c.chipHrefs}
      stats={c.stats}
      formTitle={c.formTitle}
      formSub={c.formSub}
      featured={featured}
      featuredTitle={c.featuredTitle}
      featuredCta={c.featuredCta}
      featuredCtaHref={c.featuredCtaHref}
      sectionOrder={c.sectionOrder}
      mapSlot={
        <RentAreaMap
          eyebrow={str(map, "eyebrow") ?? undefined}
          heading={str(map, "heading") ?? undefined}
          body={str(map, "body")}
        />
      }
      mapAbove
      leadBand={
        <LeadBand
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
