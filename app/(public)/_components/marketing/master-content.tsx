import type { ListingCardProps } from "@/components/brand/listing-card";
import { faqPairs, img, list, statPairs, str } from "@/lib/master-pages";
import type { MasterPageContent } from "@/lib/queries/master-pages";
import type { CategoryTile } from "./category-tiles";
import type { PropType } from "./prop-type-grid";

/**
 * Adapters that turn master-page section values into the props /buy and /rent
 * already take. Every getter falls back to what the page passed before, so a
 * section an editor has never touched renders identically.
 */

export type BuyRentContentProps = {
  eyebrow: string;
  title: React.ReactNode;
  sub: string;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  formTitle: string;
  formSub: string;
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
  communityChips: { label: string; href?: string }[];
  communitiesCta: string;
  communitiesCtaHref: string;
  why: { title: string; body: string; stats: [string, string][] };
  faqEyebrow: string;
  faqTitle: string;
  faqs: [string, string][];
  stats?: [string, string][];
  chips?: string[];
  chipHrefs?: (string | undefined)[];
  sectionOrder: string[];
  lead: {
    eyebrow: string;
    title: string;
    sub: string;
    image: { url: string | null; alt: string | null; label: string };
  };
};

/** `featured` listings are always live data; only the copy is editable. */
export type FeaturedInput = {
  featured: ListingCardProps[];
};

export function buyRentContent(content: MasterPageContent): BuyRentContentProps {
  const hero = content.section("hero")?.values ?? {};
  const form = content.section("hero_form")?.values ?? {};
  const featured = content.section("featured")?.values ?? {};
  const lead = content.section("lead_band")?.values ?? {};
  const ways = content.section("ways")?.values ?? {};
  const types = content.section("prop_types")?.values ?? {};
  const communities = content.section("communities")?.values ?? {};
  const why = content.section("why")?.values ?? {};
  const faq = content.section("faq")?.values ?? {};

  const heroChips = list<{ label?: string; href?: string }>(hero, "chips");
  const leadImage = img(lead, "image");
  const heroImage = img(hero, "image");

  return {
    eyebrow: str(hero, "eyebrow") ?? "",
    title: heroTitle(str(hero, "title"), str(hero, "title_emphasis")),
    sub: str(hero, "sub") ?? "",
    heroImageUrl: heroImage?.url ?? null,
    heroImageAlt: heroImage?.alt ?? null,
    stats: statPairs(hero),
    chips: heroChips.map((c) => c.label ?? ""),
    chipHrefs: heroChips.map((c) => c.href || undefined),
    formTitle: str(form, "form_title") ?? "",
    formSub: str(form, "form_sub") ?? "",
    featuredTitle: str(featured, "featured_title") ?? "",
    featuredCta: str(featured, "featured_cta") ?? "",
    featuredCtaHref: str(featured, "featured_cta_href") ?? "#",
    waysEyebrow: str(ways, "ways_eyebrow") ?? "",
    waysTitle: str(ways, "ways_title") ?? "",
    categoryTiles: list<Record<string, unknown>>(ways, "tiles").map((t) => ({
      name: String(t.name ?? ""),
      desc: String(t.desc ?? ""),
      cta: String(t.cta ?? ""),
      href: String(t.href ?? "#"),
      img: String(t.img ?? ""),
      imgUrl: imageUrlOf(t.image),
      imgAlt: imageAltOf(t.image),
    })),
    propTypesTitle: str(types, "prop_types_title") ?? "",
    propTypes: list<Record<string, unknown>>(types, "items").map((t) => {
      // `image.url` is resolved server-side by attachImageUrls from the
      // stored media_id; `img` is the placeholder caption used when no asset
      // is picked. Same shape as the home page's community cards.
      const image = (t.image ?? null) as {
        url?: string | null;
        alt?: string | null;
        label?: string | null;
      } | null;
      return {
        name: String(t.name ?? ""),
        desc: String(t.desc ?? ""),
        cta: String(t.cta ?? ""),
        href: String(t.href ?? "#"),
        img: typeof t.img === "string" ? t.img : (image?.label ?? undefined),
        imgUrl: image?.url ?? null,
        imgAlt: image?.alt ?? null,
      };
    }),
    communitiesEyebrow: str(communities, "communities_eyebrow") ?? "",
    communitiesTitle: str(communities, "communities_title") ?? "",
    communitiesSub: str(communities, "communities_sub") ?? "",
    communityChips: list<{ label?: string; href?: string }>(
      communities,
      "chips",
    ).map((c) => ({ label: c.label ?? "", href: c.href || undefined })),
    communitiesCta: str(communities, "communities_cta") ?? "",
    communitiesCtaHref: str(communities, "communities_cta_href") ?? "/areas",
    why: {
      title: str(why, "why_title") ?? "",
      body: str(why, "why_body") ?? "",
      stats: statPairs(why),
    },
    faqEyebrow: str(faq, "faq_eyebrow") ?? "",
    faqTitle: str(faq, "faq_title") ?? "",
    faqs: faqPairs(faq),
    lead: {
      eyebrow: str(lead, "eyebrow") ?? "",
      title: str(lead, "title") ?? "",
      sub: str(lead, "sub") ?? "",
      image: {
        url: leadImage?.url ?? null,
        alt: leadImage?.alt ?? null,
        label: leadImage?.label ?? "",
      },
    },
    sectionOrder: content.order,
  };
}

/** Newlines in the headline become line breaks; the tail renders in italic. */
function heroTitle(
  title: string | null,
  emphasis: string | null,
): React.ReactNode {
  const lines = (title ?? "").split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 ? <br /> : null}
        </span>
      ))}
      {emphasis ? (
        <>
          {" "}
          <em className="italic">{emphasis}</em>
        </>
      ) : null}
    </>
  );
}

function imageUrlOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const url = (value as { url?: unknown }).url;
  return typeof url === "string" && url ? url : null;
}

function imageAltOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const alt = (value as { alt?: unknown }).alt;
  return typeof alt === "string" && alt ? alt : null;
}
