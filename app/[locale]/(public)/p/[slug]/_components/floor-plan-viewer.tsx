"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";

/**
 * The uploaded floor plan, rendered so the detail survives the trip.
 *
 * A floor plan is the one asset on this page that is read rather than looked
 * at — hairline walls, 10px room labels, dimension strings — and all three of
 * the defaults that are right for photography were wrong for it:
 *
 * - **Quality.** The optimizer re-encodes to WebP at q75. On a photo the
 *   artefacts land in texture; on line art they land on the strokes and the
 *   labels. Measured against the source PNG that is 38 dB PSNR, and the
 *   ringing is visible at 1:1. `quality={100}` takes it to 48 dB — the file
 *   goes 94 KB → 487 KB, still a quarter of the 2 MB original, and it is one
 *   image per listing behind a 31-day optimizer TTL. `next.config.ts` has to
 *   allowlist the value; Next 16 400s any `quality` not in `images.qualities`.
 *
 * - **`sizes`.** Both call sites under-declared their slot (720px for a box
 *   that measures 936px, 1100px for one that measures 1344px). A 1× display
 *   picked the 750w variant for a ~900px box and upscaled it. The callers now
 *   pass the real layout arithmetic.
 *
 * - **The frame.** A fixed `aspect-[16/10]` letterboxes anything that isn't
 *   16:10 — a portrait stack plan rendered at 44% of the available width. The
 *   frame adopts the image's own ratio once it loads (clamped, so a freak
 *   panorama can't flatten the section or a tall plan run the page off).
 *
 * None of that makes a 1448px plan legible in a 900px box, though, so the
 * plan also opens: fit-to-screen, then 1:1 native pixels with drag-to-pan.
 * That is the actual answer to "I want to read the dimensions".
 */

const FALLBACK_RATIO = 16 / 10;
/** Clamp on the frame, not the image — `object-contain` letterboxes the rest. */
const MIN_RATIO = 0.6;
const MAX_RATIO = 2.4;
/**
 * Largest entry in `deviceSizes`, and what the full-size view asks for.
 *
 * It has to be an exact device size, and `sizes` has to name the same number,
 * or the browser's density correction shrinks the result: with a `w`-descriptor
 * srcset it divides the decoded width by (candidate ÷ slot) before laying the
 * image out. Ask for 3840 in a 3840px slot and the density is 1, so the image
 * lands at its own pixels. The optimizer clamps down to the source width, so a
 * smaller plan is served — and displayed — at native size rather than upscaled.
 */
const NATIVE_REQUEST_W = 3840;

export function FloorPlanViewer({
  src,
  alt,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  /** The real slot width, as layout arithmetic — see the note above. */
  sizes: string;
  priority?: boolean;
}) {
  // The image's own ratio, read off the element once it loads. `naturalWidth`
  // is density-corrected under a `w`-descriptor srcset and so is no use as a
  // pixel count — but the correction scales both axes, so the ratio survives.
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const ratio = imageRatio
    ? Math.min(Math.max(imageRatio, MIN_RATIO), MAX_RATIO)
    : FALLBACK_RATIO;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${alt} — open full screen`}
        className="group relative block w-full rounded-lg overflow-hidden border border-bz-border bg-bz-surface cursor-zoom-in"
        style={{ aspectRatio: String(ratio) }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          quality={100}
          priority={priority}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              setImageRatio(img.naturalWidth / img.naturalHeight);
            }
          }}
          className="object-contain p-2"
        />
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bz-ink/85 text-bz-bg text-[11.5px] font-medium opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
          <Maximize2 size={12} strokeWidth={1.7} />
          Enlarge
        </span>
      </button>

      {open ? (
        <FloorPlanOverlay
          src={src}
          alt={alt}
          ratio={imageRatio ?? FALLBACK_RATIO}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function FloorPlanOverlay({
  src,
  alt,
  ratio,
  onClose,
}: {
  src: string;
  alt: string;
  ratio: number;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const panRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
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
  }, [onClose]);

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
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
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

      {zoomed ? (
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
      ) : (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close floor plan"
          className="relative w-[min(96vw,1600px)] h-[min(88vh,1000px)] cursor-zoom-out"
        >
          <Image
            src={src}
            alt={alt}
            fill
            sizes="96vw"
            quality={100}
            priority
            className="object-contain"
          />
        </button>
      )}

      <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[12px] text-white/70">
        {zoomed ? "Drag to pan · " : ""}
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-white"
        >
          Open the original
        </a>
      </p>
    </div>
  );
}
