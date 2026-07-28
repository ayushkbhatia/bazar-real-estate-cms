import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listNewThisWeek } from "@/lib/queries/curated-listings";
import { BuyRentLanding } from "../_components/marketing/buy-rent-landing";
import { RentAreaMap } from "../_components/marketing/rent-area-map";
import { LeadBand } from "../_components/marketing/lead-band";
import { listingRowToCard } from "../_components/marketing/map-listing";
import { searchRedirectTarget } from "../_components/search-redirect";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { buyRentContent } from "../_components/marketing/master-content";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Rent a Property in Abu Dhabi",
  description:
    "Residential and commercial rentals across Abu Dhabi's most connected communities — matched to your budget, lifestyle, and move-in date.",
  alternates: { canonical: "/rent" },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};



export default async function RentPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const target = searchRedirectTarget("/rent", raw);
  if (target) redirect(target);

  const [content, rows] = await Promise.all([
    getMasterPageContent("rent"),
    listNewThisWeek({ limit: 4 }),
  ]);
  const featured = rows.slice(0, 4).map(listingRowToCard);

  // Copy, links, images and section order come from /admin/pages/master/rent.
  const c = buyRentContent(content);

  return (
    <BuyRentLanding
      eyebrow={c.eyebrow}
      title={c.title}
      sub={c.sub}
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
      mapSlot={<RentAreaMap />}
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
