/**
 * Sprint 4b: localStorage-backed compare set. Sprint 8 introduces a
 * `comparisons` table; Sprint 9 will hydrate from this client store on
 * sign-in and sync back. Cap stays at 4 (the design limit).
 */
export const COMPARE_STORAGE_KEY = "bz:compare:ids";
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
      .slice(0, COMPARE_CAP);
  } catch {
    return [];
  }
}

export function saveCompareIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify(ids.slice(0, COMPARE_CAP)),
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
