import Link from "@/components/i18n/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { CompareButton } from "@/components/brand/compare-button";
import { Button } from "@/components/ui/button";
import { AreaText, PriceText } from "../../_components/area-text";
import type { LiveListing } from "@/lib/queries/market-reports-listings";
import type { PropertyTypeSlug } from "@/lib/queries/market-reports";
import { propertyTypeLabel } from "@/lib/queries/market-reports";

type Props = {
  area_slug: string;
  area_name: string;
  property_type: PropertyTypeSlug;
  rows: LiveListing[];
};

/**
 * T1-A cleanup: live comparables rail — bridges the report (closed
 * transactions) to the active marketplace (listings on the books today).
 * Without this rail the moat was orphaned — visitors loved the numbers
 * and had nowhere obvious to act. The "View all" button links into
 * `/buy?area=…&type=…` with the same filter applied.
 */
export function LiveListingsRail({
  area_slug,
  area_name,
  property_type,
  rows,
}: Props) {
  const browseAllHref = `/buy?area=${encodeURIComponent(area_slug)}&type=${encodeURIComponent(property_type)}`;

  return (
    <section className="px-4 md:px-12 py-12 border-b border-bz-border bg-bz-surface-2">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <Eyebrow>On the market now · {area_name}</Eyebrow>
          <h2
            className="serif text-[28px] mt-2 leading-tight"
            style={{ letterSpacing: "-0.018em" }}
          >
            {propertyTypeLabel(property_type)}s available today
          </h2>
        </div>
        <Button asChild variant="outline">
          <Link href={browseAllHref}>
            View all
            <ArrowRight size={14} strokeWidth={1.7} />
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-bz-border bg-bz-surface p-6 text-[14px] text-bz-ink-2 max-w-[560px]">
          No live {property_type} listings in {area_name} right now. Save a
          search and we&apos;ll email you the first match.
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/p/${r.slug}-${r.reference}`}
                className="group block rounded-lg border border-bz-border bg-bz-surface overflow-hidden hover:border-bz-ink transition-colors"
              >
                <div className="relative aspect-[4/3] bg-bz-bg">
                  {r.hero_url ? (
                    <Image
                      src={r.hero_url}
                      alt={r.hero_alt ?? r.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <PlaceholderImage
                      label={r.reference}
                      className="absolute inset-0 w-full h-full"
                    />
                  )}
                  {/* This rail predates `ListingCard` and draws its own
                      media, so it doesn't inherit the card's shortlist
                      button — mount it explicitly, same position. */}
                  <div className="absolute top-3 end-3 z-10">
                    <CompareButton propertyId={r.id} />
                  </div>
                </div>
                <div className="p-4">
                  <div className="serif text-[18px] leading-tight truncate group-hover:text-bz-accent transition-colors">
                    {r.title}
                  </div>
                  <div className="mt-1 text-[12px] text-bz-ink-2 truncate">
                    {r.area_name ?? area_name}
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <span className="mono text-[13.5px] text-bz-ink">
                      <PriceText aed={r.price_aed} />
                    </span>
                    <span className="text-[11px] text-bz-ink-2">
                      {r.beds}b · {r.baths}ba ·{" "}
                      <AreaText ft2={r.built_up_ft2} />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
