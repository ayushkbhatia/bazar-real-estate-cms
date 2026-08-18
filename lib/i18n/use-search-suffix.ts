"use client";

import { useSyncExternalStore } from "react";

/**
 * The current querystring, as a `?…` suffix, safe to call during prerender.
 *
 * ## Why not `useSearchParams`
 *
 * It opts its whole subtree out of static rendering unless wrapped in a
 * Suspense boundary. The locale controls render in the `(public)` layout, so
 * that subtree is *every public route*. The build says so outright — the
 * export died on `useSearchParams() should be wrapped in a suspense boundary
 * at page "/[locale]/legal/cookies"`. Adding the Suspense wrapper would have
 * fixed the build and still cost the prerender, which is the thing
 * `npm run check:routes` exists to protect.
 *
 * ## Why not `useState` + `useEffect`
 *
 * That was the first fix and it works, but `react-hooks/set-state-in-effect`
 * rejects it: a synchronous `setState` in an effect schedules a second render
 * pass for every mount of every public page.
 *
 * ## What this does instead
 *
 * `useSyncExternalStore` is the primitive for reading a mutable external
 * source with a separate server snapshot. The server snapshot is `""`, so the
 * prerendered href is query-less — which is correct for a crawler and correct
 * on any page with no query. The client snapshot is the live search string,
 * read on the first render rather than after it, so the href is complete
 * before anyone can click.
 *
 * `getSnapshot` returns a primitive, so React's identity check settles it
 * without caching, and a re-render triggered by a route change re-reads it.
 */
function subscribe(onChange: () => void): () => void {
  // Back/forward. Next's own client navigations re-render these components via
  // `usePathname`, which re-reads the snapshot anyway.
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

const clientSnapshot = () => window.location.search;
const serverSnapshot = () => "";

export function useSearchSuffix(): string {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
