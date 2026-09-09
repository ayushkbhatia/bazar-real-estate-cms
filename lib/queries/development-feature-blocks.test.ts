import { describe, expect, it } from "vitest";
import {
  localiseFeatureBlocks,
  type NamedFeatureBlock,
} from "./development-extras";
import { ARABIC_STORE } from "@/lib/i18n/arabic-store";

/**
 * The amenity cards on `/ar/developments/<slug>`.
 *
 * Every one of them rendered in English — title and copy — because the blocks
 * live in `developments.meta.feature_blocks`, a free-form jsonb array written
 * by the project editor, and nothing on that path ever folded. 93 blocks
 * across 21 projects, reported from
 * `/ar/developments/the-canopies-at-yas-point-aldar`.
 *
 * The subtle half is the third case below. `localiseRow` would not have fixed
 * this on its own: it only consults the Arabic store for a key whose `_ar`
 * twin is already present, and not one stored block carries those keys. That
 * guard is right for a row of mixed columns and wrong for two named fields,
 * which is why `localiseFeatureBlocks` is hand-written.
 */

const block = (over: Partial<NamedFeatureBlock> = {}): NamedFeatureBlock => ({
  key: "feature_1",
  title: "Swimming Pool",
  copy: "Unwind beside a beautifully designed swimming pool created for relaxation, leisure and refreshing moments.",
  ...over,
});

describe("localiseFeatureBlocks", () => {
  it("leaves English alone", () => {
    const [out] = localiseFeatureBlocks([block()], "en");
    expect(out!.title).toBe("Swimming Pool");
    expect(out!.copy).toContain("Unwind beside");
  });

  it("prefers what an editor typed, over everything else", () => {
    const [out] = localiseFeatureBlocks(
      [block({ title_ar: "مسبح المشروع", copy_ar: "وصف من المحرر." })],
      "ar",
    );
    expect(out!.title).toBe("مسبح المشروع");
    expect(out!.copy).toBe("وصف من المحرر.");
  });

  it("falls through to the store when no twin was typed — the 93 stored blocks", () => {
    const [out] = localiseFeatureBlocks([block()], "ar");
    expect(out!.title).toBe(ARABIC_STORE["Swimming Pool"]!.ar);
    expect(out!.copy).toBe(
      ARABIC_STORE[
        "Unwind beside a beautifully designed swimming pool created for relaxation, leisure and refreshing moments."
      ]!.ar,
    );
    // Not a tautology: the point is that it stopped being English.
    expect(out!.title).not.toBe("Swimming Pool");
  });

  it("treats a blank twin as untyped rather than as an empty answer", () => {
    const [out] = localiseFeatureBlocks(
      [block({ title_ar: "   ", copy_ar: "" })],
      "ar",
    );
    expect(out!.title).toBe(ARABIC_STORE["Swimming Pool"]!.ar);
    expect(out!.copy).not.toBe("");
  });

  it("keeps the English when nothing has been translated at all", () => {
    const [out] = localiseFeatureBlocks(
      [block({ title: "Zzz Unlikely Amenity", copy: "Zzz unlikely sentence." })],
      "ar",
    );
    expect(out!.title).toBe("Zzz Unlikely Amenity");
    expect(out!.copy).toBe("Zzz unlikely sentence.");
  });

  it("carries the rest of the block through untouched", () => {
    const [out] = localiseFeatureBlocks(
      [block({ media_id: "abc", image_url: "/x.png" })],
      "ar",
    );
    expect(out!.key).toBe("feature_1");
    expect(out!.media_id).toBe("abc");
    expect(out!.image_url).toBe("/x.png");
  });

  it("survives an absent list", () => {
    expect(localiseFeatureBlocks(null, "ar")).toEqual([]);
    expect(localiseFeatureBlocks(undefined, "en")).toEqual([]);
  });
});

/**
 * The corpus guard.
 *
 * The fold is only as good as the store behind it, and the store is committed
 * source — so a missing entry is a review-time fact, not a runtime surprise.
 * These are the strings the five cards on the reported page are made of.
 */
describe("the reported page's amenity strings are translated", () => {
  const strings = [
    "Swimming Pool",
    "Gym",
    "Co-Working Spaces",
    "Kid's Room",
    "Multi-Purpose Room",
    "Stay active in a modern, fully equipped gym designed for strength, fitness and well-being.",
    "Work comfortably and efficiently in flexible co-working spaces designed for focus, collaboration and productivity.",
    "A fun and welcoming kids’ room designed for safe play, creativity and memorable moments.",
    "A versatile multi-purpose room designed for gatherings, activities, events and everyday community use.",
  ];

  for (const en of strings) {
    it(`has Arabic for ${JSON.stringify(en.slice(0, 40))}`, () => {
      const entry = ARABIC_STORE[en];
      expect(entry, `no store entry for ${en}`).toBeDefined();
      expect(entry!.ar.trim()).not.toBe("");
      // Arabic block, so a copied-through English string fails here.
      expect(entry!.ar).toMatch(/[؀-ۿ]/);
    });
  }
});
