/**
 * The `sizes` the listing gallery hands next/image, in a module of their own
 * so the search results can warm the very same variants before the visitor
 * clicks through (`app/[locale]/(public)/_components/gallery-prefetch.tsx`).
 * A prefetch with a different `sizes` picks a different `w=` from the srcset
 * and warms a URL the gallery never asks for, so both read these constants.
 *
 * They follow the grid in gallery.tsx: below `md` the hero is the full width
 * and each tile half of it; from `md` the grid is four columns, the hero two
 * of them and each tile one. The old values (66vw / 33vw at `lg`) asked for
 * roughly 1.3× the pixels the tiles show.
 */
export const GALLERY_HERO_SIZES = "(min-width: 768px) 50vw, 100vw";
export const GALLERY_TILE_SIZES = "(min-width: 768px) 25vw, 50vw";

/** Tiles the gallery grid shows before "+N photos": the hero and four more. */
export const GALLERY_VISIBLE_TILES = 5;
