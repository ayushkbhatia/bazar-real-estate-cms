import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { SectionHead } from "../../_components/marketing/section-head";

type Spotlight = {
  name: string;
  blurb: string;
  slug: string;
  img: string;
};

/**
 * Two large "Area Spotlight" tiles — editorial features for the areas we
 * push hardest right now. Slugs match the seeded area guides
 * (hudayriyat-island, al-reem-island) so the CTAs never 404.
 */
const SPOTLIGHTS: Spotlight[] = [
  {
    name: "Hudayriyat Island",
    blurb:
      "Abu Dhabi's emerging waterfront destination — beaches, sports and leisure districts, and a new wave of low-rise coastal homes.",
    slug: "hudayriyat-island",
    img: "hudayriyat island · coastline aerial",
  },
  {
    name: "Al Reem Island",
    blurb:
      "A vibrant, high-density waterfront community minutes from the city — strong rental demand and a deep mix of apartments and towers.",
    slug: "al-reem-island",
    img: "al reem island · skyline waterfront",
  },
];

export function AreaSpotlights() {
  return (
    <section className="px-4 py-14 md:px-12 md:py-20">
      <SectionHead
        eyebrow="Area spotlights"
        title="Two islands worth a closer look."
        sub="Where demand, new supply, and lifestyle are converging right now."
        size={40}
        className="mb-8"
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {SPOTLIGHTS.map((s) => (
          <Link
            key={s.slug}
            href={`/areas/${s.slug}`}
            className="group relative flex min-h-[360px] flex-col justify-end overflow-hidden rounded-xl text-white md:min-h-[440px]"
          >
            <PlaceholderImage
              label={s.img}
              dark
              className="absolute inset-0 h-full w-full"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(20,18,14,.15) 0%, rgba(20,18,14,.82) 100%)",
              }}
            />
            <div className="relative p-6 md:p-8">
              <div
                className="eyebrow text-white/70"
                style={{ letterSpacing: "0.14em" }}
              >
                Area Spotlight
              </div>
              <div
                className="serif mt-2 text-[30px] leading-[1.05] md:text-[38px]"
                style={{ letterSpacing: "-0.02em" }}
              >
                {s.name}
              </div>
              <p className="mt-3 max-w-[46ch] text-[13.5px] leading-[1.6] text-white/85">
                {s.blurb}
              </p>
              <div className="mt-5 flex items-center gap-2 text-[13px] font-medium">
                Explore {s.name}
                <ArrowRight
                  size={15}
                  strokeWidth={1.8}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
