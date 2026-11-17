/**
 * Bazar's letterhead, as a full-page A4 image a PDF page is drawn on.
 *
 * `assets/letterhead-a4.jpg` is the client's letterhead (logo top left;
 * phone, email, address, QR code and the teal band at the foot), rendered at
 * 250 dpi with the print bleed trimmed to A4. The PDF it came from is one
 * page of stacked JPEGs, so an image loses nothing against it.
 *
 * Where a page's own content may sit, in points on A4 (595.28 × 841.89):
 * below the logo, above the footer's rule, between the rule's ends.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

export const LETTERHEAD_SAFE = {
  /** The logo's foot is at 119pt. */
  top: 138,
  /** The footer's rule is at 743pt; content stops 14pt above it. */
  bottom: 842 - 729,
  /** The footer's rule runs from 41pt to 554pt. */
  side: 41,
  /** Beside the logo, the space a title can share with it. */
  headerTop: 40,
} as const;

let cached: Buffer | null = null;

/** The letterhead image, read once per server instance. */
export function letterheadImage(): Buffer {
  cached ??= readFileSync(path.join(process.cwd(), "lib/pdf/assets/letterhead-a4.jpg"));
  return cached;
}
