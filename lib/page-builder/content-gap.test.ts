import { describe, expect, it } from "vitest";
import { BLOCK_DEFS, getBlockDef, newBlockInstance } from "./catalogue";
import { resolveDocument } from "./document";
import { blockContentGap, contentGaps } from "./content-gap";
import { presetBlocks } from "./presets";
import type { SectionValues } from "@/lib/master-pages";

/**
 * The regression: a page assembled from the `lead_gen` preset published with
 * four sections, and two of them — "How it works" and the FAQ — were not on the
 * page at all. Both shipped with an empty list, both render nothing when their
 * list is empty, and nothing between the picker and the live URL said so.
 *
 * Two guards, then: the presets are visible as assembled, and an emptied list
 * is reported rather than swallowed.
 */

function instance(key: string, values: SectionValues = {}) {
  const def = getBlockDef(key)!;
  const base = newBlockInstance(def);
  return { ...base, values: { ...base.values, ...values } };
}

describe("blockContentGap", () => {
  it("reports a list an editor emptied", () => {
    const def = getBlockDef("steps")!;
    expect(blockContentGap(def, { ...def.defaults, items: [] })).toMatch(
      /no steps yet/,
    );
  });

  it("says nothing about a filled list", () => {
    const def = getBlockDef("steps")!;
    expect(blockContentGap(def, def.defaults)).toBeNull();
  });

  it("counts a row whose text was blanked as no row", () => {
    const def = getBlockDef("faq")!;
    expect(
      blockContentGap(def, { items: [{ q: "  ", a: "An answer." }] }),
    ).toMatch(/no questions yet/);
  });

  it("only applies to the hand-picked source on a listings rail", () => {
    const def = getBlockDef("featured_properties")!;
    expect(blockContentGap(def, { source: "picked", picks: [] })).toMatch(
      /wouldn't appear/,
    );
    // The other sources fill themselves from live inventory.
    expect(blockContentGap(def, { source: "exclusive", picks: [] })).toBeNull();
  });

  it("says nothing about a block with no list requirement", () => {
    const def = getBlockDef("cta_band")!;
    expect(blockContentGap(def, def.defaults)).toBeNull();
  });
});

describe("contentGaps", () => {
  it("skips a section that is switched off", () => {
    const blocks = resolveDocument([
      { ...instance("steps", { items: [] }), enabled: false },
    ]);
    expect(contentGaps(blocks)).toHaveLength(0);
  });

  it("skips a block this build doesn't know", () => {
    const blocks = resolveDocument([
      { id: "u", type: "market_stats_strip", v: 1, enabled: true, values: {} },
    ]);
    expect(contentGaps(blocks)).toHaveLength(0);
  });

  it("names the section, so the editor can point at a row", () => {
    const blocks = resolveDocument([instance("faq", { items: [] })]);
    expect(contentGaps(blocks)).toEqual([
      { id: expect.any(String), label: "FAQ", message: expect.any(String) },
    ]);
  });
});

describe("what the picker hands an editor", () => {
  /**
   * Every block except the two that draw their rows from live records is
   * visible from its own defaults. A section that renders nothing until it is
   * opened and filled is the failure this file exists for.
   */
  it("gives every added block something to show", () => {
    const silent = BLOCK_DEFS.filter(
      (def) => blockContentGap(def, def.defaults) !== null,
    ).map((def) => def.key);
    expect(silent.sort()).toEqual(["feature_scroll", "featured_properties"]);
  });

  it("leaves no preset with an invisible section", () => {
    for (const key of ["off_plan_launch", "area_campaign", "lead_gen"]) {
      const gaps = contentGaps(resolveDocument(presetBlocks(key)));
      // The feature-rows and hand-picked rails are campaign-specific by
      // nature — they are allowed to start empty, but the editor is told and
      // the publish gate refuses, which is the whole point.
      expect(
        gaps.map((g) => g.label),
        key,
      ).toEqual(
        expect.arrayContaining(
          key === "off_plan_launch"
            ? ["Feature rows"]
            : key === "area_campaign"
              ? ["Featured properties"]
              : [],
        ),
      );
      if (key === "lead_gen") expect(gaps).toHaveLength(0);
    }
  });
});
