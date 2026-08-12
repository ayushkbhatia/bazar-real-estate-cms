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

export type SeedItem = { name: string; href: string; slug: string };

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
