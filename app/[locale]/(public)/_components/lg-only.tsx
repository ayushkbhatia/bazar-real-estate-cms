"use client";

import { useSyncExternalStore, type ReactNode } from "react";

/**
 * Tailwind v4's `lg`, spelled the way `matchMedia` accepts it.
 *
 * v4's default `lg` is 64rem and it emits `@media (width >= 64rem)` — checked
 * by compiling `lg:block` through this repo's own Tailwind rather than taken
 * from the docs. `(min-width: 64rem)` is the same threshold in the long-
 * supported range syntax. The unit is `rem` on purpose rather than a
 * hardcoded `1024px`: whatever a browser resolves `rem` to inside a media
 * query, it resolves it identically for Tailwind's `lg:` rule and for this
 * string, so the JS gate and the CSS gate cannot disagree about where `lg`
 * begins. A literal 1024 could — if `rem` in a media query ever resolves to
 * anything but 16px (the user-preference font-size case; I have not measured
 * which browsers do what here), the two gates would flip at different widths
 * and the map would mount into a `display:none` box, or fail to mount into a
 * visible one.
 *
 * Module-level, and so are `subscribe`/`getSnapshot` below, because
 * `useSyncExternalStore` re-subscribes whenever `subscribe`'s identity
 * changes. Closing over a per-render query prop would tear down and re-add the
 * listener on every render, which is why this component is single-purpose
 * (`lg`) rather than a generic `useMediaQuery`.
 */
const LG = "(min-width: 64rem)";

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(LG);
  mq.addEventListener("change", onStoreChange);
  return () => {
    mq.removeEventListener("change", onStoreChange);
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  /*
   * No `matchMedia` → render the children.
   *
   * Failing OPEN is deliberate. This gate exists to avoid a download, not to
   * be something a feature depends on: failing open reproduces today's
   * behaviour exactly (the subtree mounts, as it always has), while failing
   * closed would silently delete a desktop map on any engine we mis-detect.
   * Same call `useNearViewport` in `area-map/area-map-home.tsx` makes for a
   * missing IntersectionObserver — "no support → don't block the feature".
   */
  if (!window.matchMedia) return true;
  return window.matchMedia(LG).matches;
}

/**
 * The server has no viewport, so it has to guess — and `false` is the only
 * guess that can be wrong in a cheap direction.
 *
 * React uses this value for the client's HYDRATION render too, then re-reads
 * `getSnapshot` and re-renders if they differ. That is what makes this
 * mismatch-free by construction: server HTML and first client render agree on
 * `false` whatever the device, and a desktop swaps to `true` one render later.
 *
 * `true` would defeat the whole component. The hydration render would mount
 * the children on a phone — long enough for a `next/dynamic` child to fire its
 * import — before the re-render unmounted them, i.e. the download we are here
 * to prevent would still happen.
 */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Mounts `children` only at Tailwind's `lg` breakpoint and up.
 *
 * This is a MOUNT gate, not a paint gate. `hidden lg:block` hides a subtree
 * without stopping React from rendering it, so a `next/dynamic` descendant
 * still fires its loader and still downloads its chunk on a phone that can
 * never see the result. CSS cannot express "do not exist"; this can.
 *
 * Pair it with the `hidden lg:block` rather than replacing it. The CSS keeps
 * owning the box — the wrapper's border, height and grid track stay in the
 * server HTML at every width — so nothing about the layout depends on
 * hydration and there is no shift when the swap happens. Pass `fallback` as
 * whatever the children would have painted while loading, so the box looks
 * identical before hydration, during the import, and after.
 */
export function LgOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  /** Rendered below `lg` and during the hydration render at every width. */
  fallback?: ReactNode;
}) {
  const wide = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return <>{wide ? children : fallback}</>;
}
