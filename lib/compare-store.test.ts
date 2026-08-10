import { describe, it, expect, beforeEach } from "vitest";
import {
  COMPARE_CAP,
  COMPARE_STORAGE_KEY,
  SHORTLIST_CAP,
  loadCompareIds,
  saveCompareIds,
} from "./compare-store";

/**
 * The store is bounded by the shortlist cap, not the compare cap. These were
 * one constant at 4, so saving a fifth listing silently evicted the first —
 * barely noticeable when the save button lived only on search results, and
 * very noticeable once it went on every card. The two caps must stay
 * distinct, and the store must honour the larger one.
 */
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("compare store caps", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps the shortlist cap well above the compare cap", () => {
    expect(SHORTLIST_CAP).toBe(25);
    expect(COMPARE_CAP).toBe(4);
    expect(SHORTLIST_CAP).toBeGreaterThan(COMPARE_CAP);
  });

  it("stores more than the compare cap", () => {
    const ids = Array.from({ length: 10 }, (_, i) => uuid(i));
    saveCompareIds(ids);
    expect(loadCompareIds()).toEqual(ids);
  });

  it("truncates writes at the shortlist cap, keeping the earliest", () => {
    const ids = Array.from({ length: SHORTLIST_CAP + 5 }, (_, i) => uuid(i));
    saveCompareIds(ids);
    const loaded = loadCompareIds();
    expect(loaded).toHaveLength(SHORTLIST_CAP);
    expect(loaded[0]).toBe(uuid(0));
    expect(loaded.at(-1)).toBe(uuid(SHORTLIST_CAP - 1));
  });

  it("truncates oversized reads too, so a hand-edited store can't blow past the cap", () => {
    const ids = Array.from({ length: SHORTLIST_CAP + 5 }, (_, i) => uuid(i));
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(ids));
    expect(loadCompareIds()).toHaveLength(SHORTLIST_CAP);
  });

  it("survives a corrupt payload", () => {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, "{not json");
    expect(loadCompareIds()).toEqual([]);
    window.localStorage.setItem(COMPARE_STORAGE_KEY, '{"a":1}');
    expect(loadCompareIds()).toEqual([]);
  });

  it("drops non-string entries rather than passing them to the query", () => {
    window.localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify([uuid(1), 42, null, uuid(2)]),
    );
    expect(loadCompareIds()).toEqual([uuid(1), uuid(2)]);
  });
});
