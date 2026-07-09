import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  listExclusiveProperties,
  listNewThisWeek,
} from "@/lib/queries/curated-listings";
import { BuyRentLanding } from "../_components/marketing/buy-rent-landing";
import { listingRowToCard } from "../_components/marketing/map-listing";
import { searchRedirectTarget } from "../_components/search-redirect";
import {
  AD_COMMUNITIES,
  SALE_PROP_TYPES,
} from "../_components/marketing/ad-data";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Buy a Property in Abu Dhabi",
  description:
    "Find the right property with confidence — ready, resale and off-plan homes across Abu Dhabi's most sought-after communities, with a senior advisor guiding every step.",
  alternates: { canonical: "/buy" },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TYPE_PARAM: Record<string, string> = {
  Apartments: "/buy/search?type=apartment",
  Villas: "/buy/search?type=villa",
  Townhouses: "/buy/search?type=townhouse",
  Penthouses: "/buy/search?type=penthouse",
  "Commercial Properties": "/commercial",
};

export default async function BuyPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  // Old deep-links (/buy?type=apartment) → the relocated search route.
  const target = searchRedirectTarget("/buy", raw);
  if (target) redirect(target);

  const rows =
    (await listExclusiveProperties({ limit: 4 })).slice(0, 4) ?? [];
  const featured = (
    rows.length >= 4 ? rows : await listNewThisWeek({ limit: 4 })
  )
    .slice(0, 4)
    .map(listingRowToCard);

  return (
    <BuyRentLanding
      eyebrow="Buy a Property"
      title={
        <>
          Find the right property
          <br />
          with <em className="italic">confidence.</em>
        </>
      }
      sub="Browse ready, resale and off-plan homes across Abu Dhabi's most sought-after communities — with a senior advisor guiding every step."
      chips={["Off-Plan", "Resale", "Ready-to-Move", "Commercial"]}
      stats={[
        ["20+ yrs", "UAE market experience"],
        ["8", "leading communities"],
        ["9", "developer partners"],
      ]}
      formTitle="Start your property search"
      formSub="Tell us what you're looking for, and our team will help you find the right opportunity."
      featured={featured}
      featuredTitle="Featured properties for sale"
      featuredCta="Browse all for sale"
      featuredCtaHref="/buy/search"
      waysEyebrow="Ways to buy"
      waysTitle="What type of property are you looking for?"
      categoryTiles={[
        {
          name: "Off-Plan Properties",
          desc: "New launches with structured payment plans.",
          cta: "Browse off-plan",
          img: "off-plan tower · render",
          href: "/off-plan",
        },
        {
          name: "Resale Properties",
          desc: "Established homes ready for handover.",
          cta: "Browse resale",
          img: "resale apartment",
          href: "/buy/search",
        },
        {
          name: "Ready-to-Move Properties",
          desc: "Vacant, keys-in-hand homes.",
          cta: "Browse ready",
          img: "ready villa · interior",
          href: "/buy/search",
        },
        {
          name: "Commercial Properties",
          desc: "Offices, retail and land.",
          cta: "Browse commercial",
          img: "commercial tower",
          href: "/commercial",
        },
      ]}
      propTypesTitle="A home for every stage."
      propTypes={SALE_PROP_TYPES.map(([name, desc]) => ({
        name,
        desc,
        cta: name === "Commercial Properties" ? "Browse commercial" : `Browse ${name.toLowerCase()}`,
        href: TYPE_PARAM[name] ?? "/buy/search",
      }))}
      communitiesEyebrow="Where to buy"
      communitiesTitle="Abu Dhabi's leading communities."
      communitiesSub="Explore properties across Abu Dhabi's most popular residential and lifestyle destinations."
      communityChips={[...AD_COMMUNITIES]}
      communitiesCta="Explore all locations"
      why={{
        title: "Two decades of Abu Dhabi expertise, on your side.",
        body: "With over 20 years of UAE real estate experience, Bazar Real Estate combines local market knowledge, developer relationships, and client-focused guidance to help you make confident property decisions — whether you're buying your first home or your fifth investment.",
        stats: [
          ["20+ yrs", "In the UAE market"],
          ["Ready + off-plan", "Full-market access"],
        ],
      }}
      faqEyebrow="Buying with Bazar"
      faqTitle="Questions, answered."
      faqs={[
        [
          "Can Bazar help me buy both ready and off-plan properties?",
          "Yes. We assist with ready, resale, and off-plan property purchases across Abu Dhabi and the wider UAE.",
        ],
        [
          "Can I buy property in Abu Dhabi as a foreigner?",
          "Foreign buyers can purchase property in designated investment areas in Abu Dhabi.",
        ],
        [
          "Do I need mortgage approval before searching?",
          "It is recommended if you plan to finance your purchase, as it helps define your budget clearly.",
        ],
        [
          "Can Bazar help with investment properties?",
          "Yes. We can guide you based on location, rental demand, developer reputation, and long-term value.",
        ],
      ]}
    />
  );
}
