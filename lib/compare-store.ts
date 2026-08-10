/**
 * Sprint 4b: localStorage-backed shortlist. Sprint 8 introduces a
 * `comparisons` table; Sprint 9 will hydrate from this client store on
 * sign-in and sync back.
 *
 * Two caps, deliberately different:
 *
 * - `SHORTLIST_CAP` bounds what the visitor can save. It exists to keep
 *   localStorage and the hydration query sane, not to shape the UI, so it
 *   sits well above what anyone reaches in a session.
 * - `COMPARE_CAP` bounds how many of those can go into the compare table at
 *   once, and *is* a design limit — four columns is what the layout holds.
 *
 * They used to be one constant at 4, which meant saving a fifth listing
 * silently evicted the first. The drawer now lets the visitor pick which of
 * their saved listings to compare, so the table's ceiling no longer dictates
 * how much they're allowed to keep.
 */
export const COMPARE_STORAGE_KEY = "bz:compare:ids";
export const SHORTLIST_CAP = 25;
export const COMPARE_CAP = 4;

export function loadCompareIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string")
      .slice(0, SHORTLIST_CAP);
  } catch {
    return [];
  }
}

export function saveCompareIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify(ids.slice(0, SHORTLIST_CAP)),
    );
    // Storage event only fires in *other* tabs; manually nudge same-tab
    // listeners so the count badge in the rail updates.
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: COMPARE_STORAGE_KEY,
        newValue: JSON.stringify(ids),
      }),
    );
  } catch {
    // ignore
  }
}
