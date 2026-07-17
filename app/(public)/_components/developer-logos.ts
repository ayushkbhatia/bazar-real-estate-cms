/**
 * Render metadata for the developer logo marquee.
 *
 * The master logos in `/public/developers` are 600×600 square canvases with
 * padding baked in, and the mark inside each one occupies wildly different
 * fractions of that canvas — from 8% of the height (nshama, a 9:1 wordmark) to
 * 83% (q-properties, a tall lockup). Height-normalising those canvases the way
 * `partner-marquee.tsx` does would render some marks ~4× heavier than others,
 * because the partner PNGs are pre-trimmed and land in a tight 0.79–0.93
 * ink-to-canvas band where that shortcut holds.
 *
 * So the marquee renders from `/public/developers/trimmed/<slug>.png` — the
 * same art with the baked-in padding cropped off — and fits each one inside a
 * fixed max-width × max-height box. Constraining both axes normalises optical
 * weight to a ~2× spread (wide wordmarks cap on width, tall lockups on height),
 * which is the even, natural-looking result you want from a logo wall.
 *
 * Dimensions below are the intrinsic pixel sizes of the trimmed PNGs, carried
 * here so `next/image` renders them without layout shift — the same contract as
 * `partners-data.ts`. Identity (slug, name) still comes from the master
 * directory in `../developers/_data`; this file is render metadata only.
 *
 * Regenerate by re-trimming the source PNGs to their ink bounding box; the
 * filename must match the developer's slug.
 */

/** Directory holding the padding-cropped variants of the master logo set. */
const TRIMMED_DIR = "/developers/trimmed";

export type TrimmedLogo = { src: string; w: number; h: number };

/** Intrinsic dimensions of each trimmed logo PNG, keyed by developer slug. */
const TRIMMED_DIMENSIONS: Record<string, { w: number; h: number }> = {
  aldar: { w: 281, h: 310 },
  arada: { w: 459, h: 71 },
  baraka: { w: 368, h: 310 },
  binghatti: { w: 562, h: 334 },
  bloom: { w: 458, h: 142 },
  burtville: { w: 300, h: 284 },
  damac: { w: 447, h: 58 },
  deyaar: { w: 310, h: 308 },
  "dubai-properties": { w: 408, h: 268 },
  "eagle-hills": { w: 215, h: 326 },
  emaar: { w: 397, h: 82 },
  ict: { w: 353, h: 243 },
  imkan: { w: 430, h: 186 },
  meraas: { w: 357, h: 213 },
  miral: { w: 408, h: 203 },
  modon: { w: 422, h: 82 },
  nakheel: { w: 372, h: 172 },
  "nic-developers": { w: 343, h: 166 },
  "nine-yards": { w: 225, h: 338 },
  nshama: { w: 450, h: 51 },
  "ohana-development": { w: 403, h: 149 },
  "q-properties": { w: 362, h: 502 },
  "radiant-real-estate": { w: 418, h: 96 },
  "rak-properties": { w: 236, h: 329 },
  reportage: { w: 456, h: 134 },
  "saas-properties": { w: 350, h: 180 },
  samana: { w: 458, h: 138 },
  sobha: { w: 425, h: 142 },
  taraf: { w: 439, h: 82 },
  "tiger-properties": { w: 477, h: 117 },
};

/**
 * The trimmed logo for a developer, or `undefined` when the slug has no trimmed
 * asset yet — a developer added to the master directory without one is skipped
 * by the marquee rather than rendering at the wrong optical weight.
 */
export function trimmedLogo(slug: string): TrimmedLogo | undefined {
  const dim = TRIMMED_DIMENSIONS[slug];
  if (!dim) return undefined;
  return { src: `${TRIMMED_DIR}/${slug}.png`, ...dim };
}
