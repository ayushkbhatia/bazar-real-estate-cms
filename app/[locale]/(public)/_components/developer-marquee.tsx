"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "@/components/i18n/link";
import type { MarqueeTile } from "../developers/_directory";

/**
 * "Our Developers" — a continuous logo marquee of the UAE developers Bazar
 * works with, sitting directly above the banking/regulatory `PartnerMarquee`
 * on the home page. Same tile language as that marquee: the track is rendered
 * twice and translated -50% for a seamless loop, it pauses on hover, and it
 * honours prefers-reduced-motion.
 *
 * Two things differ from `PartnerMarquee`, both forced by the data:
 *
 * 1. Logos fit a max-width × max-height box rather than being height-
 *    normalised. The developer set spans aspect ratios from 0.66 to 9.14, so
 *    matching on height alone would render a 9:1 wordmark hundreds of pixels
 *    wide next to a tall lockup barely a third of that. See `developer-logos`.
 * 2. Tiles are links. Every developer has a `/developers/[slug]` profile (the
 *    banking partners have no equivalent sub-page), so the scroll pauses on
 *    hover, on focus and on press — the last of those being the one a phone
 *    can give, and the reason this no longer needs the `@media (hover: none)`
 *    branch that used to freeze it there. See the note above that media query.
 */

/**
 * Seconds of travel per tile, from the tuned full set (30 tiles over ~197s),
 * so a longer roster lengthens the loop instead of speeding it up. The two
 * marquees on the home page have to read as one system, and they only do
 * that at equal px/s.
 */
const SECONDS_PER_TILE = 197 / 30;

export function DeveloperMarquee({
  /**
   * The live developer directory — `marqueeTiles()`, read by the server
   * parent because publication and CMS-added developers live in Postgres.
   */
  tiles,
}: {
  tiles: readonly MarqueeTile[];
}) {
  const t = useTranslations("common");
  // Two copies of the set → the second copy scrolls into the gap the first
  // leaves, giving a seamless -50% loop.
  const loop = [...tiles, ...tiles];

  return (
    <div className="bz-devmarquee" aria-label={t("marquee.developers")}>
      <div
        className="bz-devmarquee__track"
        style={{
          animationDuration: `${(tiles.length * SECONDS_PER_TILE).toFixed(0)}s`,
        }}
      >
        {loop.map((tile, i) => {
          // The second copy is decorative: hidden from the accessibility tree,
          // and pulled out of the tab order so keyboard users don't land on a
          // focusable link inside an aria-hidden subtree.
          const duplicate = i >= tiles.length;
          return (
            <Link
              key={`${tile.slug}-${i}`}
              href={`/developers/${tile.slug}`}
              className="bz-devmarquee__tile"
              aria-hidden={duplicate || undefined}
              tabIndex={duplicate ? -1 : undefined}
            >
              {tile.logo ? (
                <Image
                  src={tile.logo.src}
                  alt={tile.name}
                  width={tile.logo.w}
                  height={tile.logo.h}
                  className={
                    tile.tight
                      ? "bz-devmarquee__logo"
                      : "bz-devmarquee__logo bz-devmarquee__logo--padded"
                  }
                  sizes="160px"
                />
              ) : (
                // A developer added in the CMS with no logo yet: its name,
                // set in type, rather than a gap in the strip.
                <span className="bz-devmarquee__name serif">{tile.name}</span>
              )}
            </Link>
          );
        })}
      </div>

      <style>{`
        .bz-devmarquee {
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
        .bz-devmarquee__track {
          display: flex;
          width: max-content;
          gap: 14px;
          /* 30 developers over ~197s scrolls at the same px/s as the 7-logo
             partner marquee does over 46s, so the two read as one system.
             The duration is overridden inline from the tile count, so a
             hidden developer shortens the loop instead of speeding it up. */
          animation: bz-devmarquee-scroll 197s linear infinite;
        }
        .bz-devmarquee:hover .bz-devmarquee__track,
        .bz-devmarquee:focus-within .bz-devmarquee__track,
        .bz-devmarquee:active .bz-devmarquee__track {
          animation-play-state: paused;
        }
        .bz-devmarquee__tile {
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
          transition: border-color 120ms ease;
        }
        .bz-devmarquee__tile:hover {
          border-color: var(--bz-border-strong, #cfcabb);
        }
        .bz-devmarquee__logo {
          /* A fixed box + object-fit rather than max-width/max-height on an
             auto-sized image: bounding both axes is what normalises optical
             weight across the set (wide wordmarks fit to width, tall lockups
             to height), and sizing the box outright means it holds its space
             before the bitmap loads instead of collapsing to 0x0 — an auto
             width/height would override the width/height attributes that
             next/image relies on to reserve that space. object-fit centres
             and preserves ratio, so the rendered art is identical either way. */
          width: 132px;
          height: 48px;
          object-fit: contain;
        }
        /* An upload or padded master canvas carries its padding inside the
           frame, so it needs a taller box for comparable weight — the same
           split the /developers grid makes. */
        .bz-devmarquee__logo--padded { width: 150px; height: 100px; }
        .bz-devmarquee__name {
          max-width: 160px;
          font-size: 20px;
          line-height: 1.15;
          letter-spacing: -0.01em;
          text-align: center;
          white-space: normal;
          color: var(--bz-ink, #1a1a1a);
        }
        @media (min-width: 768px) {
          .bz-devmarquee__track { gap: 20px; }
          .bz-devmarquee__tile { min-width: 240px; height: 128px; padding: 0 40px; }
          .bz-devmarquee__logo { width: 160px; height: 56px; }
          .bz-devmarquee__logo--padded { width: 180px; height: 120px; }
          .bz-devmarquee__name { font-size: 22px; }
        }
        @keyframes bz-devmarquee-scroll {
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
        [dir="rtl"] .bz-devmarquee__track {
          animation-name: bz-devmarquee-scroll-rtl;
        }
        @keyframes bz-devmarquee-scroll-rtl {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(50%, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bz-devmarquee__track { animation: none; }
        }
        /*
         * This is where the marquee used to STOP on a phone.
         *
         * An @media (hover: none) branch turned it into a hand-scrolled rail
         * — animation none, overflow-x auto, duplicate tiles hidden — on the
         * reasoning that a hover-less pointer never fires the pause rules
         * above, so "the tile under a thumb is not the tile that gets opened".
         *
         * That reasoning was never measured, and the numbers do not support
         * it. At 375px the track is 6406px over a 197s cycle: 16.3 px/s. A
         * 150ms tap drifts 2.4px. A tile is 200px wide. The tap lands on the
         * tile you aimed at with 98.8% of its width to spare — and the partner
         * marquee, which never had this branch, has been animating on phones
         * at twice that speed the whole time.
         *
         * What the branch cost was the thing the section is for: a phone
         * visitor saw a static row of three logos and no sign the other
         * twenty-seven existed. The :active rule above covers the residual
         * risk far more cheaply, since a press pauses the strip before the
         * tap completes.
         *
         * Note this branch was also the only thing overriding the RTL
         * animation-name, so removing it is what makes the strip run
         * left-to-right on an Arabic phone, matching Arabic desktop.
         *
         * Reduced motion still stops it dead (the rule above), which is the
         * one case where a still strip is correct.
         */
      `}</style>
    </div>
  );
}
