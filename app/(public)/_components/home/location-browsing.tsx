import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { listAreasWithCounts } from "@/lib/queries/areas-guide";
import type { SectionCopy } from "./section-copy";

/**
 * Home "Location-based browsing" (handoff §1). A large Abu Dhabi overview
 * tile + up to 8 community tiles, wired to live community counts.
 * Desktop: overview left, 4×2 grid right. Mobile: overview full-width, the
 * 8 communities become a horizontal snap rail (single DOM tree).
 */
export type LocationCard = {
  enabled?: boolean;
  name?: string | null;
  href?: string | null;
  slug?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageLabel?: string | null;
};

export async function LocationBrowsing({
  eyebrow = "Location-based browsing",
  heading = "Your next location starts here",
  body = "Discover leading communities across Abu Dhabi.",
  ctaLabel = "All locations",
  ctaHref = "/areas",
  overviewName = "Abu Dhabi",
  overviewHref = "/areas",
  overviewImageUrl,
  overviewImageAlt,
  overviewImageLabel,
  cards,
}: SectionCopy & {
  overviewName?: string | null;
  overviewHref?: string | null;
  overviewImageUrl?: string | null;
  overviewImageAlt?: string | null;
  overviewImageLabel?: string | null;
  /** Configured in the home master page. Empty ⇒ top 8 published areas. */
  cards?: LocationCard[];
} = {}) {
  const entries = await listAreasWithCounts();
  const total = entries.reduce((n, e) => n + e.listing_count, 0);
  const countBySlug = new Map(entries.map((e) => [e.slug, e.listing_count]));

  // Listing counts always come from live data; the card list only decides
  // which cards appear, in what order, with which label, link and image.
  const communities: {
    key: string;
    href: string;
    name: string;
    countLabel: string;
    imgLabel: string;
    imgUrl?: string | null;
    imgAlt?: string | null;
  }[] =
    cards && cards.length > 0
      ? cards
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
          })
      : entries.slice(0, 8).map((c) => ({
          key: c.id,
          href: `/areas/${c.slug}`,
          name: c.name,
          countLabel: `${c.listing_count.toLocaleString("en-US")} homes for sale`,
          imgLabel: c.slug,
        }));

  return (
    <section className="px-4 md:px-12 py-14 md:py-20">
      <div className="mb-8 flex flex-col gap-5 md:mb-11 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="serif mt-2 text-[28px] md:text-[44px] font-normal leading-[1.05] tracking-tight">
            {heading}
          </h2>
          <p className="mt-4 max-w-[52ch] text-[14.5px] md:text-[15.5px] text-bz-ink-2 leading-relaxed">
            {body}
          </p>
        </div>
        <Link
          href={ctaHref ?? "/areas"}
          className="inline-flex items-center gap-1.5 self-start text-[13.5px] text-bz-ink-2 hover:text-bz-accent transition-colors"
        >
          {ctaLabel ?? "All locations"}{" "}
          <ArrowRight size={14} strokeWidth={1.7} />
        </Link>
      </div>

      <div className="md:grid md:grid-cols-[1.15fr_2fr] md:gap-4 md:h-[520px]">
        {/* Overview tile */}
        <Tile
          href={overviewHref ?? "/areas"}
          name={overviewName ?? "Abu Dhabi"}
          countLabel={`${total.toLocaleString("en-US")} homes for sale`}
          imgLabel={overviewImageLabel ?? "abu dhabi"}
          imgUrl={overviewImageUrl}
          imgAlt={overviewImageAlt}
          big
          className="h-[240px] md:h-full"
        />

        {/* Community tiles — mobile rail, desktop 4×2 grid */}
        <div
          className={[
            "mt-4 flex gap-4 overflow-x-auto -mx-4 px-4 snap-x snap-mandatory",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "[&>*]:shrink-0 [&>*]:snap-start [&>*]:w-[68%]",
            "md:mt-0 md:mx-0 md:px-0 md:grid md:grid-cols-4 md:grid-rows-2 md:overflow-visible md:snap-none",
            "md:[&>*]:w-auto",
          ].join(" ")}
        >
          {communities.map((c) => (
            <Tile
              key={c.key}
              href={c.href}
              name={c.name}
              countLabel={c.countLabel}
              imgLabel={c.imgLabel}
              imgUrl={c.imgUrl}
              imgAlt={c.imgAlt}
              className="h-[220px] md:h-auto"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Tile({
  href,
  name,
  countLabel,
  imgLabel,
  imgUrl,
  imgAlt,
  big = false,
  className,
}: {
  href: string;
  name: string;
  countLabel: string;
  imgLabel: string;
  imgUrl?: string | null;
  imgAlt?: string | null;
  big?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-lg ${className ?? ""}`.trim()}
    >
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={imgAlt ?? name}
          fill
          sizes="(max-width: 768px) 68vw, 25vw"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <PlaceholderImage
          label={imgLabel}
          className="absolute inset-0 h-full w-full"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-bz-navy/75 via-bz-navy/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 md:p-5 text-white">
        <div
          className={`serif leading-tight ${big ? "text-[30px] md:text-[34px]" : "text-[20px] md:text-[21px]"}`}
          style={{ letterSpacing: "-0.01em" }}
        >
          {name}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-white/85">
          {countLabel} <ArrowRight size={12} strokeWidth={1.8} />
        </div>
      </div>
    </Link>
  );
}
