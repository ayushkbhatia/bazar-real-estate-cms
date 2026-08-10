import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ListingCardProps } from "@/components/brand/listing-card";
import { ListingCardPriced } from "../listing-card-priced";
import { SectionHead } from "./section-head";

type Props = {
  eyebrow?: string;
  title: React.ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  /** `priceAed` is optional so older call sites still compile; without it the
   *  card falls back to the server-rendered AED string. */
  items: (ListingCardProps & { priceAed?: number | null })[];
};

/**
 * Header + 4-up grid of `ListingCard`s for the "Featured properties" rows on
 * Buy / Rent. Renders nothing when there are no listings (graceful degrade —
 * DB may be empty on a fresh client environment) (the handoff's `FeaturedRow`).
 */
export function FeaturedListings({
  eyebrow = "Handpicked",
  title,
  ctaLabel,
  ctaHref,
  items,
}: Props) {
  if (!items.length) return null;
  return (
    <div>
      <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <SectionHead eyebrow={eyebrow} title={title} size={40} />
        {ctaLabel ? (
          <Button asChild variant="outline">
            <Link href={ctaHref ?? "#"}>
              {ctaLabel}
              <ArrowRight size={15} strokeWidth={1.7} />
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((p, i) =>
          p.href ? (
            <Link key={p.href} href={p.href} className="block">
              <ListingCardPriced {...p} priority={i === 0} />
            </Link>
          ) : (
            <ListingCardPriced key={i} {...p} priority={i === 0} />
          ),
        )}
      </div>
    </div>
  );
}
