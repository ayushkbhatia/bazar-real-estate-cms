import { getTranslations } from "next-intl/server";
import Link from "@/components/i18n/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { CarouselGrid } from "@/components/brand/mobile";
import { mediaPublicUrl } from "@/lib/media";
import { propertyUrl, type ListingRow } from "@/lib/queries/properties";
import { ListingCardPriced } from "../../../_components/listing-card-priced";
import { CARD_TRACK } from "./area-bands";
import { fluid } from "../../../_components/marketing/fluid";

function badgeFor(
  row: ListingRow,
): { label: string; kind: "ink" | "accent" } | undefined {
  if (row.flags?.exclusive) return { label: "Exclusive", kind: "ink" };
  if (row.flags?.vacant_on_transfer)
    return { label: "Vacant on transfer", kind: "accent" };
  return undefined;
}

/**
 * One inventory rail — the sale band and the rental band are the same
 * component with a different mode behind them.
 *
 * `emptyBody` is what separates the two in practice. A guide for an area with
 * no rental stock yet still has to say something useful, so the rental band
 * ships a "speak to us about upcoming availability" line instead of an empty
 * grid; the sale band falls back to a link into the wider search.
 */
export async function AreaListingsBand({
  eyebrow,
  heading,
  intro,
  rows,
  ctaLabel,
  ctaHref,
  emptyBody,
  emptyHref,
  emptyLabel,
  tone = "bg",
}: {
  eyebrow: string;
  heading: string;
  intro?: string | null;
  rows: ListingRow[];
  ctaLabel: string;
  ctaHref: string;
  /** Copy shown instead of the cards when nothing is published. */
  emptyBody?: string | null;
  emptyHref?: string;
  emptyLabel?: string;
  tone?: "bg" | "surface";
}) {
  const t = await getTranslations("area");
  return (
    <section
      className={
        tone === "surface"
          ? "border-t border-bz-border bg-bz-surface"
          : "border-t border-bz-border"
      }
    >
      <div className="px-4 md:px-12 py-14 md:py-16">
        <div className="flex items-end justify-between gap-8 flex-wrap">
          <div className="max-w-[68ch]">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2
              className="serif mt-2 font-normal leading-tight"
              style={{ fontSize: fluid(34), letterSpacing: "-0.02em" }}
            >
              {heading}
            </h2>
            {intro ? (
              <p className="mt-4 text-[15.5px] text-bz-ink-2 leading-relaxed">
                {intro}
              </p>
            ) : null}
          </div>
          {rows.length > 0 ? (
            <Button asChild variant="outline">
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <div className="mt-9">
            <CarouselGrid cols={3} className={CARD_TRACK}>
              {rows.map((row, index) => {
                const badge = badgeFor(row);
                return (
                  <Link
                    key={row.reference}
                    href={propertyUrl(row)}
                    className="block"
                  >
                    <ListingCardPriced
                      priceAed={row.price_aed}
                      title={row.title}
                      location={row.areas?.name ?? ""}
                      beds={row.beds}
                      baths={row.baths}
                      area={row.built_up_ft2 ?? 0}
                      badge={badge?.label}
                      badgeKind={badge?.kind}
                      imgLabel={row.reference}
                      heroSrc={
                        row.hero ? mediaPublicUrl(row.hero.storage_key) : null
                      }
                      heroAlt={row.hero?.alt_text ?? row.title}
                      priority={index === 0}
                      propertyId={row.id}
                    />
                  </Link>
                );
              })}
            </CarouselGrid>
          </div>
        ) : (
          <div className="mt-9 rounded-md border border-dashed border-bz-border px-6 py-10 text-center">
            <p className="text-[14.5px] text-bz-ink-2 leading-relaxed mx-auto max-w-[62ch]">
              {emptyBody ?? t("empty.nothingPublished")}
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link href={emptyHref ?? ctaHref}>{emptyLabel ?? ctaLabel}</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
