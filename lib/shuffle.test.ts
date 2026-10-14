import { describe, expect, it } from "vitest";
import { seededShuffle } from "./shuffle";

const items = Array.from({ length: 20 }, (_, i) => i);

describe("seededShuffle", () => {
  it("keeps every item exactly once and leaves the input alone", () => {
    const out = seededShuffle(items, 0.42);
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("gives the same order for the same seed", () => {
    expect(seededShuffle(items, 0.1234)).toEqual(seededShuffle(items, 0.1234));
  });

  it("gives different leading items across seeds", () => {
    const heads = new Set(
      [0.01, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95].map((s) =>
        seededShuffle(items, s).slice(0, 4).join(","),
      ),
    );
    expect(heads.size).toBeGreaterThan(1);
  });

  it("handles empty and single-item lists", () => {
    expect(seededShuffle([], 0.5)).toEqual([]);
    expect(seededShuffle(["a"], 0.5)).toEqual(["a"]);
  });
});
