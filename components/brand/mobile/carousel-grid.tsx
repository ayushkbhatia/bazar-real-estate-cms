import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const MD_COLS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

/**
 * Grid on desktop, snap carousel on mobile (handoff pattern 2) — in a
 * SINGLE DOM tree. Below md the children become a horizontal snap rail
 * (edge-bleed gutter, peeking the next card); at md+ they reflow into a
 * `mdCols`-column grid. One tree means no duplicated markup and no
 * double hero-image load (vs. rendering separate `hidden`/`md:block`
 * trees).
 *
 * Children should be the cards themselves (e.g. <Link><ListingCard/></Link>);
 * their mobile width is driven by the `itemWidth` CSS var and reset to
 * auto at md.
 */
export function CarouselGrid({
  cols = 3,
  itemWidth = "80%",
  className,
  children,
}: {
  cols?: 2 | 3 | 4;
  itemWidth?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{ "--rail-w": itemWidth } as CSSProperties}
      className={cn(
        // Mobile: snap rail bleeding to the page edge (assumes a 16px
        // padded parent), children fixed-width + snap-aligned.
        "flex snap-x snap-mandatory gap-4 overflow-x-auto -mx-4 px-4",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "[&>*]:shrink-0 [&>*]:snap-start [&>*]:w-[var(--rail-w)]",
        // Desktop: reset to a grid.
        "md:mx-0 md:grid md:gap-6 md:overflow-visible md:px-0 md:snap-none",
        "md:[&>*]:w-auto",
        MD_COLS[cols],
        className,
      )}
    >
      {children}
    </div>
  );
}
