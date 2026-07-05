"use client";

import { useSyncExternalStore } from "react";

/**
 * True only on a desktop-width viewport with motion allowed. Read via
 * useSyncExternalStore so it's SSR-safe (server renders `false` → poster only)
 * and reacts to viewport / reduced-motion changes without a setState-in-effect.
 */
function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const desktop = window.matchMedia("(min-width: 768px)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  desktop.addEventListener("change", cb);
  reduced.addEventListener("change", cb);
  return () => {
    desktop.removeEventListener("change", cb);
    reduced.removeEventListener("change", cb);
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return (
    window.matchMedia("(min-width: 768px)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Full-bleed hero background video. The poster image is always painted (so the
 * hero has an instant, correct backdrop on first paint and on mobile), and the
 * <video> is only mounted — and the ~15 MB file only fetched — on desktop with
 * motion allowed. Mobile and `prefers-reduced-motion` users keep the poster,
 * which avoids a heavy download on cellular and respects the motion setting.
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
