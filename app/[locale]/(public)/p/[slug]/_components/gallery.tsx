"use client";

import { useTranslations } from "next-intl";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Camera, X, ChevronLeft, ChevronRight } from "lucide-react";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { inlineArrowStep } from "@/lib/dom/inline-arrows";
import { useIsRtl } from "@/lib/dom/use-is-rtl";

export type GalleryImage = {
  src: string | null;
  alt: string;
  label: string;
};

/**
 * Sprint 4c: 5-tile property gallery + lightbox. Tile 1 is the hero spanning
 * 2 columns × 2 rows; tiles 2–5 fill the right column. "+N photos" overlay
 * appears on tile 5 when there are more than 5 images.
 */
export function Gallery({
  images,
  reference,
}: {
  images: GalleryImage[];
  reference: string;
}) {
  const t = useTranslations("property");
  const slots: GalleryImage[] = images.slice(0, 5);
  while (slots.length < 5) {
    slots.push({
      src: null,
      alt: `${reference} placeholder`,
      label: `${reference} · ${slots.length + 1}`,
    });
  }

  const [open, setOpen] = useState<number | null>(null);
  const remaining = Math.max(0, images.length - 5);

  return (
    <>
      <section className="px-0 md:px-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 auto-rows-[120px] sm:auto-rows-[150px] md:auto-rows-auto md:grid-rows-2 md:h-[520px]">
          {/* Hero: spans 2x2 */}
          <Tile
            slot={slots[0]}
            onClick={() => setOpen(0)}
            className="col-span-2 row-span-2"
            priority
          />
          {/* Tiles 2-5 */}
          <Tile slot={slots[1]} onClick={() => setOpen(1)} />
          <Tile slot={slots[2]} onClick={() => setOpen(2)} />
          <Tile slot={slots[3]} onClick={() => setOpen(3)} />
          <Tile
            slot={slots[4]}
            onClick={() => setOpen(4)}
            overlay={
              remaining > 0
                ? t("gallery.morePhotos", { count: remaining })
                : undefined
            }
          />
        </div>
      </section>
      {open != null ? (
        <Lightbox
          images={images.length > 0 ? images : slots}
          startIndex={open}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function Tile({
  slot,
  onClick,
  className,
  priority,
  overlay,
}: {
  slot: GalleryImage;
  onClick: () => void;
  className?: string;
  priority?: boolean;
  overlay?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative overflow-hidden rounded-lg group ${className ?? ""}`}
    >
      {slot.src ? (
        <Image
          src={slot.src}
          alt={slot.alt}
          fill
          priority={priority}
          sizes={
            priority
              ? "(min-width: 1024px) 66vw, 100vw"
              : "(min-width: 1024px) 33vw, 50vw"
          }
          className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
        />
      ) : (
        <PlaceholderImage label={slot.label} className="w-full h-full" />
      )}
      {overlay ? (
        <span className="absolute bottom-3 end-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bz-ink/85 text-bz-bg text-[11.5px] font-medium">
          <Camera size={12} strokeWidth={1.7} />
          {overlay}
        </span>
      ) : null}
    </button>
  );
}

/**
 * How far a thumb has to travel before it counts as a swipe rather than a tap
 * that wandered. 40px is narrower than a fingertip, so a deliberate flick
 * always clears it and the slop on a tap never does.
 */
const SWIPE_MIN_PX = 40;

/**
 * The photo viewer.
 *
 * Radix Dialog rather than the hand-rolled `role="dialog" aria-modal="true"`
 * div this used to be. That attribute is a claim, not a mechanism, and nothing
 * here was backing it: measured at 390px on a production build, `body` stayed
 * `overflow: visible` and the page scrolled 0 → 600px behind the open
 * lightbox, and 3 of 15 tabs walked focus out into the listing underneath. The
 * nav drawer and the filter drawer — same repo, same viewport — measured 25/25
 * contained with working ESC and scroll lock, because they go through the same
 * primitive this now does.
 *
 * `components/brand/mobile/bottom-sheet.tsx` is the shorter route to those
 * three behaviours, but it is a 92dvh sheet with a grab handle and rounded top
 * corners. A photo viewer wants the whole screen at every breakpoint, so this
 * composes the primitive directly and keeps the full-bleed black it always had
 * — nothing above `md` changes, the modal semantics are just real now.
 */
function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: GalleryImage[];
  startIndex: number;
  onClose: () => void;
}) {
  const t = useTranslations("property");
  const rtl = useIsRtl();
  const [index, setIndex] = useState(startIndex);
  const total = images.length;

  const next = useCallback(() => setIndex((i) => (i + 1) % total), [total]);
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + total) % total),
    [total],
  );
  const step = useCallback(
    (direction: 1 | -1 | 0) => {
      if (direction === 1) next();
      else if (direction === -1) prev();
    },
    [next, prev],
  );

  /** Where the finger went down, so touchend can tell a swipe from a tap. */
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const current = images[index];

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/95" />
        <DialogPrimitive.Content
          // The photo's own alt text is the description; without this Radix
          // logs a missing-`aria-describedby` warning on every open.
          aria-describedby={undefined}
          // ESC is Radix's. Arrows stay ours: in RTL the next item is to the
          // LEFT, and unswapped the counter counts up while the image walks
          // backwards. Content is the focus trap's root, so a keypress on any
          // control inside it bubbles here.
          onKeyDown={(e) => step(inlineArrowStep(e.key, rtl))}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            touchStart.current = { x: touch.clientX, y: touch.clientY };
          }}
          onTouchEnd={(e) => {
            const from = touchStart.current;
            touchStart.current = null;
            if (!from || total < 2) return;
            const touch = e.changedTouches[0];
            const dx = touch.clientX - from.x;
            const dy = touch.clientY - from.y;
            // A mostly-vertical drag is someone trying to dismiss or scroll,
            // not to advance; ignoring it keeps the gestures from fighting.
            if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy))
              return;
            // Dragging the photo left uncovers whatever sits to its right,
            // which is the move ArrowRight makes — so the "which way is next"
            // question stays answered in exactly one place, RTL included.
            step(inlineArrowStep(dx < 0 ? "ArrowRight" : "ArrowLeft", rtl));
          }}
          className="fixed inset-0 z-50 flex items-center justify-center outline-none"
        >
          <DialogPrimitive.Title className="sr-only">
            {current.alt}
          </DialogPrimitive.Title>
          {/* `calc(env + 1rem)` rather than `pt-safe`: the page sets
              viewport-fit=cover, so a bare `top-4` puts this under the notch
              on a phone — but the token is 0px everywhere without an inset,
              which is what keeps the desktop position bit-identical. */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("gallery.close")}
            className="absolute top-[calc(var(--bz-safe-top)+1rem)] end-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={prev}
            aria-label={t("gallery.previous")}
            className="absolute start-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          >
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next photo"
            className="absolute end-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          >
            <ChevronRight size={20} strokeWidth={1.8} />
          </button>

          <div className="relative w-[min(92vw,1400px)] h-[min(85vh,900px)]">
            {current.src ? (
              <Image
                src={current.src}
                alt={current.alt}
                fill
                sizes="92vw"
                priority
                className="object-contain"
              />
            ) : (
              <PlaceholderImage
                label={current.label}
                dark
                className="w-full h-full"
              />
            )}
          </div>

          <div className="absolute bottom-[calc(var(--bz-safe-bottom)+1.5rem)] left-1/2 -translate-x-1/2 mono text-[12px] text-white/80">
            {index + 1} / {total}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
