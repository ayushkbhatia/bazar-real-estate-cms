import type { SeedKey } from "@/lib/master-pages";

/**
 * Shared vocabulary for the field editor.
 *
 * These lived inside `pages/master/[key]/_editor.tsx` and were deep-imported by
 * seven unrelated screens — a `"use client"` route file is a poor home for a
 * type. They sit here so the master-page editor, the sub-page editors and the
 * page builder can all name the same things.
 */

export type MediaOption = {
  id: string;
  filename: string;
  url: string;
  /** Lets image fields offer only images and file fields only documents. */
  mime?: string | null;
};

/**
 * What a record picker shows about an option beyond its name.
 *
 * A name alone is not enough to choose a listing by: three live listings are
 * called "Yas Riva Reserve", all on Yas Island, and the reference that tells
 * them apart was the stored value, never shown. With a `detail` on its options
 * a record select renders as a searchable picker with a photo, the reference,
 * the facts and the price; without one it stays a plain `<select>`, so a seed
 * that has nothing more to say costs nothing.
 */
export type SeedDetail = {
  /** A small photo — the listing's hero, the project's cover. */
  thumb?: string | null;
  /** The mono line: a listing reference, a project's developer. */
  code?: string | null;
  /** The quiet line under the name: "Villa · Yas Island". */
  sub?: string | null;
  /** Figures that tell two similar records apart: "5 bed", "5,942 ft²". */
  facts?: string[];
  /** Set apart at the end of the row: "AED 13.3M". */
  price?: string | null;
  /** A short chip: "For sale", "For rent", "Sold out". */
  badge?: string | null;
  /** The public page, opened from the picked card in a new tab. */
  href?: string | null;
};

export type SeedItem = {
  name: string;
  href: string;
  slug: string;
  detail?: SeedDetail;
};

/**
 * Live records behind a list or picker, split by role:
 *
 *  - `options` — everything that *can* be picked (every published development).
 *  - `current` — what the page is showing *right now*, in page order. This is
 *    what the "load what's on the page" button fills in, so the editor starts
 *    from the live section rather than the whole catalogue.
 */
export type SeedSource = { options: SeedItem[]; current: SeedItem[] };
export type Seeds = Partial<Record<SeedKey, SeedSource>>;

/** The one input/select/textarea class string every admin field uses. */
export const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[12.5px]";
