import { Eyebrow } from "@/components/brand/eyebrow";
import type { ListingCardProps } from "@/components/brand/listing-card";
import { EnquiryForm } from "../enquiry-form";
import { fluid } from "./fluid";
import { SectionHead } from "./section-head";
import { FeaturedListings } from "./featured-listings";
import { CategoryTiles, type CategoryTile } from "./category-tiles";
import { PropTypeGrid, type PropType } from "./prop-type-grid";
import { ChipCloud } from "./chip-cloud";
import { WhyBand } from "./why-band";
import { Faq } from "./faq";

export type BuyRentLandingProps = {
  eyebrow: string;
  title: React.ReactNode;
  sub: string;
  chips: string[];
  stats: [string, string][];
  formTitle: string;
  formSub: string;
  featured: ListingCardProps[];
  featuredTitle: string;
  featuredCta: string;
  featuredCtaHref: string;
  waysEyebrow: string;
  waysTitle: string;
  categoryTiles: CategoryTile[];
  propTypesTitle: string;
  propTypes: PropType[];
  communitiesEyebrow: string;
  communitiesTitle: string;
  communitiesSub: string;
  communityChips: string[];
  communitiesCta: string;
  why: { title: React.ReactNode; body: string; stats: [string, string][] };
  faqEyebrow: string;
  faqTitle: string;
  faqs: [string, string][];
};

const SECTION = "px-4 md:px-12 py-14 md:py-[72px] border-t border-bz-border";
const WRAP = "max-w-[1200px]";

/**
 * Shared marketing landing for /buy and /rent — the handoff's Buy/Rent master
 * pages. Search itself lives at /buy/search and /rent/search; this page funnels
 * into it via the category tiles, property-type cards, and lead form.
 */
export function BuyRentLanding(p: BuyRentLandingProps) {
  return (
    <div className="bg-bz-bg">
      {/* Hero + lead form */}
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-14 md:pb-[72px]">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-10 lg:gap-16 items-center max-w-[1280px]">
          <div>
            <Eyebrow>{p.eyebrow}</Eyebrow>
            <h1
              className="serif mt-3.5"
              style={{
                fontSize: fluid(76),
                letterSpacing: "-0.03em",
                lineHeight: 0.98,
              }}
            >
              {p.title}
            </h1>
            <p className="text-[16px] md:text-[17px] text-bz-ink-2 max-w-[520px] leading-relaxed mt-5">
              {p.sub}
            </p>
            <div className="flex flex-wrap gap-2 mt-7">
              {p.chips.map((c, i) => (
                <span
                  key={c}
                  className={
                    "inline-flex items-center h-9 px-4 rounded-full border text-[13px] " +
                    (i === 0
                      ? "bg-bz-ink text-bz-bg border-bz-ink"
                      : "bg-bz-surface text-bz-ink-2 border-bz-border")
                  }
                >
                  {c}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-8 md:gap-12 mt-10 pt-8 border-t border-bz-border">
              {p.stats.map(([v, l]) => (
                <div key={l}>
                  <div
                    className="serif"
                    style={{ fontSize: fluid(32), letterSpacing: "-0.02em" }}
                  >
                    {v}
                  </div>
                  <div className="text-[12.5px] text-bz-muted mt-0.5">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-bz-border bg-bz-surface p-6 md:p-8 bz-shadow-1">
            <div
              className="serif text-[24px] md:text-[26px]"
              style={{ letterSpacing: "-0.015em" }}
            >
              {p.formTitle}
            </div>
            <p className="text-[13.5px] text-bz-muted mt-2 leading-relaxed">
              {p.formSub}
            </p>
            <EnquiryForm source="contact_page" showIntent className="mt-5" />
          </div>
        </div>
      </section>

      {/* Featured listings */}
      {p.featured.length > 0 ? (
        <section className={SECTION}>
          <div className={WRAP}>
            <FeaturedListings
              eyebrow="Handpicked"
              title={p.featuredTitle}
              ctaLabel={p.featuredCta}
              ctaHref={p.featuredCtaHref}
              items={p.featured}
            />
          </div>
        </section>
      ) : null}

      {/* Ways to buy — category tiles (Buy only) */}
      {p.categoryTiles.length > 0 ? (
        <section className={SECTION}>
          <div className={WRAP}>
            <SectionHead
              eyebrow={p.waysEyebrow}
              title={p.waysTitle}
              size={40}
              className="mb-9"
            />
            <CategoryTiles items={p.categoryTiles} />
          </div>
        </section>
      ) : null}

      {/* Property types */}
      <section className={SECTION}>
        <div className={WRAP}>
          <SectionHead
            eyebrow="Property types"
            title={p.propTypesTitle}
            size={40}
            className="mb-9"
          />
          <PropTypeGrid items={p.propTypes} cols={3} />
        </div>
      </section>

      {/* Communities */}
      <section className={SECTION}>
        <div
          className={
            WRAP +
            " grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-10 lg:gap-16 items-center"
          }
        >
          <SectionHead
            eyebrow={p.communitiesEyebrow}
            title={p.communitiesTitle}
            sub={p.communitiesSub}
            size={40}
          />
          <ChipCloud
            chips={p.communityChips}
            cta={p.communitiesCta}
            ctaHref="/communities"
          />
        </div>
      </section>

      <WhyBand title={p.why.title} body={p.why.body} stats={p.why.stats} />

      {/* FAQ */}
      <section className="px-4 md:px-12 py-14 md:py-20">
        <div className={WRAP}>
          <SectionHead
            eyebrow={p.faqEyebrow}
            title={p.faqTitle}
            size={40}
            className="mb-8"
          />
          <Faq items={p.faqs} />
        </div>
      </section>
    </div>
  );
}
