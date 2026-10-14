/**
 * A seeded shuffle, for lists a page shows in a different order per visit.
 *
 * Seeded rather than `Math.random()` inline because the shuffle runs during
 * render: the same seed has to give the same order on every render of one
 * visit, or a re-render (a chip click, a parent state change) would reshuffle
 * cards under the visitor's cursor. The caller draws the seed once.
 */

/** mulberry32 — small, fast, and plenty for picking which cards show first. */
function prng(seed: number): () => number {
  let a = Math.floor(seed * 2 ** 32) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates over a copy. `seed` is in [0, 1), e.g. one `Math.random()`. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  const next = prng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
