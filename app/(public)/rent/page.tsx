import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listNewThisWeek } from "@/lib/queries/curated-listings";
import { BuyRentLanding } from "../_components/marketing/buy-rent-landing";
import { RentAreaMap } from "../_components/marketing/rent-area-map";
import { LeadBand } from "../_components/marketing/lead-band";
import { listingRowToCard } from "../_components/marketing/map-listing";
import { searchRedirectTarget } from "../_components/search-redirect";
import {
  AD_COMMUNITIES,
  SALE_PROP_TYPES,
} from "../_components/marketing/ad-data";

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

const RENT_TYPE_HREF: Record<string, string> = {
  Apartments: "/rent/search?type=apartment",
  Villas: "/rent/search?type=villa",
  Townhouses: "/rent/search?type=townhouse",
  Penthouses: "/rent/search?type=penthouse",
  "Commercial Properties": "/commercial",
};

// Hero quick-filter chips → search. Residential types deep-link into the
// rent search; commercial formats (offices, retail) route to /commercial.
const RENT_CHIPS = [
  "Apartments",
  "Villas",
  "Townhouses",
  "Offices",
  "Retail",
] as const;
const RENT_CHIP_HREF: Record<(typeof RENT_CHIPS)[number], string> = {
  Apartments: "/rent/search?type=apartment",
  Villas: "/rent/search?type=villa",
  Townhouses: "/rent/search?type=townhouse",
  Offices: "/commercial",
  Retail: "/commercial",
};

export default async function RentPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const target = searchRedirectTarget("/rent", raw);
  if (target) redirect(target);

  const featured = (await listNewThisWeek({ limit: 4 }))
    .slice(0, 4)
    .map(listingRowToCard);

  return (
    <BuyRentLanding
      eyebrow="Rent a Property"
      title={
        <>
          Find your next
          <br />
          rental in <em className="italic">Abu Dhabi.</em>
        </>
      }
      sub="Residential and commercial rentals across the city's most connected communities — matched to your budget, lifestyle and move-in date."
      wide
      chips={[...RENT_CHIPS]}
      chipHrefs={RENT_CHIPS.map((c) => RENT_CHIP_HREF[c])}
      stats={[
        ["Residential", "& commercial"],
        ["8", "popular rental areas"],
        ["Vacant", "ready-to-move options"],
      ]}
      formTitle="Rent a Property"
      formSub="Tell us what you're looking for and our team will find the right rental for you."
      featured={featured}
      featuredTitle="Featured properties for rent"
      featuredCta="Browse all for rent"
      featuredCtaHref="/rent/search"
      mapSlot={<RentAreaMap />}
      leadBand={
        <LeadBand
          eyebrow="Get matched"
          title="Tell us what you're looking to rent."
          sub="Share your budget, preferred areas and move-in date — an advisor will send you matched rentals, usually within one business day."
          image="Abu Dhabi rental interiors"
        />
      }
      waysEyebrow=""
      waysTitle=""
      categoryTiles={[]}
      propTypesTitle="Rentals for every kind of tenant."
      propTypes={SALE_PROP_TYPES.map(([name, desc]) => ({
        name,
        desc,
        cta: "View rentals",
        href: RENT_TYPE_HREF[name] ?? "/rent/search",
      }))}
      communitiesEyebrow="Popular rental areas"
      communitiesTitle="Rent in Abu Dhabi's leading communities."
      communitiesSub="Explore rental properties across Abu Dhabi's most popular residential and lifestyle destinations."
      communityChips={[...AD_COMMUNITIES]}
      communitiesCta="Explore rental locations"
      why={{
        title: "Local knowledge that turns a search into the right home.",
        body: "With deep local market knowledge and experience across residential and commercial properties, Bazar Real Estate helps tenants find the right rental option with clarity and confidence — from shortlist to move-in.",
        stats: [
          ["Homes + offices", "Residential & commercial"],
          ["Budget-led", "Location recommendations"],
        ],
      }}
      faqEyebrow="Renting with Bazar"
      faqTitle="Questions, answered."
      faqs={[
        [
          "Can Bazar help me find both residential and commercial rentals?",
          "Yes. We assist with homes, apartments, villas, offices, retail spaces, and other commercial rentals.",
        ],
        [
          "What documents do tenants usually need?",
          "Tenants usually need identification documents, contact details, and payment information.",
        ],
        [
          "Can I rent a ready-to-move property?",
          "Yes. We can help you find vacant and ready-to-move rental options.",
        ],
        [
          "Can Bazar help with location recommendations?",
          "Yes. We can suggest areas based on your budget, lifestyle, commute, and property needs.",
        ],
      ]}
    />
  );
}
