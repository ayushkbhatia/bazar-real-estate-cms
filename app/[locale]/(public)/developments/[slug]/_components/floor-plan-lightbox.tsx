"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { inlineArrowStep } from "@/lib/dom/inline-arrows";
import { useIsRtl } from "@/lib/dom/use-is-rtl";

/**
 * Full-screen viewer for a unit type's layouts.
 *
 * A floor plan is read rather than looked at — hairline walls, 10px room
 * labels, dimension strings — and a 360px card is not a size anyone can read
 * one at. So the card image opens, the same way a property's photos do: click
 * the image itself, no separate control.
 *
 * Two things it does that the photo lightbox doesn't:
 *
 * - **Opens on the card's own bytes.** The full-size view wants `q=100` at a
 *   viewport width, which is a different optimizer variant from the card's and
 *   therefore its own cold miss — seconds, on the click. So the card variant
 *   renders underneath first (same `src`, same `sizes`, same quality, so it is
 *   the URL already in the HTTP cache and paints immediately) and the sharp
 *   one fades in over it once it lands.
 *
 * - **Zooms to 1:1.** Fit-to-screen still isn't native pixels for a 1448px
 *   plan, so the view toggles to the image's own resolution with drag-to-pan.
 */

/**
 * The card's real slot, as layout arithmetic.
 *
 * `unit-floor-plans.tsx` renders the grid inside the section's `px-4 md:px-12`
 * at `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` with `gap-5`, and the image
 * sits inside a card whose own `p-4` takes another 32px. So the slot is
 * (100vw − page padding − gaps) ÷ columns − 32:
 *
 * - ≥1024px, 4-up:  (100vw − 96 − 60) ÷ 4 − 32
 * - ≥768px,  2-up:  (100vw − 96 − 20) ÷ 2 − 32
 * - ≥640px,  2-up:  (100vw − 32 − 20) ÷ 2 − 32   (still on the `px-4` padding)
 * - below,   1-up:   100vw − 32 − 32
 *
 * Worth being exact rather than declaring a round `25vw`: an over-declared slot
 * makes the browser pick the next `deviceSizes` candidate up, and every extra
 * candidate anyone requests is another cold optimizer entry to pay for.
 *
 * Exported because the lightbox's under-layer has to request the exact same
 * variant the card did — a `sizes` string that differs by a pixel can pick a
 * different candidate, which is a fresh miss and defeats the point of it.
 */
export const CARD_SIZES =
  "(min-width: 1024px) calc(25vw - 71px), " +
  "(min-width: 768px) calc(50vw - 90px), " +
  "(min-width: 640px) calc(50vw - 58px), " +
  "calc(100vw - 64px)";

/** The fit-to-screen frame is `min(96vw, 1600px)`; 96vw is the binding term. */
export const FIT_SIZES = "96vw";

/**
 * Largest entry in `deviceSizes`, and what the 1:1 view asks for.
 *
 * It has to be an exact device size, and `sizes` has to name the same number,
 * or the browser's density correction shrinks the result: with a `w`-descriptor
 * srcset it divides the decoded width by (candidate ÷ slot) before laying the
 * image out. Ask for 3840 in a 3840px slot and the density is 1, so the image
 * lands at its own pixels. The optimizer clamps down to the source width, so a
 * smaller plan is served — and displayed — at native size rather than upscaled.
 */
const NATIVE_REQUEST_W = 3840;

/** Only used until the image reports its own ratio; the card frame is square. */
const FALLBACK_RATIO = 1;

export type LightboxPlan = {
  id: string;
  src: string;
  alt: string;
  label: string;
  /** "2 bed · 3 bath · 1,240 ft²", already formatted in the visitor's units. */
  meta: string | null;
};

export function FloorPlanLightbox({
  plans,
  index,
  onIndexChange,
  onClose,
}: {
  plans: LightboxPlan[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const rtl = useIsRtl();
  const [zoomed, setZoomed] = useState(false);
  // Keyed by plan id rather than reset per navigation: stepping back to a plan
  // should not re-fall-back to the square frame it has already measured.
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [sharp, setSharp] = useState<Record<string, boolean>>({});

  const total = plans.length;
  const current = plans[index];

  // A pan offset carried across plans would land the next one scrolled to a
  // corner, so stepping to another layout drops back to fit-to-screen.
  const go = useCallback(
    (to: number) => {
      setZoomed(false);
      onIndexChange((to + total) % total);
    },
    [total, onIndexChange],
  );
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else {
        // In RTL the next item is to the LEFT. Unswapped, the counter counts
        // up while the image walks backwards.
        const step = inlineArrowStep(e.key, rtl);
        if (step === 1) next();
        else if (step === -1) prev();
      }
    }
    window.addEventListener("keydown", onKey);
    // The 1:1 view is its own scroll container; without this the page behind
    // scrolls once it hits the end, which reads as the overlay breaking.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, next, prev, rtl]);

  if (!current) return null;

  const ratio = ratios[current.id] ?? FALLBACK_RATIO;

  // `naturalWidth` is density-corrected under a `w`-descriptor srcset and so is
  // no use as a pixel count — but the correction scales both axes, so the ratio
  // survives, and the under-layer can report it before the sharp copy lands.
  const readRatio = (img: HTMLImageElement) => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    const r = img.naturalWidth / img.naturalHeight;
    setRatios((prevRatios) =>
      prevRatios[current.id] === r ? prevRatios : { ...prevRatios, [current.id]: r },
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${current.label} — floor plan`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
    >
      <div className="absolute top-4 end-4 flex items-center gap-2 z-10">
        <button
          type="button"
          onClick={() => setZoomed((z) => !z)}
          aria-label={zoomed ? "Fit to screen" : "View at full size"}
          className="w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
        >
          {zoomed ? (
            <ZoomOut size={18} strokeWidth={1.8} />
          ) : (
            <ZoomIn size={18} strokeWidth={1.8} />
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close floor plan"
          className="w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      {/* Arrows walk the layouts of the unit type that was open, which is the
          comparison a buyer is actually making. Hidden at 1:1, where the same
          drag gesture is panning. */}
      {total > 1 && !zoomed ? (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous layout"
            className="absolute start-4 z-10 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          >
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next layout"
            className="absolute end-4 z-10 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          >
            <ChevronRight size={20} strokeWidth={1.8} />
          </button>
        </>
      ) : null}

      {zoomed ? (
        <NativeSizeView src={current.src} alt={current.alt} ratio={ratio} />
      ) : (
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label={`${current.label} — view at full size`}
          className="relative w-[min(96vw,1600px)] h-[min(88vh,1000px)] cursor-zoom-in"
        >
          {/* The card's own variant: already decoded, so it paints on the same
              frame as the click rather than after a round trip. */}
          <Image
            src={current.src}
            alt=""
            aria-hidden
            fill
            sizes={CARD_SIZES}
            onLoad={(e) => readRatio(e.currentTarget)}
            className="object-contain"
          />
          <Image
            src={current.src}
            alt={current.alt}
            fill
            sizes={FIT_SIZES}
            quality={100}
            priority
            onLoad={(e) => {
              readRatio(e.currentTarget);
              setSharp((s) => (s[current.id] ? s : { ...s, [current.id]: true }));
            }}
            className={`object-contain transition-opacity duration-200 ${
              sharp[current.id] ? "opacity-100" : "opacity-0"
            }`}
          />
        </button>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full px-4 text-center">
        <p className="text-[13px] text-white">
          {current.label}
          {current.meta ? (
            <span className="text-white/60"> · {current.meta}</span>
          ) : null}
        </p>
        <p className="mt-1 text-[11.5px] text-white/60">
          {total > 1 ? (
            <span className="mono">
              {index + 1} / {total} ·{" "}
            </span>
          ) : null}
          {zoomed ? "Drag to pan · " : ""}
          <a
            href={current.src}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-white"
          >
            Open the original
          </a>
        </p>
      </div>
    </div>
  );
}

function NativeSizeView({
  src,
  alt,
  ratio,
}: {
  src: string;
  alt: string;
  ratio: number;
}) {
  const panRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(
    null,
  );

  const startPan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = panRef.current;
    if (!el) return;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
    };
    el.setPointerCapture(e.pointerId);
  }, []);

  const movePan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = panRef.current;
    const d = drag.current;
    if (!el || !d) return;
    el.scrollLeft = d.left - (e.clientX - d.x);
    el.scrollTop = d.top - (e.clientY - d.y);
  }, []);

  const endPan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    panRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      ref={panRef}
      onPointerDown={startPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      className="w-full h-full overflow-auto overscroll-contain cursor-grab active:cursor-grabbing"
    >
      {/* `w-auto h-auto max-w-none` hands layout back to the image so it
          occupies its own pixels — the width/height props only carry the
          aspect ratio here, and the container scrolls around it. */}
      <Image
        src={src}
        alt={alt}
        width={NATIVE_REQUEST_W}
        height={Math.round(NATIVE_REQUEST_W / ratio)}
        quality={100}
        sizes={`${NATIVE_REQUEST_W}px`}
        draggable={false}
        className="max-w-none w-auto h-auto select-none"
      />
    </div>
  );
}
