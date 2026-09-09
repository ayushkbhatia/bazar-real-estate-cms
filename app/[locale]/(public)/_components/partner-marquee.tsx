"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  shippedPartners,
  type ResolvedPartner,
} from "@/lib/partners/directory-data";

/**
 * "Our Partner Ecosystem" — a continuous, seamless logo marquee of Bazar's
 * banking and regulatory partners, edited at
 * /admin/pages/sub/section/partners and passed in by whichever page places the
 * strip. The shipped catalogue is the fallback, so a render that was given
 * nothing looks exactly as it always did.
 *
 * The track is rendered twice and translated -50%, so the loop is seamless; it pauses on hover and honours
 * prefers-reduced-motion. Logos are height-normalised on white tiles so the
 * set reads evenly on both mobile and desktop.
 */
export function PartnerMarquee({
  partners,
}: {
  partners?: ResolvedPartner[];
} = {}) {
  const t = useTranslations("common");
  const set = partners?.length ? partners : shippedPartners();
  // Two copies of the set → the second copy scrolls into the gap the first
  // leaves, giving a seamless -50% loop.
  const loop = [...set, ...set];

  return (
    <div className="bz-marquee" aria-label={t("marquee.partners")}>
      <div className="bz-marquee__track">
        {loop.map((p, i) => (
          <div
            key={`${p.slug}-${i}`}
            className="bz-marquee__tile"
            aria-hidden={i >= set.length}
          >
            {p.logo ? (
              <Image
                src={p.logo.src}
                alt={p.name}
                width={p.logo.w}
                height={p.logo.h}
                className="h-9 w-auto object-contain md:h-11"
                style={{ width: "auto" }}
                sizes="220px"
              />
            ) : (
              /* A partner an editor added without a logo still belongs in the
                 strip — set in type rather than left as an empty tile. */
              <span className="serif text-center text-[15px] leading-tight text-bz-ink md:text-[17px]">
                {p.name}
              </span>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .bz-marquee {
          position: relative;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(
            90deg,
            transparent 0,
            #000 7%,
            #000 93%,
            transparent 100%
          );
          mask-image: linear-gradient(
            90deg,
            transparent 0,
            #000 7%,
            #000 93%,
            transparent 100%
          );
        }
        .bz-marquee__track {
          display: flex;
          width: max-content;
          gap: 14px;
          animation: bz-marquee-scroll 46s linear infinite;
        }
        .bz-marquee:hover .bz-marquee__track {
          animation-play-state: paused;
        }
        .bz-marquee__tile {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 200px;
          height: 108px;
          padding: 0 32px;
          background: #ffffff;
          border: 1px solid var(--bz-border, #e7e4db);
          border-radius: 12px;
        }
        @media (min-width: 768px) {
          .bz-marquee__track { gap: 20px; }
          .bz-marquee__tile { min-width: 240px; height: 128px; padding: 0 40px; }
        }
        @keyframes bz-marquee-scroll {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        /*
         * RTL runs the other way, and this is not cosmetic.
         *
         * The track is width:max-content inside an overflow:hidden box.
         * Under dir=rtl the flex row is laid out from the right, so the
         * track's overflow spills to the LEFT and its right edge starts flush
         * with the container's. Animating to -50% then drags the whole strip
         * further left into empty space: the logos run off the start of the
         * page and never come back, which is exactly what /ar showed.
         *
         * Mirroring the sign restores the loop — moving right pulls the copy
         * that is off-screen left into view — and the doubled track makes the
         * wrap seamless in both directions.
         */
        [dir="rtl"] .bz-marquee__track {
          animation-name: bz-marquee-scroll-rtl;
        }
        @keyframes bz-marquee-scroll-rtl {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(50%, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bz-marquee__track { animation: none; }
        }
      `}</style>
    </div>
  );
}
