"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the document is currently rendering right-to-left.
 *
 * Reads `<html dir>`, which the root layout sets from the route locale. That
 * is deliberate rather than reading the locale directly: `dir` is the thing
 * the browser's own scroll and layout behaviour keys off, so a component that
 * compensates for RTL scrolling should compensate against exactly the same
 * signal, not a value that could in principle disagree with it.
 *
 * `useSyncExternalStore` with a `false` server snapshot, matching the pattern
 * `lib/preferences/provider.tsx` established: SSR and the hydration render
 * agree on LTR, then the value settles on the client. Direction never changes
 * within a page — switching locale is a full navigation — so `subscribe` is a
 * no-op and the value is read once.
 */
const subscribe = () => () => {};

function getSnapshot(): boolean {
  return document.documentElement.dir === "rtl";
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsRtl(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
