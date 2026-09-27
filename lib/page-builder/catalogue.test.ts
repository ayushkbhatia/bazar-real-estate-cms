import { describe, expect, it } from "vitest";
import { isListField, isSelectField } from "@/lib/master-pages";
import { RENDERED_KEYS } from "@/app/[locale]/(public)/lp/[slug]/_render";
import { BLOCK_DEFS, getBlockDef, pickableBlocks } from "./catalogue";
import { PRESETS, presetBlocks, presetNeedsProject } from "./presets";
import { BLOCK_GROUPS } from "./types";

/**
 * The keys that shipped in v1.
 *
 * Frozen deliberately. `BlockInstance.type` is data — it is written into every
 * published page's jsonb — so renaming one orphans that page's copy, which
 * exists nowhere else. The escape hatch is to add a new key and mark the old
 * one `deprecated`, which keeps it resolving. This list is what makes a rename
 * fail the build instead of failing quietly in production.
 */
const KNOWN_TYPES_V1 = [
  "hero_media",
  "hero_form",
  "featured_properties",
  "featured_developments",
  "feature_scroll",
  "tiles",
  "prop_types",
  "steps",
  "faq",
  "rich_text",
  "image_band",
  "form_band",
  "cta_band",
  "chips",
  "about_bazar",
  "why_band",
] as const;

/**
 * Keys added after v1, protected the same way and for the same reason. A new
 * list rather than an edit to the one above: `KNOWN_TYPES_V1` records what
 * shipped in v1, and rewriting history to make a later addition look original
 * would cost the next reader the one fact these lists exist to carry.
 */
const KNOWN_TYPES_V2 = ["testimonials"] as const;

/** The project sections and the second catalogue round, added together. */
const KNOWN_TYPES_V3 = [
  "project_facts",
  "project_payment_plan",
  "project_master_plan",
  "project_unit_plans",
  "project_location",
  "gallery",
  "value_grid",
  "stats_band",
  "mortgage_calculator",
  "advisor",
  "partners",
] as const;

describe("block catalogue", () => {
  it("keeps every published key", () => {
    for (const key of [...KNOWN_TYPES_V1, ...KNOWN_TYPES_V2, ...KNOWN_TYPES_V3]) {
      expect(getBlockDef(key), `block "${key}" was renamed or removed`).not.toBeNull();
    }
  });

  it("has unique, storage-safe keys", () => {
    const keys = BLOCK_DEFS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it("renders every catalogue entry", () => {
    const rendered = new Set<string>(RENDERED_KEYS);
    for (const def of BLOCK_DEFS) {
      expect(rendered.has(def.key), `no renderer case for "${def.key}"`).toBe(true);
    }
  });

  it("has a catalogue entry for every renderer case", () => {
    for (const key of RENDERED_KEYS) {
      expect(getBlockDef(key), `renderer draws "${key}" but no block defines it`)
        .not.toBeNull();
    }
  });

  it("gives every field a default and every default a field", () => {
    for (const def of BLOCK_DEFS) {
      const fieldKeys = new Set(def.fields.map((f) => f.key));
      const defaultKeys = new Set(Object.keys(def.defaults));
      for (const key of fieldKeys) {
        expect(defaultKeys.has(key), `${def.key}.${key} has no default`).toBe(true);
      }
      for (const key of defaultKeys) {
        expect(fieldKeys.has(key), `${def.key}.${key} defaults but has no field`)
          .toBe(true);
      }
    }
  });

  it("never defaults a required text field to null", () => {
    for (const def of BLOCK_DEFS) {
      for (const field of def.fields) {
        if (field.kind !== "text" || field.optional) continue;
        const value = def.defaults[field.key];
        expect(
          typeof value === "string" && value.trim() !== "",
          `${def.key}.${field.key} is required but ships empty — adding the block would immediately fail the publish gate`,
        ).toBe(true);
      }
    }
  });

  it("gives every select exactly one source of options", () => {
    const check = (blockKey: string, field: unknown) => {
      if (!isSelectField(field as never)) return;
      const f = field as { key: string; optionsKey?: string; options?: unknown[] };
      const sources = [f.optionsKey, f.options].filter(Boolean).length;
      expect(sources, `${blockKey}.${f.key} needs exactly one of optionsKey/options`)
        .toBe(1);
    };
    for (const def of BLOCK_DEFS) {
      for (const field of def.fields) {
        check(def.key, field);
        if (isListField(field)) {
          for (const sub of field.fields) check(def.key, sub);
        }
      }
    }
  });

  it("files every block under a real group", () => {
    const groups = new Set(BLOCK_GROUPS.map((g) => g.key));
    for (const def of BLOCK_DEFS) expect(groups.has(def.group)).toBe(true);
  });

  it("only charges query budget to blocks that declare needs", () => {
    for (const def of BLOCK_DEFS) {
      if ((def.queryCost ?? 0) > 0) {
        expect(def.needs?.length ?? 0, `${def.key} costs a query but needs nothing`)
          .toBeGreaterThan(0);
      }
    }
  });

  it("only shares a query from blocks that declare what they need", () => {
    for (const def of BLOCK_DEFS) {
      if (!def.sharedQuery) continue;
      expect(def.needs?.length ?? 0, `${def.key} shares a query but needs nothing`)
        .toBeGreaterThan(0);
      // One model per block: charged per block, or once per page — not both,
      // or the shared fetch is billed twice.
      expect(def.queryCost ?? 0, `${def.key} declares both queryCost and sharedQuery`)
        .toBe(0);
    }
  });

  /**
   * `pickRequired` names the field the editor, the gate and the renderer all
   * read. If it points at anything but a record select, the "no project is
   * picked" warning can never clear.
   */
  it("points every pickRequired at a record select on the same block", () => {
    for (const def of BLOCK_DEFS) {
      if (!def.pickRequired) continue;
      const field = def.fields.find((f) => f.key === def.pickRequired!.key);
      expect(field, `${def.key}.pickRequired names a missing field`).toBeDefined();
      expect(isSelectField(field!), `${def.key}.${field!.key} is not a select`).toBe(true);
      expect(
        (field as { optionsKey?: string }).optionsKey,
        `${def.key}.${field!.key} picks from no records`,
      ).toBeTruthy();
      // The pick starts blank: which record is the editor's call, never a
      // default's.
      expect(def.defaults[def.pickRequired.key]).toBeNull();
    }
  });

  it("gives every project section the one project field inheritPick reads", () => {
    for (const def of BLOCK_DEFS.filter((d) => d.group === "project")) {
      expect(def.pickRequired?.key, def.key).toBe("development");
      expect(def.needs, def.key).toContain("project");
      expect(def.sharedQuery, def.key).toBe("projects");
    }
  });

  it("only offers non-deprecated blocks in the picker", () => {
    for (const def of pickableBlocks()) expect(def.deprecated).not.toBe(true);
  });
});

describe("presets", () => {
  it("writes a chosen project into every project section, and nowhere else", () => {
    const blocks = presetBlocks("project_launch", { development: "yas-riva" });
    const project = blocks.filter((b) => getBlockDef(b.type)?.group === "project");
    expect(project.length).toBeGreaterThan(0);
    for (const b of project) expect(b.values.development).toBe("yas-riva");
    for (const b of blocks.filter((b) => getBlockDef(b.type)?.group !== "project")) {
      expect(b.values.development, b.type).toBeUndefined();
    }
  });

  it("leaves project sections blank when no project was chosen", () => {
    for (const b of presetBlocks("project_launch")) {
      if (getBlockDef(b.type)?.group !== "project") continue;
      expect(b.values.development).toBeNull();
    }
  });

  it("knows which presets ask for a project", () => {
    expect(presetNeedsProject("project_launch")).toBe(true);
    expect(presetNeedsProject("lead_gen")).toBe(false);
    expect(presetNeedsProject("blank")).toBe(false);
  });

  it("only names blocks that exist", () => {
    for (const preset of PRESETS) {
      for (const key of preset.blocks) {
        expect(getBlockDef(key), `preset "${preset.key}" names unknown block "${key}"`)
          .not.toBeNull();
      }
    }
  });

  it("never repeats a singleton within one preset", () => {
    for (const preset of PRESETS) {
      const singletons = preset.blocks.filter(
        (key) => getBlockDef(key)?.singleton,
      );
      expect(new Set(singletons).size).toBe(singletons.length);
    }
  });

  it("opens each non-blank preset with an opener that carries the H1", () => {
    for (const preset of PRESETS) {
      if (preset.blocks.length === 0) continue;
      const first = getBlockDef(preset.blocks[0]);
      expect(first?.opener, `preset "${preset.key}" doesn't start with an opener`)
        .toBe(true);
      const h1s = preset.blocks.filter((k) => getBlockDef(k)?.providesH1).length;
      expect(h1s, `preset "${preset.key}" has ${h1s} H1 sections, needs exactly 1`)
        .toBe(1);
    }
  });
});
