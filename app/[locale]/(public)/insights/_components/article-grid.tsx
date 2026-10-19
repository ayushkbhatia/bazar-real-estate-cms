"use client";

import * as React from "react";
import { ArrowDown } from "lucide-react";

/**
 * The /insights grid, a page at a time: the first `initial` cards, then
 * `step` more per press of "Load more". The cards are server-rendered and all
 * arrive with the page, so revealing more is instant and the route stays
 * static — no `?show=` querystring, which would make it dynamic. What a
 * hidden card does not do is mount, so its thumbnail and its article's cover
 * are not fetched until it is shown.
 */
export function ArticleGrid({
  cards,
  initial,
  step,
  loadMoreLabel,
  className,
}: {
  cards: React.ReactNode[];
  initial: number;
  step: number;
  loadMoreLabel: string;
  className?: string;
}) {
  const [shown, setShown] = React.useState(initial);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const focusFrom = React.useRef<number | null>(null);

  // Keyboard and screen-reader users land on the first new card rather than
  // being left on a button that may have just disappeared.
  React.useEffect(() => {
    const from = focusFrom.current;
    if (from === null) return;
    focusFrom.current = null;
    gridRef.current?.children[from]?.querySelector<HTMLElement>("a")?.focus();
  }, [shown]);

  return (
    <>
      <div ref={gridRef} className={className}>
        {cards.slice(0, shown)}
      </div>
      {shown < cards.length ? (
        <div className="flex justify-center pt-14">
          <button
            type="button"
            onClick={() => {
              focusFrom.current = shown;
              setShown((n) => Math.min(n + step, cards.length));
            }}
            className="inline-flex items-center gap-1.5 h-11 px-5 rounded-md border border-bz-border bg-bz-bg text-[13px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
          >
            <ArrowDown size={13} strokeWidth={1.7} aria-hidden />
            {loadMoreLabel}
          </button>
        </div>
      ) : null}
    </>
  );
}
