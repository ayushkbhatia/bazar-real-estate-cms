import * as React from "react";
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
import { getMasterPageContent } from "@/lib/queries/master-pages";
import {
  faqPairs,
  img,
  list,
  statPairs,
  str,
  type ImageValue,
} from "@/lib/master-pages";
import { chipLines, headlineParts } from "@/lib/master-pages/text";

export const metadata: Metadata = {
  title: "Areas in Abu Dhabi",
  description:
    "From waterfront destinations to family-friendly neighbourhoods, discover the Abu Dhabi areas that define living and investing in the capital.",
  alternates: { canonical: "/areas" },
};

export const revalidate = 300;

/** Image fields arrive as `{ media_id, alt, label, url }`; components want flat props. */
function imageProps(value: unknown): {
  imageUrl: string | null;
  imageAlt: string | null;
  imageLabel: string | null;
} {
  const v = (value ?? null) as ImageValue | null;
  return {
    imageUrl: v?.url ?? null,
    imageAlt: v?.alt ?? null,
    imageLabel: v?.label ?? null,
  };
}

const s = (v: unknown): string | null => (typeof v === "string" ? v : null);

export default async function AreasPage() {
  const content = await getMasterPageContent("areas");
  const v = (key: string) => content.section(key)?.values ?? {};

  const heroV = v("hero");
  const cardsV = v("area_cards");
  const spotlightsV = v("area_spotlights");
  const listV = v("list_your_property");
  const typesV = v("community_types");
  const whyV = v("why_bazar");
  const faqV = v("faqs");

  const { lead, last } = headlineParts(
    str(heroV, "title") ?? "Explore Abu Dhabi's leading communities.",
  );
  const listImage = img(listV, "image");

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <section
        key="hero"
        className="px-4 pt-12 pb-10 md:px-12 md:pt-20 md:pb-12"
      >
        {str(heroV, "eyebrow") ? (
          <Eyebrow>{str(heroV, "eyebrow")}</Eyebrow>
        ) : null}
        <h1
          className="serif mt-3.5 max-w-[1000px]"
          style={{
            fontSize: fluid(84),
            letterSpacing: "-0.03em",
            lineHeight: 0.98,
          }}
        >
          {lead ? `${lead} ` : null}
          <em className="italic">{last}</em>
        </h1>
        {str(heroV, "subtitle") ? (
          <p className="mt-5 max-w-[680px] text-[16px] leading-relaxed text-bz-ink-2 md:text-[18px]">
            {str(heroV, "subtitle")}
          </p>
        ) : null}
      </section>
    ),

    area_cards: (
      <AreaCards
        key="area_cards"
        cards={list<Record<string, unknown>>(cardsV, "cards").map((c) => ({
          enabled: c.enabled !== false,
          name: s(c.name),
          href: s(c.href),
          slug: s(c.slug),
          ...imageProps(c.image),
        }))}
      />
    ),

    area_map: <AreaMapSection key="area_map" />,

    area_spotlights: (
      <AreaSpotlights
        key="area_spotlights"
        eyebrow={str(spotlightsV, "eyebrow")}
        heading={str(spotlightsV, "heading")}
        sub={str(spotlightsV, "sub")}
        tileEyebrow={str(spotlightsV, "tile_eyebrow")}
        items={list<Record<string, unknown>>(spotlightsV, "items").map((i) => {
          const image = imageProps(i.image);
          return {
            enabled: i.enabled !== false,
            name: s(i.name),
            blurb: s(i.blurb),
            href: s(i.href),
            ...image,
            imageLabel: s(i.img) ?? image.imageLabel,
          };
        })}
      />
    ),

    list_your_property: (
      <ListYourProperty
        key="list_your_property"
        eyebrow={str(listV, "eyebrow")}
        heading={str(listV, "heading")}
        body={str(listV, "body")}
        imageUrl={listImage?.url ?? null}
        imageAlt={listImage?.alt ?? null}
        imageLabel={listImage?.label ?? null}
      />
    ),

    community_types: (
      <CommunityTypes
        key="community_types"
        eyebrow={str(typesV, "eyebrow")}
        heading={str(typesV, "heading")}
        sub={str(typesV, "sub")}
        items={list<Record<string, unknown>>(typesV, "items").map((t) => {
          const image = imageProps(t.image);
          return {
            enabled: t.enabled !== false,
            name: s(t.name),
            tagline: s(t.tagline),
            about: s(t.about),
            chips: chipLines(t.chips),
            chipsLabel: s(t.chips_label),
            ctaLabel: s(t.cta_label),
            ctaHref: s(t.cta_href),
            ...image,
            imageLabel: s(t.img) ?? image.imageLabel,
          };
        })}
      />
    ),

    why_bazar: (
      <WhyBand
        key="why_bazar"
        wide
        eyebrow={str(whyV, "eyebrow") ?? undefined}
        title={str(whyV, "title") ?? ""}
        body={str(whyV, "body") ?? ""}
        stats={statPairs(whyV)}
      />
    ),

    faqs: (
      <section key="faqs" className="px-4 py-14 md:px-12 md:py-20">
        <SectionHead
          eyebrow={str(faqV, "eyebrow") ?? undefined}
          title={str(faqV, "heading") ?? ""}
          sub={str(faqV, "sub") ?? undefined}
          size={40}
          className="mb-2"
        />
        <Faq items={faqPairs(faqV)} />
      </section>
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
