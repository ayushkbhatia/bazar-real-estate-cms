/**
 * Every row a query matches, a page at a time.
 *
 * Supabase caps an unpaginated select at the project's `max_rows` — 1,000 by
 * default — and says nothing when it does. For the listing sync that cap is
 * not academic: `salesforce_media` gains a row per photo, so a catalogue of a
 * hundred listings passes it, and a truncated read makes every photo past row
 * 1,000 look new — downloaded again, every fifteen minutes, forever. The same
 * cut through the mirror would hide listings from withdrawal detection.
 *
 * `page` must order by a unique key, or rows can repeat or vanish between
 * pages while something else writes.
 */
export async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) return out;
  }
}
