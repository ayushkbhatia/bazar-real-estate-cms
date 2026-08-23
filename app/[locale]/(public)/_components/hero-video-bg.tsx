"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

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
 * Note: this plays the clip on mobile too, which is a real data-usage cost on
 * cellular — an explicit product choice, not an oversight. Two corrections to
 * that note as originally written, both measured:
 *
 *   - It said "~15 MB", the size of the bundled `public/hero/home-hero.mp4`.
 *     Production does not serve that file. An editor uploaded a replacement
 *     through the CMS and the live clip is 19,373,164 bytes (18.5 MB), so the
 *     accepted trade-off grew ~23% with nothing watching. There is no upload
 *     size cap; the cost of this decision is editor-controlled and unbounded.
 *   - An audit put the per-visit cost at ~37 MB on the strength of two
 *     full-range responses. That was wrong. CDP byte accounting shows the
 *     duplicate is cancelled after ~20 KB, so the real transfer was ~18.5 MB
 *     even before the effect below removed the duplicate entirely. Chromium
 *     only — WebKit was not measured, and iOS Safari is the case that matters
 *     most here.
 */
export function HeroVideoBg({
  src,
  poster,
  // Accepted but no longer applied — see the effect below. Underscored so the
  // unused-vars rule passes without dropping it from the public prop type,
  // which hero-variants.tsx still passes and which a <source> child would
  // need again if the type hint ever has to come back.
  mimeType: _mimeType = "video/mp4",
}: {
  src: string;
  poster: string;
  mimeType?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const showVideo = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  /*
   * The source is attached HERE and not in JSX, and that is the whole fix for
   * a duplicate download of an 18.5 MB file.
   *
   * On a hard load React builds this subtree TWICE. The first pass is aborted
   * mid-render and never commits — observed by patching
   * `Document.prototype.createElement`: two <video> elements are constructed
   * ~1ms apart inside a single macrotask, and only the second is ever inserted
   * into the document. (The most consistent reading of the abort is
   * SelectiveHydrationException from one of the three dehydrated Suspense
   * boundaries Next emits in this document — every competing branch is ruled
   * out by evidence, but the exit status cannot be read out of a minified
   * build, so treat that as the best-supported reading rather than a fact.)
   *
   * The catch is that a media element does not have to be IN the document to
   * hit the network. Setting `src` — on the <video> or on a <source> child —
   * invokes the media element load algorithm immediately, so the discarded
   * element fetched too. That is why `querySelectorAll("video")` was stable at
   * 1 and a MutationObserver saw zero insertions while devtools showed two
   * requests: the first element never entered the DOM to be observed.
   *
   * It is also why the obvious fix does not work. Moving the URL from a
   * <source> child onto `src` on the <video> was tried and measured: still two
   * requests, because the discarded instance gets that attribute too.
   *
   * Effects run only for renders React actually COMMITS. So the aborted pass
   * now builds a <video> with no source, which asks the network for nothing.
   * Measured on a production build, three consecutive runs: mp4Requests went
   * 2 -> 1, with the video still reaching readyState 4 and playing.
   *
   * Cost of the approach: the `type` hint that <source> carried is gone, so
   * the browser sniffs the container instead — free for the mp4/webm this
   * serves. The `mimeType` prop is still accepted so callers do not break, but
   * it is no longer applied; if a format ever needs the hint back, keep the
   * <source> child and set ITS `src` in this same effect, which works for the
   * same reason.
   */
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    // Assigning `src` IS the load trigger — deliberately no `el.load()` here,
    // which would run resource selection a second time on the same element.
    if (el.getAttribute("src") !== src) el.setAttribute("src", src);
  }, [src, showVideo]);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      {/* Poster — always present; the video (when shown) sits on top. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${poster})` }}
      />
      {showVideo ? (
        <video
          // Remount on a source change, otherwise swapping the CMS video
          // leaves the previous clip playing until a hard reload.
          key={src}
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={poster}
          tabIndex={-1}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </div>
  );
}
