import { useTranslations } from "next-intl";
import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingCardPriced } from "../listing-card-priced";
import { SectionHead } from "./section-head";
import type { FeaturedCardProps } from "./map-listing";

type Props = {
  eyebrow?: string;
  title: React.ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  items: FeaturedCardProps[];
};

/**
 * Header + 4-up grid of `ListingCard`s for the "Featured properties" rows on
 * Buy / Rent. Renders nothing when there are no listings (graceful degrade —
 * DB may be empty on a fresh client environment) (the handoff's `FeaturedRow`).
 */
export function FeaturedListings({
  eyebrow,
  title,
  ctaLabel,
  ctaHref,
  items,
}: Props) {
  // `useTranslations` rather than `getTranslations`: this renders inside
  // `buy-category-explorer.tsx`, a Client Component, so it cannot be async.
  // `common` is on CLIENT_NAMESPACES, which is what lets the key cross.
  const t = useTranslations("common");
  if (!items.length) return null;
  return (
    <div>
      <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <SectionHead
          eyebrow={eyebrow ?? t("handpicked")}
          title={title}
          size={40}
        />
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
