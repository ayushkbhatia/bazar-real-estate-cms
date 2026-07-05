"use client";

import { useSyncExternalStore } from "react";

/**
 * True whenever motion is allowed (all viewport widths — mobile included).
 * Read via useSyncExternalStore so it's SSR-safe (server renders `false` →
 * poster only, avoiding a hydration mismatch) and reacts live to a
 * prefers-reduced-motion change without a setState-in-effect.
 */
function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduced.addEventListener("change", cb);
  return () => {
    reduced.removeEventListener("change", cb);
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Full-bleed hero background video. The poster image is always painted (so
 * the hero has an instant, correct backdrop on first paint before the video
 * is ready), and the <video> mounts on every viewport width — mobile included
 * — except for `prefers-reduced-motion`, which keeps the poster.
 *
 * Note: this plays the ~15 MB clip on mobile too, which is a real data-usage
 * cost on cellular connections — an explicit product choice, not an oversight.
 */
export function HeroVideoBg({
  src,
  poster,
}: {
  src: string;
  poster: string;
}) {
  const showVideo = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {/* Poster — always present; the video (when shown) sits on top. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${poster})` }}
      />
      {showVideo ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={poster}
          tabIndex={-1}
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={src} type="video/mp4" />
        </video>
      ) : null}
    </div>
  );
}
