import Link from "next/link";
import { cn } from "@/lib/utils";
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
import {
  BuyCategoryProvider,
  HeroCategoryChips,
  CategoryFeatured,
  type BuyCategory,
} from "./buy-category-explorer";

export type BuyRentLandingProps = {
  eyebrow: string;
  title: React.ReactNode;
  sub: string;
  /** Static informational pills (Rent). Ignored when `categories` is set. */
  chips?: string[];
  /**
   * Optional per-chip link targets, index-aligned with `chips`. When a chip
   * has an href it renders as a link into search; without one it stays a
   * static pill. Ignored when `categories` (the interactive path) is set.
   */
  chipHrefs?: (string | undefined)[];
  /**
   * Interactive property-type categories (Buy). When set, the hero pills
   * become clickable and drive the featured grid via `featuredByCategory`.
   */
  categories?: BuyCategory[];
  stats?: [string, string][];
  /**
   * Let every section span the full viewport width (no 1200px cap). Opt-in
   * so /rent keeps its existing constrained layout untouched.
   */
  wide?: boolean;
  formTitle: string;
  formSub: string;
  featured: ListingCardProps[];
  /** Per-category featured lists, keyed by `BuyCategory.key`. */
  featuredByCategory?: Record<string, ListingCardProps[]>;
  /** Per-category "browse all" CTA hrefs, keyed by `BuyCategory.key`. */
  featuredCtaHrefByCategory?: Record<string, string>;
  featuredTitle: string;
  featuredCta: string;
  featuredCtaHref: string;
  /** Rendered near the featured row (Buy: the properties map). */
  mapSlot?: React.ReactNode;
  /**
   * Place `mapSlot` above the featured row instead of below it. Opt-in so
   * /buy keeps its map under Featured while /rent leads with the map.
   */
  mapAbove?: boolean;
  /** Rendered just above the "Why Bazar" band (Buy: a second lead form). */
  leadBand?: React.ReactNode;
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

/**
 * Shared marketing landing for /buy and /rent — the handoff's Buy/Rent master
 * pages. Search itself lives at /buy/search and /rent/search; this page funnels
 * into it via the category tiles, property-type cards, and lead form.
 *
 * `wide` makes sections full-bleed (`px-4 md:px-12`, no inner max-width) so
 * they fill the viewport on desktop — matching the home / off-plan pages.
 * It's opt-in: /buy passes it, /rent keeps its original 1200px cap.
 */
export function BuyRentLanding(p: BuyRentLandingProps) {
  const interactive = !!(p.categories && p.categories.length > 0);
  // Content wrapper cap — empty (full-bleed) when `wide`, else the original
  // constrained widths so /rent renders exactly as before.
  const wrap = p.wide ? "" : "max-w-[1200px]";
  const heroWrap = p.wide ? "" : "max-w-[1280px]";

  const heroChips = interactive ? (
    <HeroCategoryChips categories={p.categories!} />
  ) : (
    <div className="flex flex-wrap gap-2 mt-7">
      {(p.chips ?? []).map((c, i) => {
        const base =
          "inline-flex items-center h-9 px-4 rounded-full border text-[13px] " +
          (i === 0
            ? "bg-bz-navy text-bz-bg border-bz-navy"
            : "bg-bz-surface text-bz-ink-2 border-bz-border");
        const href = p.chipHrefs?.[i];
        return href ? (
          <Link
            key={c}
            href={href}
            className={
              base +
              " transition-colors " +
              (i === 0
                ? "hover:bg-bz-navy/90"
                : "hover:border-bz-ink hover:text-bz-ink")
            }
          >
            {c}
          </Link>
        ) : (
          <span key={c} className={base}>
            {c}
          </span>
        );
      })}
    </div>
  );

  const hasCategoryFeatured =
    interactive &&
    Object.values(p.featuredByCategory ?? {}).some((a) => a.length > 0);
  const showFeatured = interactive
    ? p.featured.length > 0 || hasCategoryFeatured
    : p.featured.length > 0;

  const body = (
    <>
      {/* Hero + lead form */}
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-14 md:pb-[72px]">
        <div
          className={cn(
            "grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-10 lg:gap-16 items-center",
            heroWrap,
          )}
        >
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
            {heroChips}
            {p.stats && p.stats.length > 0 ? (
              <div className="flex flex-wrap gap-8 md:gap-12 mt-10 pt-8 border-t border-bz-border">
                {p.stats.map(([v, l]) => (
                  <div key={l}>
                    <div
                      className="serif"
                      style={{ fontSize: fluid(32), letterSpacing: "-0.02em" }}
                    >
                      {v}
                    </div>
                    <div className="text-[12.5px] text-bz-muted mt-0.5">
                      {l}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
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

      {/* Area map above the featured row (Rent) */}
      {p.mapAbove ? p.mapSlot : null}

      {/* Featured listings */}
      {showFeatured ? (
        <section className={SECTION}>
          <div className={wrap}>
            {interactive ? (
              <CategoryFeatured
                byCategory={p.featuredByCategory ?? {}}
                fallback={p.featured}
                title={p.featuredTitle}
                ctaLabel={p.featuredCta}
                ctaHref={p.featuredCtaHref}
                ctaHrefByCategory={p.featuredCtaHrefByCategory}
              />
            ) : (
              <FeaturedListings
                eyebrow="Handpicked"
                title={p.featuredTitle}
                ctaLabel={p.featuredCta}
                ctaHref={p.featuredCtaHref}
                items={p.featured}
              />
            )}
          </div>
        </section>
      ) : null}

      {/* Area map below the featured row (Buy) */}
      {p.mapAbove ? null : p.mapSlot}

      {/* Ways to buy — category tiles (Buy only) */}
      {p.categoryTiles.length > 0 ? (
        <section className={SECTION}>
          <div className={wrap}>
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
        <div className={wrap}>
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
          className={cn(
            "grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-10 lg:gap-16 items-center",
            wrap,
          )}
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
            ctaHref="/areas"
          />
        </div>
      </section>

      {/* Second lead form (Buy only) */}
      {p.leadBand}

      <WhyBand
        title={p.why.title}
        body={p.why.body}
        stats={p.why.stats}
        wide={p.wide}
      />

      {/* FAQ */}
      <section className="px-4 md:px-12 py-14 md:py-20">
        <div className={wrap}>
          <SectionHead
            eyebrow={p.faqEyebrow}
            title={p.faqTitle}
            size={40}
            className="mb-8"
          />
          <Faq items={p.faqs} />
        </div>
      </section>
    </>
  );

  return (
    <div className="bg-bz-bg">
      {interactive ? (
        <BuyCategoryProvider categories={p.categories!}>
          {body}
        </BuyCategoryProvider>
      ) : (
        body
      )}
    </div>
  );
}
