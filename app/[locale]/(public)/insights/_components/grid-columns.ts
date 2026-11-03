/**
 * The article grid's columns, shared by /insights and the category and author
 * archives so the three fill a wide screen the same way.
 *
 * Column count follows the viewport rather than a fixed breakpoint ladder:
 * one card per 280px track, so a wide monitor gets more cards instead of wider
 * ones and there is no width at which the grid stops filling the page. The
 * 280px floor is chosen to reproduce the old 1/2/3-column ladder at its
 * breakpoints (2-up from 640, 3-up from 1024) and keep going past it.
 * `min(280px, 100%)` stops a track outgrowing its container on a narrow phone,
 * which would otherwise push the grid wider than the viewport.
 */
export const ARTICLE_GRID_COLUMNS =
  "grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))]";

/** A card's image `sizes` in that grid: never much past 400px once 2-up. */
export const ARTICLE_CARD_SIZES = "(min-width: 640px) 400px, 100vw";
