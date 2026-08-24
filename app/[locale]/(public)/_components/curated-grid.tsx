import { getTranslations } from "next-intl/server";
import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { mediaPublicUrl } from "@/lib/media";
import { propertyUrl, type ListingRow } from "@/lib/queries/properties";
import { listingBadge } from "@/lib/listing-badge";
import { ListingCardPriced } from "./listing-card-priced";

type Props = {
  eyebrow: string;
  title: string;
  intro: string;
  /** Pre-fetched curated listings (small batch — typically 12-24). */
  rows: ListingRow[];
  /** Caller passes the deeper-browse link when the curation isn't infinite. */
  browseAllHref: string;
  browseAllLabel: string;
};

/**
 * Shared layout for T2-E curated routes (/exclusive, /new-this-week,
 * /price-drops). Hero band → card grid → CTA back into /buy.
 */
export async function CuratedGrid({
  eyebrow,
  title,
  intro,
  rows,
  browseAllHref,
  browseAllLabel,
}: Props) {
  const tl = await getTranslations("listing");
  const badgeLabels = {
    exclusive: tl("badge.exclusive"),
    vacantOnTransfer: tl("badge.vacantOnTransfer"),
  };
  return (
    <article className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-14 md:pt-24 pb-12 border-b border-bz-border">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1
          className="serif text-[38px] md:text-[72px] mt-3 leading-[0.98] max-w-[24ch]"
          style={{ letterSpacing: "-0.028em" }}
        >
          {title}
        </h1>
        <p className="mt-6 max-w-[58ch] text-[17px] text-bz-ink-2 leading-relaxed">
          {intro}
        </p>
      </section>

      <section className="px-4 md:px-12 py-16">
        {/*
          The empty state is a <p>, not a <div>. It is one sentence of running
          prose and the link inside it wraps across two line boxes — it
          measured 254x42, which is a touch-target violation only if you treat
          an inline link like a button. Padding it to 44px would break the
          sentence, so the right answer is the correct element: the
          mobile-geometry gate exempts links inside `p`, `li` and `.bz-prose`
          for exactly this case, and a <div> put this one outside that
          exemption while changing nothing about how it reads.
        */}
        {rows.length === 0 ? (
          <p className="rounded-lg border border-bz-border bg-bz-surface p-9 text-[15px] text-bz-ink-2 max-w-[560px]">
            Nothing matches this curation right now. Try the wider catalogue on{" "}
            <Link
              href={browseAllHref}
              className="underline underline-offset-2 hover:text-bz-ink"
            >
              {browseAllLabel}
            </Link>{" "}
            instead, or save a search and we&apos;ll notify you when new
            listings land.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rows.map((row, index) => {
              const badge = listingBadge(row.flags, badgeLabels);
              return (
                <Link
                  key={row.reference}
                  href={propertyUrl(row)}
                  className="block"
                >
                  <ListingCardPriced
                    priceAed={row.price_aed}
                    title={row.title}
                    location={row.areas?.name ?? "United Arab Emirates"}
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
          </div>
        )}

        <div className="mt-12 flex items-center justify-between flex-wrap gap-4">
          <p className="text-[13px] text-bz-ink-2 max-w-[42ch]">
            Looking for more options? The full catalogue is one click away.
          </p>
          <Button asChild variant="outline">
            <Link href={browseAllHref}>
              {browseAllLabel}
              <ArrowRight size={14} strokeWidth={1.7} />
            </Link>
          </Button>
        </div>
      </section>
    </article>
  );
}
