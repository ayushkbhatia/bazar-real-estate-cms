import Image from "next/image";
import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { SectionHead } from "../../_components/marketing/section-head";

export type Spotlight = {
  enabled?: boolean;
  name?: string | null;
  blurb?: string | null;
  href?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageLabel?: string | null;
};

/**
 * Two large "Area Spotlight" tiles — editorial features for the areas we
 * push hardest right now. Content comes from the areas master page; the
 * defaults there are the pair this shipped with (hudayriyat-island,
 * al-reem-island), whose links match seeded area guides so the CTAs never 404.
 */
const FALLBACK: Spotlight[] = [
  {
    name: "Hudayriyat Island",
    blurb:
      "Abu Dhabi's emerging waterfront destination — beaches, sports and leisure districts, and a new wave of low-rise coastal homes.",
    href: "/areas/hudayriyat-island",
    imageLabel: "hudayriyat island · coastline aerial",
  },
  {
    name: "Al Reem Island",
    blurb:
      "A vibrant, high-density waterfront community minutes from the city — strong rental demand and a deep mix of apartments and towers.",
    href: "/areas/al-reem-island",
    imageLabel: "al reem island · skyline waterfront",
  },
];

export function AreaSpotlights({
  eyebrow = "Area spotlights",
  heading = "Two islands worth a closer look.",
  sub = "Where demand, new supply, and lifestyle are converging right now.",
  tileEyebrow = "Area Spotlight",
  items,
}: {
  eyebrow?: string | null;
  heading?: string | null;
  sub?: string | null;
  tileEyebrow?: string | null;
  items?: Spotlight[];
} = {}) {
  const spotlights = (items && items.length > 0 ? items : FALLBACK).filter(
    (s) => s.enabled !== false,
  );
  if (spotlights.length === 0) return null;

  return (
    <section className="px-4 py-14 md:px-12 md:py-20">
      <SectionHead
        eyebrow={eyebrow ?? undefined}
        title={heading ?? ""}
        sub={sub ?? undefined}
        size={40}
        className="mb-8"
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {spotlights.map((s, i) => {
          const name = s.name ?? "";
          const href = s.href ?? "/areas";
          return (
            <Link
              key={`${name || "spotlight"}-${i}`}
              href={href}
              className="group relative flex min-h-[360px] flex-col justify-end overflow-hidden rounded-xl text-white md:min-h-[440px]"
            >
              {s.imageUrl ? (
                <Image
                  src={s.imageUrl}
                  alt={s.imageAlt ?? name}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <PlaceholderImage
                  label={s.imageLabel ?? name}
                  dark
                  className="absolute inset-0 h-full w-full"
                />
              )}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(0,52,82,.15) 0%, rgba(0,52,82,.82) 100%)",
                }}
              />
              <div className="relative p-6 md:p-8">
                {tileEyebrow ? (
                  <div
                    className="eyebrow text-white/70"
                    style={{ letterSpacing: "0.14em" }}
                  >
                    {tileEyebrow}
                  </div>
                ) : null}
                <div
                  className="serif mt-2 text-[30px] leading-[1.05] md:text-[38px]"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {name}
                </div>
                {s.blurb ? (
                  <p className="mt-3 max-w-[46ch] text-[13.5px] leading-[1.6] text-white/85">
                    {s.blurb}
                  </p>
                ) : null}
                <div className="mt-5 flex items-center gap-2 text-[13px] font-medium">
                  Explore {name}
                  <ArrowRight
                    size={15}
                    strokeWidth={1.8}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
