import { describe, expect, it } from "vitest";
import { BLOCK_DEFS, getBlockDef, newBlockInstance } from "./catalogue";
import { resolveDocument } from "./document";
import {
  blockCatalogueGap,
  blockContentGap,
  contentGaps,
} from "./content-gap";
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

  it("reports a project section with no project picked", () => {
    const def = getBlockDef("project_payment_plan")!;
    expect(blockContentGap(def, { ...def.defaults, development: null })).toMatch(
      /No project is picked/,
    );
    expect(blockContentGap(def, { ...def.defaults, development: "  " })).toMatch(
      /No project is picked/,
    );
    expect(
      blockContentGap(def, { ...def.defaults, development: "yas-riva" }),
    ).toBeNull();
  });

  /**
   * A photo row is a row with a photo in it. The gallery drops a row still on
   * its placeholder, so counting it would be the old failure again: a section
   * the editor sees, the gate passes, and the page doesn't show.
   */
  it("counts a photo row only once a picture is chosen", () => {
    const def = getBlockDef("gallery")!;
    const row = (media_id: string | null) => ({
      image: { media_id, alt: "Pool", label: null },
      caption: "",
    });
    expect(blockContentGap(def, { first_images: [row(null)] })).toMatch(
      /no photos yet/,
    );
    expect(blockContentGap(def, { first_images: [row("m-1")] })).toBeNull();
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
    expect(silent.sort()).toEqual(
      [
        // Rows only this campaign can supply.
        "feature_scroll",
        "featured_properties",
        "gallery",
        "stats_band",
        // Views of one record: nothing to draw until the record is picked.
        "advisor",
        "project_facts",
        "project_location",
        "project_master_plan",
        "project_payment_plan",
        "project_unit_plans",
      ].sort(),
    );
  });

  /**
   * The Project launch preset is the exception that proves the rule: created
   * with a project it is visible end to end; created without one, every
   * project section says so — the page is never silently half-built.
   */
  it("assembles a visible Project launch page once a project is chosen", () => {
    const withProject = contentGaps(
      resolveDocument(presetBlocks("project_launch", { development: "yas-riva" })),
    );
    expect(withProject).toEqual([]);

    const without = contentGaps(resolveDocument(presetBlocks("project_launch")));
    expect(without.length).toBeGreaterThan(0);
    for (const gap of without) expect(gap.message).toMatch(/No project is picked/);
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

describe("blockCatalogueGap — advisory, never a blocker", () => {
  const features = {
    "yas-riva": ["payment_plan", "master_plan", "unit_types", "location"],
    "al-naseem": ["master_plan", "unit_types", "location"],
  } as const;

  it("says when a picked project lacks what the section shows", () => {
    const def = getBlockDef("project_payment_plan")!;
    expect(
      blockCatalogueGap(def, { development: "al-naseem" }, features),
    ).toMatch(/no payment plan yet/);
    expect(
      blockCatalogueGap(def, { development: "yas-riva" }, features),
    ).toBeNull();
  });

  it("stays quiet with no pick, an unknown project, or a section that needs nothing", () => {
    const plan = getBlockDef("project_payment_plan")!;
    expect(blockCatalogueGap(plan, { development: null }, features)).toBeNull();
    expect(blockCatalogueGap(plan, { development: "gone" }, features)).toBeNull();
    // Key facts draws from fields every published project must carry.
    const facts = getBlockDef("project_facts")!;
    expect(
      blockCatalogueGap(facts, { development: "al-naseem" }, features),
    ).toBeNull();
  });

  it("is not something the publish gate reads", () => {
    // contentGaps is what the gate reads; a catalogue gap must not reach it.
    const blocks = resolveDocument([
      instance("project_payment_plan", { development: "al-naseem" }),
    ]);
    expect(contentGaps(blocks)).toEqual([]);
  });
});

