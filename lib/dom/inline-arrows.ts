/**
 * Which way an arrow key moves through a sequence, in reading order.
 *
 * In RTL the *next* item is to the left, so ArrowLeft advances and ArrowRight
 * goes back. Left unswapped, a gallery's counter counts up while the image
 * walks backwards — visibly wrong rather than merely unfamiliar, and the kind
 * of thing that reads as a broken control instead of a direction convention.
 *
 * Returns +1 for "next", -1 for "previous", 0 for any other key, so callers
 * can branch on it without repeating the key names.
 */
export function inlineArrowStep(key: string, rtl: boolean): 1 | -1 | 0 {
  if (key === "ArrowRight") return rtl ? -1 : 1;
  if (key === "ArrowLeft") return rtl ? 1 : -1;
  return 0;
}
