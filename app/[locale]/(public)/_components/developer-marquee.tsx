"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "@/components/i18n/link";
import { DEVELOPERS_SORTED } from "@/lib/developers/directory-data";
import { trimmedLogo, type TrimmedLogo } from "@/lib/developers/logos";

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
 *    banking partners have no equivalent sub-page), and pausing the scroll on
 *    hover and focus keeps those targets steady enough to actually click.
 *    That pause is hover-only, which is no pause at all on a phone — see the
 *    `@media (hover: none)` branch at the bottom of the stylesheet, where the
 *    marquee turns into a rail the visitor scrolls.
 */

type Tile = { slug: string; name: string; logo: TrimmedLogo };

// A developer with no trimmed asset is skipped rather than rendered at the
// wrong optical weight — see `trimmedLogo`.
const TILES: Tile[] = DEVELOPERS_SORTED.flatMap((d) => {
  const logo = trimmedLogo(d.slug);
  return logo ? [{ slug: d.slug, name: d.name, logo }] : [];
});

export function DeveloperMarquee() {
  const t = useTranslations("common");
  // Two copies of the set → the second copy scrolls into the gap the first
  // leaves, giving a seamless -50% loop.
  const loop = [...TILES, ...TILES];

  return (
    <div className="bz-devmarquee" aria-label={t("marquee.developers")}>
      <div className="bz-devmarquee__track">
        {loop.map((t, i) => {
          // The second copy is decorative: hidden from the accessibility tree,
          // and pulled out of the tab order so keyboard users don't land on a
          // focusable link inside an aria-hidden subtree.
          const duplicate = i >= TILES.length;
          return (
            <Link
              key={`${t.slug}-${i}`}
              href={`/developers/${t.slug}`}
              // The `--dup` marker is what lets the hover-less branch of the
              // stylesheet drop the second copy: it exists only to make the
              // -50% loop seamless, and a hand-scrolled rail has no loop to
              // make seamless — it would just be 30 more tiles to swipe past.
              className={`bz-devmarquee__tile${duplicate ? " bz-devmarquee__tile--dup" : ""}`}
              aria-hidden={duplicate || undefined}
              tabIndex={duplicate ? -1 : undefined}
            >
              <Image
                src={t.logo.src}
                alt={t.name}
                width={t.logo.w}
                height={t.logo.h}
                className="bz-devmarquee__logo"
                sizes="160px"
              />
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
             partner marquee does over 46s, so the two read as one system. */
          animation: bz-devmarquee-scroll 197s linear infinite;
        }
        .bz-devmarquee:hover .bz-devmarquee__track,
        .bz-devmarquee:focus-within .bz-devmarquee__track {
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
        @media (min-width: 768px) {
          .bz-devmarquee__track { gap: 20px; }
          .bz-devmarquee__tile { min-width: 240px; height: 128px; padding: 0 40px; }
          .bz-devmarquee__logo { width: 160px; height: 56px; }
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
         * No hover, no pause — and so no way to tap a tile. On a touch device
         * the two pause rules above never fire, and 30 developer profile links
         * glide past at the same px/s the partner marquee uses; the tile under
         * a thumb is not the tile that gets opened. The home page offers no
         * other route to these profiles.
         *
         * So on a hover-less pointer the marquee stops being an animation and
         * becomes a rail the visitor drives: the track stops and the container
         * scrolls instead of clipping. overscroll-behavior keeps a swipe that
         * runs off the end of the rail from turning into the browser's back
         * gesture.
         *
         * Free scroll, not scroll-snap, and that is the mask's doing. The
         * container fades its first and last 7% to transparent, so a tile
         * snapped with scroll-snap-align:start comes to rest inside the fade
         * and reads as half-drawn. scroll-padding could push it clear, except
         * the mask is a 90deg gradient (physical) while scroll-padding-inline
         * is logical, so the two would disagree under /ar. A plain scroller
         * needs neither, and the fade then reads as "there is more here",
         * which is what it was drawn for.
         *
         * overflow-x on its own rather than the shorthand, so the block axis
         * keeps the hidden it already has: nothing about it needs to change,
         * and this rule stays about the one axis it is about.
         *
         * The RTL selector is repeated on purpose. The rule above it is
         * (0,2,0) and out-specifies a bare class, so under /ar it would put
         * animation-name back and the strip would keep moving.
         */
        @media (hover: none) {
          .bz-devmarquee {
            overflow-x: auto;
            overscroll-behavior-x: contain;
            scrollbar-width: none;
          }
          .bz-devmarquee::-webkit-scrollbar { display: none; }
          .bz-devmarquee__track,
          [dir="rtl"] .bz-devmarquee__track { animation: none; }
          .bz-devmarquee__tile--dup { display: none; }
        }
      `}</style>
    </div>
  );
}
