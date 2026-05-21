import { describe, it, expect } from "vitest";
import {
  conciergeBriefSchema,
  mergeBrief,
  removeChip,
  type ConciergeBrief,
} from "./brief";

describe("conciergeBriefSchema", () => {
  it("accepts an empty brief (just chips)", () => {
    const r = conciergeBriefSchema.safeParse({ chips: [] });
    expect(r.success).toBe(true);
  });

  it("parses a full brief", () => {
    const r = conciergeBriefSchema.safeParse({
      mode: "buy",
      area_slugs: ["saadiyat-island", "yas-island"],
      property_types: ["villa"],
      beds_min: 3,
      beds_max: 5,
      price_min: 5_000_000,
      price_max: 12_000_000,
      must_have_amenities: ["beach access", "private pool"],
      flags: { exclusive: true },
      free_text_hints: ["walking to school"],
      chips: [
        { id: "a", label: "Saadiyat Island", field: "area_slugs" },
        { id: "b", label: "Under AED 12M" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown mode", () => {
    const r = conciergeBriefSchema.safeParse({ mode: "bogus", chips: [] });
    expect(r.success).toBe(false);
  });
});

describe("mergeBrief", () => {
  it("preserves existing chips and adds new ones (dedupe by id)", () => {
    const before: ConciergeBrief = {
      chips: [{ id: "saadiyat", label: "Saadiyat Island" }],
    };
    const after = mergeBrief(before, {
      chips: [
        { id: "saadiyat", label: "Saadiyat Island" }, // duplicate, ignored
        { id: "12m", label: "Under AED 12M" },
      ],
    });
    expect(after.chips).toHaveLength(2);
    expect(after.chips.map((c) => c.id)).toEqual(["saadiyat", "12m"]);
  });

  it("unions string arrays", () => {
    const before: ConciergeBrief = {
      area_slugs: ["saadiyat-island"],
      must_have_amenities: ["beach access"],
      chips: [],
    };
    const after = mergeBrief(before, {
      area_slugs: ["yas-island", "saadiyat-island"],
      must_have_amenities: ["private pool"],
    });
    expect(after.area_slugs?.sort()).toEqual(["saadiyat-island", "yas-island"]);
    expect(after.must_have_amenities?.sort()).toEqual([
      "beach access",
      "private pool",
    ]);
  });

  it("replaces scalar fields (numbers, enums)", () => {
    const before: ConciergeBrief = {
      mode: "rent",
      beds_min: 2,
      price_max: 5_000_000,
      chips: [],
    };
    const after = mergeBrief(before, {
      mode: "buy",
      beds_min: 3,
      price_max: 10_000_000,
    });
    expect(after.mode).toBe("buy");
    expect(after.beds_min).toBe(3);
    expect(after.price_max).toBe(10_000_000);
  });

  it("returns a brand-new brief when current is null/undefined", () => {
    const after = mergeBrief(null, { mode: "buy" });
    expect(after.mode).toBe("buy");
    expect(after.chips).toEqual([]);
  });

  it("caps chips at 40", () => {
    const initial: ConciergeBrief = {
      chips: Array.from({ length: 38 }, (_, i) => ({
        id: `c${i}`,
        label: `Chip ${i}`,
      })),
    };
    const after = mergeBrief(initial, {
      chips: [
        { id: "x1", label: "X1" },
        { id: "x2", label: "X2" },
        { id: "x3", label: "X3" }, // would push to 41
      ],
    });
    expect(after.chips).toHaveLength(40);
  });
});

describe("removeChip", () => {
  it("removes the chip by id", () => {
    const before: ConciergeBrief = {
      chips: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    };
    expect(removeChip(before, "a").chips.map((c) => c.id)).toEqual(["b"]);
  });

  it("returns the brief unchanged for an unknown chip id", () => {
    const before: ConciergeBrief = { chips: [{ id: "a", label: "A" }] };
    expect(removeChip(before, "missing")).toBe(before);
  });

  it("projects an area-slugs chip removal back into the area list", () => {
    const before: ConciergeBrief = {
      area_slugs: ["saadiyat-island", "yas-island"],
      chips: [
        { id: "s", label: "Saadiyat Island", field: "area_slugs" },
        { id: "y", label: "Yas Island", field: "area_slugs" },
      ],
    };
    const after = removeChip(before, "s");
    expect(after.area_slugs).toEqual(["yas-island"]);
  });

  it("clears beds range when a beds chip is removed", () => {
    const before: ConciergeBrief = {
      beds_min: 3,
      beds_max: 5,
      chips: [{ id: "beds", label: "3-5 bed", field: "beds_min" }],
    };
    const after = removeChip(before, "beds");
    expect(after.beds_min).toBeUndefined();
    expect(after.beds_max).toBeUndefined();
  });
});
