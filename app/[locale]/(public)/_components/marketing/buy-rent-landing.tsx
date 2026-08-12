import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/brand/eyebrow";
import type { FeaturedCardProps } from "./map-listing";
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
  /** Resolved URL of the hero background picked in the master-page editor. */
  heroImageUrl?: string | null;
  heroImageAlt?: string | null;
  /**
   * Let every section span the full viewport width (no 1200px cap). Opt-in
   * so /rent keeps its existing constrained layout untouched.
   */
  wide?: boolean;
  formTitle: string;
  formSub: string;
  /**
   * The hero's lead card. Supplied by the page (a `<ManagedForm>`), so the
   * fields come from the Forms Manager rather than from here. Null when an
   * editor has switched the form off — the hero then runs full width instead
   * of leaving a headed card with nothing in it.
   */
  heroForm?: React.ReactNode;
  featured: FeaturedCardProps[];
  /** Per-category featured lists, keyed by `BuyCategory.key`. */
  featuredByCategory?: Record<string, FeaturedCardProps[]>;
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
  communityChips: (string | { label: string; href?: string })[];
  communitiesCta: string;
  why: { title: React.ReactNode; body: string; stats: [string, string][] };
  faqEyebrow: string;
  faqTitle: string;
  faqs: [string, string][];
  /**
   * Ordered, enabled section keys from the master-page editor
   * (`lib/master-pages`). Omit to keep the built-in order with every section
   * shown — which is what /buy and /rent render before anyone edits them.
   */
  sectionOrder?: string[];
  communitiesCtaHref?: string;
};

/** Section keys, in the order they render by default. Mirrors the registry. */
export const BUY_RENT_SECTIONS = [
  "hero",
  "map",
  "featured",
  "ways",
  "prop_types",
  "communities",
  "lead_band",
  "why",
  "faq",
] as const;

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
  const heroImage = p.heroImageUrl ?? null;

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

  // Each section is built once, then emitted in whatever order the master-page
  // editor asks for. `hero` carries the enquiry-form card with it — they are
  // one grid, not two stacked sections.
  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <section
        key="hero"
        className={cn(
          "px-4 md:px-12 pt-12 md:pt-20 pb-14 md:pb-[72px]",
          // Only becomes a media hero once a photo is picked. Without one the
          // section keeps its original plain treatment exactly.
          //
          // `bg-bz-navy` is never seen once the photo decodes — the image and
          // the scrim cover it — but it is what shows in the moment before,
          // instead of the cream page background flashing behind white type.
          // It no longer has to double as the thing axe measures against:
          // the photo and scrim now paint in front of this background rather
          // than behind it (see below), so axe reaches them directly.
          heroImage && "relative overflow-hidden bg-bz-navy",
        )}
      >
        {heroImage ? (
          <>
            {/* Photo and scrim stack on paint order rather than on a negative
                z-index. Behind the section they sat below the opaque page
                wrapper in axe's background stack, so it stopped at #faf8f5 two
                levels up and read every white string here as white-on-cream.
                As ordinary positioned siblings they land where they belong,
                and the copy column below is positioned to paint over them. */}
            <Image
              src={heroImage}
              alt={p.heroImageAlt ?? ""}
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
            {/* Two layered gradients rather than one: the horizontal pass
                carries the desktop layout, where the copy sits left and the
                form card right, and the vertical pass does the work on mobile
                once those two stack. Either alone leaves a corner unreadable.

                They multiply where they overlap, so the corner values are not
                the numbers below: the copy side lands around 56% black at the
                top and 63% at the foot, the photo side in the low twenties.
                The first pass ran 80–86% down the copy side, which held type
                easily but flattened the photograph into a dark panel — you
                could not tell what the picture was of.

                Worst case for legibility is a near-white photograph, where
                56% black leaves white type at about 4.9:1 and the sub-copy at
                6.5:1 — both above AA. The 11px eyebrow is the weak point at
                that extreme and depends on the editor not picking a blown-out
                image, which was true before this change too, with more margin.
                Anything darker than paper-white clears comfortably. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(0,0,0,.52) 0%, rgba(0,0,0,.26) 55%, rgba(0,0,0,.10) 100%), linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.22) 100%)",
              }}
            />
          </>
        ) : null}
        <div
          className={cn(
            "grid grid-cols-1 gap-10 lg:gap-16 items-center",
            p.heroForm ? "lg:grid-cols-[1fr_460px]" : "lg:grid-cols-1",
            // Positioned so the copy paints over the scrim, which is itself a
            // positioned sibling. Only needed on the media variant.
            heroImage && "relative",
            heroWrap,
          )}
        >
          {/* The light copy belongs to this column, not to the section. On the
              section it also cascaded into the enquiry card beside it, whose
              own surface stays white — leaving that card's heading, its field
              labels and the visitor's typed input white-on-white. Axe reports
              that as `incomplete` ("1:1 contrast ratio with the background")
              rather than a violation, so it survived the a11y spec; see
              e2e/hero-media-contrast.spec.ts. */}
          <div className={heroImage ? "text-white" : undefined}>
            {/* /80 rather than /70: at 11px this is the first thing to go, and
                the lighter scrim gives it less to sit on than it used to. */}
            <Eyebrow className={heroImage ? "text-white/80" : undefined}>
              {p.eyebrow}
            </Eyebrow>
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
            <p
              className={cn(
                "text-[16px] md:text-[17px] max-w-[520px] leading-relaxed mt-5",
                heroImage ? "text-white/85" : "text-bz-ink-2",
              )}
            >
              {p.sub}
            </p>
            {heroChips}
            {p.stats && p.stats.length > 0 ? (
              <div
                className={cn(
                  "flex flex-wrap gap-8 md:gap-12 mt-10 pt-8 border-t",
                  heroImage ? "border-white/25" : "border-bz-border",
                )}
              >
                {p.stats.map(([v, l]) => (
                  <div key={l}>
                    <div
                      className="serif"
                      style={{ fontSize: fluid(32), letterSpacing: "-0.02em" }}
                    >
                      {v}
                    </div>
                    <div
                      className={cn(
                        "text-[12.5px] mt-0.5",
                        heroImage ? "text-white/80" : "text-bz-muted",
                      )}
                    >
                      {l}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {p.heroForm ? (
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
              {p.heroForm}
            </div>
          ) : null}
        </div>
      </section>
    ),

    map: p.mapSlot ?? null,

    featured: showFeatured ? (
      <section key="featured" className={SECTION}>
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
    ) : null,

    ways:
      p.categoryTiles.length > 0 ? (
        <section key="ways" className={SECTION}>
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
      ) : null,

    prop_types: (
      <section key="prop_types" className={SECTION}>
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
    ),

    communities: (
      <section key="communities" className={SECTION}>
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
            ctaHref={p.communitiesCtaHref ?? "/areas"}
          />
        </div>
      </section>
    ),

    lead_band: p.leadBand ?? null,

    why: (
      <WhyBand
        key="why"
        title={p.why.title}
        body={p.why.body}
        stats={p.why.stats}
        wide={p.wide}
      />
    ),

    faq: (
      <section key="faq" className="px-4 md:px-12 py-14 md:py-20">
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
    ),
  };

  // Default order preserves the historical layout, including /rent's map above
  // the featured row.
  const defaultOrder = p.mapAbove
    ? ["hero", "map", "featured", "ways", "prop_types", "communities", "lead_band", "why", "faq"]
    : ["hero", "featured", "map", "ways", "prop_types", "communities", "lead_band", "why", "faq"];

  const order = p.sectionOrder?.length ? p.sectionOrder : defaultOrder;

  const body = (
    <>
      {order.map((key) => (
        <React.Fragment key={key}>{nodes[key] ?? null}</React.Fragment>
      ))}
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
