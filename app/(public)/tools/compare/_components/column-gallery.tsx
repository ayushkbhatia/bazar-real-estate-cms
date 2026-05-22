"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PlaceholderImage } from "@/components/brand/placeholder-image";

/**
 * Sprint 5b (backfilled): per-column photo gallery on the compare page.
 * Replaces the single thumb the original compare grid showed.
 */
export function ColumnGallery({
  images,
  reference,
}: {
  images: { src: string; alt: string }[];
  reference: string;
}) {
  const [idx, setIdx] = useState(0);

  if (images.length === 0) {
    return (
      <PlaceholderImage
        label={reference}
        className="w-full aspect-[4/3] rounded-md"
      />
    );
  }

  const current = images[idx];

  return (
    <div className="relative w-full aspect-[4/3] rounded-md overflow-hidden bg-bz-surface-2 group">
      <Image
        src={current.src}
        alt={current.alt}
        fill
        sizes="320px"
        className="object-cover"
      />
      {images.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 text-bz-ink flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft size={14} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % images.length)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 text-bz-ink flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight size={14} strokeWidth={1.8} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <span
                key={i}
                className={
                  i === idx
                    ? "w-1.5 h-1.5 rounded-full bg-white"
                    : "w-1.5 h-1.5 rounded-full bg-white/40"
                }
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
