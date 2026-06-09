import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Horizontal snap carousel (handoff pattern 2 — grids become rails on
 * mobile). Renders the `.bz-rail` contract from globals.css: inside a
 * 16px-padded parent it bleeds to the page edge and restores the gutter
 * with its own padding so cards snap edge-to-edge. Pass `flush` when the
 * parent is already unpadded to opt out of the negative-margin bleed.
 *
 * Children should be fixed-width (e.g. `w-[300px] shrink-0`) so they
 * snap; `.bz-rail > *` already sets `flex-shrink: 0` and snap-align.
 */
export function SnapRail({
  flush,
  className,
  children,
}: {
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("bz-rail", flush && "bz-rail--flush", className)}>
      {children}
    </div>
  );
}
