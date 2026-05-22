import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";

const AREAS = [
  { slug: "saadiyat-island", name: "Saadiyat Island", listings: "184" },
  { slug: "yas-island", name: "Yas Island", listings: "242" },
  { slug: "al-reem-island", name: "Al Reem Island", listings: "338" },
  { slug: "al-raha", name: "Al Raha", listings: "156" },
  { slug: "corniche", name: "Corniche", listings: "94" },
];

/**
 * Sprint 4a: 5-cell areas mosaic. Sprint 9 swaps the listing counts for
 * real `count()` queries.
 */
export function AreasMosaic() {
  return (
    <section className="px-12 py-20">
      <div className="flex items-end justify-between gap-8 flex-wrap mb-10">
        <div>
          <Eyebrow>Areas</Eyebrow>
          <h2
            className="serif text-[40px] mt-2 leading-tight max-w-[24ch]"
            style={{ letterSpacing: "-0.022em" }}
          >
            Five neighbourhoods we know inside out.
          </h2>
        </div>
        <Link
          href="/areas"
          className="inline-flex items-center gap-1.5 text-[13px] text-bz-ink-2 hover:text-bz-accent transition-colors"
        >
          All areas
          <ArrowRight size={13} strokeWidth={1.7} />
        </Link>
      </div>

      <div className="grid grid-cols-4 grid-rows-2 gap-4 h-[520px]">
        {/* Saadiyat — big cell */}
        <Link
          href={`/areas/${AREAS[0].slug}`}
          className="col-span-2 row-span-2 group relative overflow-hidden rounded-lg block"
        >
          <PlaceholderImage
            label={AREAS[0].slug}
            className="w-full h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 text-white">
            <div className="text-[11.5px] uppercase tracking-wider opacity-80">
              {AREAS[0].listings} listings
            </div>
            <div
              className="serif text-[34px] mt-1 leading-tight"
              style={{ letterSpacing: "-0.015em" }}
            >
              {AREAS[0].name}
            </div>
          </div>
        </Link>
        {AREAS.slice(1).map((a) => (
          <Link
            key={a.slug}
            href={`/areas/${a.slug}`}
            className="group relative overflow-hidden rounded-lg block"
          >
            <PlaceholderImage label={a.slug} className="w-full h-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <div className="text-[10.5px] uppercase tracking-wider opacity-80">
                {a.listings}
              </div>
              <div
                className="serif text-[20px] mt-0.5 leading-tight"
                style={{ letterSpacing: "-0.01em" }}
              >
                {a.name}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
