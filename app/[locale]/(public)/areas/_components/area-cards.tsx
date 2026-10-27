import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";
import { areaCardSubtitle } from "@/lib/master-pages/area-card-subtitle";

/**
 * Curated "marquee" order for the index cards — the recognisable lifestyle
 * islands and prime districts, rather than the raw alphabetical cut (which
 * led with free zones like ADGM / KIZAD). Any slug absent from the live set
 * is skipped and backfilled below, so this list can't 404 the grid.
 *
 * This is the fallback order. Once the areas master page has cards saved, that
 * arrangement wins.
 */
export const MARQUEE_SLUGS = [
  "saadiyat-island",
  "yas-island",
  "al-reem-island",
  "hudayriyat-island",
  "al-maryah",
  "al-raha",
  "corniche",
  "khalifa-city",
];

/** The grid is 4×2 — the seed helper in the admin editor matches this. */
export const AREAS_CARD_COUNT = 8;

export type AreaCard = {
  enabled?: boolean;
  name?: string | null;
  /** The line under the name, from the CMS; `{count}` is the live count. Blank ⇒ the catalogue line. */
  subtitle?: string | null;
  href?: string | null;
  slug?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageLabel?: string | null;
};

/**
 * Areas index "clickable cards" — the same tile treatment as the home
 * "Location-based browsing" grid (image + gradient scrim + name + live
 * listing count), laid out as a clean 4×2 grid (2-up on mobile) linking
 * into each area's guide.
 *
 * Listing counts always come from live data; the configured card list only
 * decides which cards appear, in what order, with which label, link and image.
 */
export async function AreaCards({
  cards,
}: {
  /** Configured in the areas master page. Empty ⇒ the marquee order. */
  cards?: AreaCard[];
} = {}) {
  const t = await getTranslations("area");
  const entries = await listAreasWithCounts();

  if (cards && cards.length > 0) {
    const countBySlug = new Map(
      entries.map((e) => [e.slug.toLowerCase(), e.listing_count]),
    );
    const configured = cards
      .filter((c) => c.enabled !== false)
      .map((c, i) => {
        const slug = c.slug ?? "";
        const count = cardCount(c, countBySlug);
        return {
          key: `${slug || "card"}-${i}`,
          href: c.href ?? (slug ? `/areas/${slug}` : "/areas"),
          name: c.name ?? slug,
          // An editor's wording with the live count in it, else the catalogue.
          countLabel:
            areaCardSubtitle(c.subtitle, count) ??
            (count !== undefined
              ? t("cards.propertiesForSale", { count })
              : t("cards.exploreHomes")),
          imgLabel: c.imageLabel ?? slug,
          imgUrl: c.imageUrl,
          imgAlt: c.imageAlt,
        };
      });
    if (configured.length === 0) return null;
    return <Grid cards={configured} />;
  }

  // Marquee order first (only those present in the live set), then backfill
  // from the remaining areas so the grid always renders a full 4×2 even if
  // the seed/DB set shifts.
  const bySlug = new Map(entries.map((e) => [e.slug, e]));
  const picked = MARQUEE_SLUGS.flatMap((s) => {
    const e = bySlug.get(s);
    return e ? [e] : [];
  });
  const fill = entries.filter((e) => !MARQUEE_SLUGS.includes(e.slug));
  const areas = [...picked, ...fill].slice(0, AREAS_CARD_COUNT);
  if (areas.length === 0) return null;

  return (
    <Grid
      cards={areas.map((c) => ({
        key: c.id,
        href: `/areas/${c.slug}`,
        name: c.name,
        countLabel: t("cards.propertiesForSale", { count: c.listing_count }),
        imgLabel: c.slug,
      }))}
    />
  );
}

/**
 * The live count for a configured card. The card's link decides which area it
 * counts, because that is the page the visitor lands on: a card named "Zayed
 * City" linking to /areas/zayed-city but still carrying an old `khalifa-city`
 * slug must count Zayed City. The slug is the fallback for cards with no area
 * link. Both are matched case-blind — slugs typed as "Saadiyat-Island" found
 * nothing, and those cards fell back to "Explore homes" beside cards with a
 * count.
 */
export function cardCount(
  card: Pick<AreaCard, "href" | "slug">,
  countBySlug: Map<string, number>,
): number | undefined {
  const fromHref = card.href?.match(
    /^(?:\/ar)?\/areas\/([^/?#]+)\/?(?:[?#].*)?$/,
  )?.[1];
  for (const candidate of [fromHref, card.slug]) {
    const count = candidate
      ? countBySlug.get(candidate.trim().toLowerCase())
      : undefined;
    if (count !== undefined) return count;
  }
  return undefined;
}

type GridCard = {
  key: string;
  href: string;
  name: string;
  countLabel: string;
  imgLabel: string;
  imgUrl?: string | null;
  imgAlt?: string | null;
};

function Grid({ cards }: { cards: GridCard[] }) {
  return (
    <section className="px-4 md:px-12 pb-4 md:pb-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {cards.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            className="group relative block h-[220px] overflow-hidden rounded-lg md:h-[240px]"
          >
            {c.imgUrl ? (
              <Image
                src={c.imgUrl}
                alt={c.imgAlt ?? c.name}
                fill
                // 220–240px tall and narrower than that on a phone, and area
                // photos are wide (often 2:1 or more), so the photo is drawn at
                // ~2× the card's height and cropped. Ask for that width.
                sizes="(max-width: 768px) 440px, (max-width: 1920px) 480px, 25vw"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <PlaceholderImage
                label={c.imgLabel}
                className="absolute inset-0 h-full w-full"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-bz-navy/75 via-bz-navy/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white md:p-5">
              <div
                className="serif text-[20px] leading-tight md:text-[21px]"
                style={{ letterSpacing: "-0.01em" }}
              >
                {c.name}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-white/85">
                {c.countLabel} <ArrowRight size={12} strokeWidth={1.8} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
