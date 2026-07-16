import type { Metadata } from "next";
import { Eyebrow } from "@/components/brand/eyebrow";
import { fluid } from "../_components/marketing/fluid";
import { SectionHead } from "../_components/marketing/section-head";
import { Faq } from "../_components/marketing/faq";
import { WhyBand } from "../_components/marketing/why-band";
import { AreaMapSection } from "../_components/area-map-section";
import { ListYourProperty } from "../_components/home/list-your-property";
import { AreaCards } from "./_components/area-cards";
import { AreaSpotlights } from "./_components/area-spotlights";
import { CommunityTypes } from "./_components/community-types";

export const metadata: Metadata = {
  title: "Areas in Abu Dhabi",
  description:
    "From waterfront destinations to family-friendly neighbourhoods, discover the Abu Dhabi areas that define living and investing in the capital.",
  alternates: { canonical: "/areas" },
};

export const revalidate = 300;

const AREAS_FAQ: [string, string][] = [
  [
    "Which are the best areas to invest in Abu Dhabi?",
    "It depends on your goal. Saadiyat Island and Al Reem Island are perennial favourites for capital appreciation and rental demand, while emerging destinations like Hudayriyat Island offer earlier entry points. Our advisors can match an area to your budget, timeline, and whether you're buying to live or to let.",
  ],
  [
    "Can foreigners buy property in these areas?",
    "Yes. Abu Dhabi allows foreign nationals to own freehold property in designated investment zones, which cover most of the islands and communities featured here — including Saadiyat, Al Reem, Yas, and Al Raha Beach.",
  ],
  [
    "What's the difference between an investment zone and a freehold area?",
    "In Abu Dhabi's designated investment zones, non-UAE nationals can hold freehold ownership of the property and the land. Elsewhere, foreign ownership is typically structured as long-term leasehold or usufruct. Every area guide notes its ownership terms.",
  ],
  [
    "Which areas are best for families?",
    "Gated, low-rise communities with schools and parks nearby tend to suit families best — Yas Acres, Al Raha Gardens, Saadiyat Lagoons, and Bloom Living are common choices. Filter by the family-friendly community type above to see the full list.",
  ],
  [
    "Which areas offer the strongest rental yields?",
    "Higher-density waterfront communities such as Al Reem Island typically post the strongest gross yields thanks to steady tenant demand, while premium addresses trade yield for capital growth. Each area guide shows median prices and recent market movement.",
  ],
  [
    "How do I choose between a waterfront and a gated community?",
    "Waterfront communities lead on views, promenades, and lifestyle; gated communities lead on privacy, security, and space for families. Tell an advisor how you want to live and we'll shortlist areas that fit — often across both categories.",
  ],
];

export default function AreasPage() {
  return (
    <div className="bg-bz-bg">
      {/* Hero */}
      <section className="px-4 pt-12 pb-10 md:px-12 md:pt-20 md:pb-12">
        <Eyebrow>Abu Dhabi Locations</Eyebrow>
        <h1
          className="serif mt-3.5 max-w-[1000px]"
          style={{
            fontSize: fluid(84),
            letterSpacing: "-0.03em",
            lineHeight: 0.98,
          }}
        >
          Explore Abu Dhabi&apos;s
          <br />
          leading <em className="italic">communities.</em>
        </h1>
        <p className="mt-5 max-w-[680px] text-[16px] leading-relaxed text-bz-ink-2 md:text-[18px]">
          From waterfront destinations to family-friendly neighbourhoods,
          discover the areas that define living and investing in the capital.
        </p>
      </section>

      {/* 4×2 clickable area cards */}
      <AreaCards />

      {/* Interactive area map */}
      <AreaMapSection />

      {/* Featured area spotlights */}
      <AreaSpotlights />

      {/* Lead capture */}
      <ListYourProperty />

      {/* Community types (repositioned here) */}
      <CommunityTypes />

      {/* Why Bazar */}
      <WhyBand
        wide
        title="Two decades of Abu Dhabi expertise, on your side."
        body="With over 20 years in the UAE market, Bazar pairs street-level knowledge of every Abu Dhabi community with developer relationships and honest, client-first guidance — so you choose an area with conviction, not guesswork."
        stats={[
          ["20+ yrs", "In the UAE market"],
          ["Every district", "Abu Dhabi coverage"],
        ]}
      />

      {/* Areas FAQ */}
      <section className="px-4 py-14 md:px-12 md:py-20">
        <SectionHead
          eyebrow="Areas FAQ"
          title="Questions about Abu Dhabi's areas."
          sub="The essentials on ownership, investment, and choosing where to live."
          size={40}
          className="mb-2"
        />
        <Faq items={AREAS_FAQ} />
      </section>
    </div>
  );
}
