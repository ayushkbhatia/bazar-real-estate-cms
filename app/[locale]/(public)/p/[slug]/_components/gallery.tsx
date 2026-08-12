"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
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
            overlay={remaining > 0 ? `+${remaining} photos` : undefined}
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
          sizes={priority ? "(min-width: 1024px) 66vw, 100vw" : "(min-width: 1024px) 33vw, 50vw"}
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

function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: GalleryImage[];
  startIndex: number;
  onClose: () => void;
}) {
  const rtl = useIsRtl();
  const [index, setIndex] = useState(startIndex);
  const total = images.length;

  const next = useCallback(
    () => setIndex((i) => (i + 1) % total),
    [total],
  );
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + total) % total),
    [total],
  );

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
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, next, prev, rtl]);

  const current = images[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close gallery"
        className="absolute top-4 end-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
      >
        <X size={18} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={prev}
        aria-label="Previous photo"
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

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 mono text-[12px] text-white/80">
        {index + 1} / {total}
      </div>
    </div>
  );
}
