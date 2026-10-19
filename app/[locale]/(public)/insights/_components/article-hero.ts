import { getImageProps } from "next/image";
import { mediaPublicUrl } from "@/lib/media";
import type { ArticleListRow } from "@/lib/queries/articles";

/**
 * The `sizes` the article page draws its cover with. Shared, because the
 * index warms that exact cover before the reader clicks: the optimizer keys a
 * variant on its width, so a card's 400px thumbnail is a different file from
 * the article's 664px cover, and a cover nobody has requested yet is a cold
 * fetch of a ~1.4 MB original — the second or two a reader waited on.
 * Change it here and both pages move together.
 */
export const ARTICLE_COVER_SIZES = "(min-width: 760px) 664px, 100vw";

/** What a card needs to fetch the article's cover the way the article will. */
export type CoverWarmup = { src: string; srcSet?: string; sizes?: string };

/**
 * The cover's `src` / `srcSet` / `sizes`, exactly as `<Image fill
 * sizes={ARTICLE_COVER_SIZES}>` on the article page renders them. Given the
 * same srcset and sizes, the browser picks the same candidate for the same
 * screen — so the request the card makes is the request the article makes,
 * and the article finds it in the cache.
 */
export function coverWarmup(row: ArticleListRow): CoverWarmup | null {
  if (!row.hero) return null;
  const src = mediaPublicUrl(row.hero.storage_key);
  if (!src) return null;
  const { props } = getImageProps({
    src,
    alt: "",
    fill: true,
    sizes: ARTICLE_COVER_SIZES,
  });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}
