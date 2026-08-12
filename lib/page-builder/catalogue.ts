/**
 * The block catalogue.
 *
 * Every entry renders through a component already shipping on an audited public
 * page — /buy, /rent, /, /services/* or /developments/[slug]. That is the whole
 * mobile story: this is a *curation* of existing sections, not a design surface,
 * so a page assembled here inherits the padding rhythm, the `sizes` attributes,
 * the grid-blowout guards and the snap-rail behaviour that those pages were
 * audited for. There is nothing to re-earn per page.
 *
 * Adding a block means adding a def here AND a case in
 * app/(public)/lp/[slug]/_render.tsx — `catalogue.test.ts` fails the build if
 * the two ever disagree.
 */

import type { BlockDef, BlockGroup, BlockInstance } from "./types";
import { OPENER_BLOCKS } from "./blocks/openers";
import { LISTING_BLOCKS } from "./blocks/listings";
import { CONTENT_BLOCKS } from "./blocks/content";
import { CONVERSION_BLOCKS } from "./blocks/conversion";
import { TRUST_BLOCKS } from "./blocks/trust";

export const BLOCK_DEFS: BlockDef[] = [
  ...OPENER_BLOCKS,
  ...LISTING_BLOCKS,
  ...CONTENT_BLOCKS,
  ...CONVERSION_BLOCKS,
  ...TRUST_BLOCKS,
];

const BY_KEY = new Map(BLOCK_DEFS.map((d) => [d.key, d]));

export function getBlockDef(key: string): BlockDef | null {
  return BY_KEY.get(key) ?? null;
}

export function isBlockKey(key: string): boolean {
  return BY_KEY.has(key);
}

/** What the add-block picker offers: everything not deprecated. */
export function pickableBlocks(): BlockDef[] {
  return BLOCK_DEFS.filter((d) => !d.deprecated);
}

export function blocksInGroup(group: BlockGroup): BlockDef[] {
  return pickableBlocks().filter((d) => d.group === group);
}

export { BLOCK_GROUPS } from "./types";

let fallbackId = 0;

/**
 * A stable id for a new block instance.
 *
 * `crypto.randomUUID` is available in every runtime this ships to (Node 18+,
 * and browsers over HTTPS or localhost). The counter is there for the one case
 * that isn't — a page served over plain HTTP on a LAN address during a demo —
 * where an id that is merely unique within the document is enough: it is only
 * ever compared against the other blocks on the same page.
 */
export function mintBlockId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  fallbackId += 1;
  return `blk-${fallbackId}-${String(Date.now())}`;
}

/** A fresh instance of a block, carrying the registry defaults. */
export function newBlockInstance(def: BlockDef): BlockInstance {
  return {
    id: mintBlockId(),
    type: def.key,
    v: def.version ?? 1,
    enabled: true,
    values: structuredClone(def.defaults),
  };
}
