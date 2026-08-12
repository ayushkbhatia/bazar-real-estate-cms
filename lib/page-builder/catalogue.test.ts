import { describe, expect, it } from "vitest";
import { isListField, isSelectField } from "@/lib/master-pages";
import { RENDERED_KEYS } from "@/app/(public)/lp/[slug]/_render";
import { BLOCK_DEFS, getBlockDef, pickableBlocks } from "./catalogue";
import { PRESETS } from "./presets";
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

describe("block catalogue", () => {
  it("keeps every v1 key", () => {
    for (const key of KNOWN_TYPES_V1) {
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

  it("only offers non-deprecated blocks in the picker", () => {
    for (const def of pickableBlocks()) expect(def.deprecated).not.toBe(true);
  });
});

describe("presets", () => {
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
