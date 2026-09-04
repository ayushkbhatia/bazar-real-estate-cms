"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Testimonial } from "@/lib/seeds/awards";

/**
 * The reviews, as a continuous carousel.
 *
 * ## Why a carousel and not the three-up grid it replaced
 *
 * The grid hard-capped the section at three cards, and the cap was structural
 * rather than editorial: a fourth review had nowhere to render, so the CMS list
 * existed mostly as a bench nobody could put on the field. A rail decouples the
 * two — the editor decides how many reviews the site has, the section shows all
 * of them, and the layout stops being an opinion about the count.
 *
 * The pattern is `DeveloperMarquee`'s, deliberately: same doubled track, same
 * pause-on-hover, same reduced-motion and RTL handling, so the two bands on the
 * home page read as one system. Three things differ, all forced by the content
 * being prose rather than logos.
 *
 * 1. **Below `md` it is a manual snap rail, not an animation.** A logo sliding
 *    past is legible; a paragraph is not, and a phone has no hover to pause it
 *    with. Under `md` the duplicate copies are hidden and the track becomes a
 *    plain scroll-snap rail — which is exactly what `CarouselGrid` gave this
 *    section before, so mobile behaviour is unchanged.
 * 2. **The set is repeated until it overflows.** The developer marquee has 30
 *    tiles and can assume the track is wider than any viewport. Three reviews
 *    are not, and a track narrower than its container would slide off and leave
 *    a hole. `REPEAT_UNTIL` is the floor; `copies` is always even so the -50%
 *    translate still lands on an identical frame.
 * 3. **Duration is computed, not fixed.** Cards are one width, so
 *    `base × stride ÷ SPEED` keeps a 24-review rail moving at the same px/s as
 *    a 3-review one instead of sprinting through the long list.
 */

/**
 * One card's outer width at `md` and up — 380px card + its 24px trailing
 * margin. Keep in step with the CSS below: it is both the duration arithmetic
 * and the distance the -50% keyframe travels per card.
 */
const STRIDE = 404;

/** How fast the rail travels, px/s. Matched to `DeveloperMarquee`. */
const SPEED = 40;

/** Repeat the set until one copy is at least this many cards wide. */
const REPEAT_UNTIL = 6;

/**
 * Quote characters the card draws itself, so a quote that already carries them
 * is not wrapped twice.
 *
 * The field's help has said "Quote marks are drawn by the card — don't type
 * them" since it shipped, and the client typed them anyway: every one of the
 * ten reviews in production renders as ““…””. Both readings of that are worse
 * than stripping — the editor cannot see the card's own marks from the form,
 * and rewriting ten rows fixes it only until the eleventh.
 *
 * Stripped only when a string opens AND closes with a matching pair, so a
 * quote that merely contains a quoted phrase is left alone. Arabic uses the
 * guillemets, hence the last pair.
 */
const QUOTE_PAIRS: readonly (readonly [string, string])[] = [
  ['"', '"'],
  ["\u201C", "\u201D"],
  ["\u201E", "\u201C"],
  ["\u00AB", "\u00BB"],
];

export function unwrapQuote(quote: string): string {
  const text = quote.trim();
  for (const [open, close] of QUOTE_PAIRS) {
    if (
      text.length > open.length + close.length &&
      text.startsWith(open) &&
      text.endsWith(close)
    ) {
      return text.slice(open.length, text.length - close.length).trim();
    }
  }
  return text;
}

function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function TestimonialCarousel({ items }: { items: Testimonial[] }) {
  const t = useTranslations("common");
  if (items.length === 0) return null;

  // One copy has to overflow the widest viewport on its own, and the number of
  // copies has to be even — the animation translates the track by exactly half
  // its width, so an odd count would jump at the wrap.
  const repeats = Math.max(1, Math.ceil(REPEAT_UNTIL / items.length));
  const loop = Array.from({ length: repeats * 2 }, () => items).flat();
  const duration = Math.round((repeats * items.length * STRIDE) / SPEED);

  return (
    <div
      className="bz-treviews"
      role="group"
      aria-label={t("testimonials.carousel")}
      style={{ ["--bz-treviews-duration" as string]: `${duration}s` }}
    >
      <div className="bz-treviews__track">
        {loop.map((r, i) => {
          // Copies past the first are decorative: the same words already sit in
          // the accessibility tree once, and announcing them six times is worse
          // than announcing them none.
          const duplicate = i >= items.length;
          return (
            <figure
              key={`${r.id}-${i}`}
              className={
                duplicate
                  ? "bz-treviews__item bz-treviews__item--dup"
                  : "bz-treviews__item"
              }
              aria-hidden={duplicate || undefined}
            >
              <div
                className="flex gap-1 text-bz-accent"
                role="img"
                aria-label={t("testimonials.rating")}
              >
                {[0, 1, 2, 3, 4].map((s) => (
                  <Star key={s} size={16} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <blockquote
                className="serif serif-body mt-5 flex-1 text-[18px] md:text-[20px] leading-[1.4] tracking-tight"
                style={{ letterSpacing: "-0.01em" }}
              >
                &ldquo;{unwrapQuote(r.quote)}&rdquo;
              </blockquote>
              <figcaption className="mt-7 flex items-center gap-3 border-t border-bz-border pt-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bz-surface-3 text-[13px] font-medium text-bz-ink">
                  {initialsOf(r.attribution)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-bz-ink-2">
                    {r.attribution}
                  </span>
                  {r.context ? (
                    <span className="block text-[11.5px] text-bz-muted">
                      {r.context}
                    </span>
                  ) : null}
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>

      <style>{`
        /*
         * Mobile is the rail this section already had: bleeding to the page
         * edge (the parent pads 16px), snapping card to card, no animation.
         * Only the first copy exists down here — see the docblock.
         */
        .bz-treviews {
          position: relative;
          margin-inline: -16px;
          padding-inline: 16px;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
        }
        .bz-treviews::-webkit-scrollbar { display: none; }
        .bz-treviews__track {
          display: flex;
          width: max-content;
          align-items: stretch;
          /*
           * The space between cards is the ITEM'S margin, not the track's
           * flex gap, and that is load-bearing rather than stylistic.
           *
           * A flex gap sits *between* items, so a doubled track of 2n cards
           * carries 2n-1 of them. Half of that width is one gap short of one
           * full copy, and the -50% keyframe lands the wrap half a gap out of
           * register - a visible stutter every cycle, which is exactly what
           * measuring the live rail showed: 8056px wide against 4040px of
           * actual copy.
           *
           * A trailing margin on every card makes the track exactly
           * 2n x (card + gap), so 50% of it is exactly one copy.
           */
        }
        .bz-treviews__item {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          width: 85vw;
          max-width: 380px;
          margin-inline-end: 16px;
          scroll-snap-align: start;
          margin: 0;
          padding: 28px;
          border: 1px solid var(--bz-border, #e7e4db);
          border-radius: 8px;
          background: var(--bz-surface, #ffffff);
        }
        .bz-treviews__item--dup { display: none; }

        @media (min-width: 768px) {
          .bz-treviews {
            margin-inline: 0;
            padding-inline: 0;
            overflow: hidden;
            scroll-snap-type: none;
            /* Same edge fade as the developer and partner marquees, so the
               cards enter and leave rather than being clipped mid-word. */
            -webkit-mask-image: linear-gradient(
              90deg,
              transparent 0,
              #000 5%,
              #000 95%,
              transparent 100%
            );
            mask-image: linear-gradient(
              90deg,
              transparent 0,
              #000 5%,
              #000 95%,
              transparent 100%
            );
          }
          .bz-treviews__track {
            animation: bz-treviews-scroll var(--bz-treviews-duration, 60s) linear
              infinite;
          }
          /* Reading a quote takes longer than the rail gives you, so hovering
             or tabbing anywhere near it stops the world. */
          .bz-treviews:hover .bz-treviews__track,
          .bz-treviews:focus-within .bz-treviews__track {
            animation-play-state: paused;
          }
          .bz-treviews__item {
            width: 380px;
            max-width: none;
            margin-inline-end: 24px;
          }
          .bz-treviews__item--dup { display: flex; }
        }

        @keyframes bz-treviews-scroll {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        /*
         * RTL runs the other way, and it is not cosmetic — see the long note in
         * developer-marquee.tsx. Under dir=rtl the max-content track's overflow
         * spills LEFT, so translating -50% drags it off the start of the page
         * and it never comes back.
         */
        [dir="rtl"] .bz-treviews__track {
          animation-name: bz-treviews-scroll-rtl;
        }
        @keyframes bz-treviews-scroll-rtl {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(50%, 0, 0); }
        }

        /*
         * Last, so it wins over the md block above at equal specificity: a
         * reader who asked for no motion gets the mobile rail at every width —
         * scrollable, one copy, nothing moving on its own.
         */
        @media (prefers-reduced-motion: reduce) {
          .bz-treviews {
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-mask-image: none;
            mask-image: none;
          }
          .bz-treviews__track { animation: none; }
          .bz-treviews__item--dup { display: none; }
        }
      `}</style>
    </div>
  );
}
