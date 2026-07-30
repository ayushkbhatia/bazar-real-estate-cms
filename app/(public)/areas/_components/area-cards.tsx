import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";

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
  const entries = await listAreasWithCounts();

  if (cards && cards.length > 0) {
    const countBySlug = new Map(entries.map((e) => [e.slug, e.listing_count]));
    const configured = cards
      .filter((c) => c.enabled !== false)
      .map((c, i) => {
        const slug = c.slug ?? "";
        const count = countBySlug.get(slug);
        return {
          key: `${slug || "card"}-${i}`,
          href: c.href ?? (slug ? `/areas/${slug}` : "/areas"),
          name: c.name ?? slug,
          countLabel:
            count !== undefined
              ? `${count.toLocaleString("en-US")} homes for sale`
              : "Explore homes",
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
        countLabel: `${c.listing_count.toLocaleString("en-US")} homes for sale`,
        imgLabel: c.slug,
      }))}
    />
  );
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
                sizes="(max-width: 768px) 50vw, 25vw"
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
