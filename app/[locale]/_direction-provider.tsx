"use client";

import { Direction } from "radix-ui";

/**
 * Radix's direction context, mounted from the (server) root layout.
 *
 * It needs its own client module because `DirectionProvider` is built on
 * `createContext`, and importing it straight into the server layout fails the
 * build with `k.createContext is not a function`.
 *
 * This is not redundant with `<html dir>`. The two mechanisms cover different
 * things and both are required:
 *
 *   - CSS `direction` inherits through the DOM. That is what portalled
 *     content — dialogs, popovers, the map canvas — computes against, and it
 *     is why `dir` belongs on `<html>` rather than on a wrapper div.
 *   - Radix reads React context and hard-defaults to "ltr" when no provider is
 *     mounted, so `<html dir>` is invisible to it. Without this, six of the
 *     sixteen shadcn primitives keep LTR keyboard traversal and alignment in
 *     an otherwise RTL page.
 */
export function DirectionProvider({
  dir,
  children,
}: {
  dir: "ltr" | "rtl";
  children: React.ReactNode;
}) {
  return (
    <Direction.DirectionProvider dir={dir}>
      {children}
    </Direction.DirectionProvider>
  );
}
