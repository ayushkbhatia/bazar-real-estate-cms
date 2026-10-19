import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanLifestyleTags,
  LIFESTYLE_TAG_LABEL,
  LIFESTYLE_TAGS,
  lifestyleTagLabel,
} from "./lifestyle-tags";

describe("lifestyle tags", () => {
  it("matches the column's CHECK in the latest migration that defines it", () => {
    // The vocabulary lives in two places — here and the CHECK on
    // properties.lifestyle_tags — and a tag in one but not the other either
    // can't be saved or can't be shown. Whichever migration last names the
    // constraint is the one in force.
    const dir = join(process.cwd(), "supabase/migrations");
    const sql = readdirSync(dir)
      .sort()
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .filter((s) => s.includes("properties_lifestyle_tags_known"))
      .pop();
    expect(sql).toBeTruthy();
    const block = sql!.slice(sql!.indexOf("array["), sql!.indexOf("]::text[]"));
    const inCheck = [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(inCheck).toEqual([...LIFESTYLE_TAGS]);
  });

  it("has English and Arabic for every tag", () => {
    for (const tag of LIFESTYLE_TAGS) {
      expect(LIFESTYLE_TAG_LABEL[tag].en.trim()).not.toBe("");
      expect(LIFESTYLE_TAG_LABEL[tag].ar.trim()).not.toBe("");
    }
    expect(lifestyleTagLabel("gated", "en")).toBe("Gated");
    expect(lifestyleTagLabel("gated", "ar")).toBe(LIFESTYLE_TAG_LABEL.gated.ar);
  });

  it("cleans to known tags, deduplicated, in vocabulary order", () => {
    expect(
      cleanLifestyleTags(["gated", "nope", "waterfront", "gated", 3, null]),
    ).toEqual(["waterfront", "gated"]);
    expect(cleanLifestyleTags("luxury,branded_residences")).toEqual([
      "luxury",
      "branded_residences",
    ]);
    expect(cleanLifestyleTags(undefined)).toEqual([]);
    expect(cleanLifestyleTags({ gated: true })).toEqual([]);
  });
});
