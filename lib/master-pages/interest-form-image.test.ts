import { describe, expect, it } from "vitest";
import {
  getMasterPage,
  img,
  isImageField,
  resolveSections,
  type MasterPageDef,
} from "./index";

/**
 * The off-plan "Project interest form" section shipped with `fields: []`, so
 * the photo filling half the card was a hardcoded placeholder with no way to
 * change it. These pin the field's existence and its no-asset default, since
 * the whole point is that an editor can now swap that image.
 */
const offPlan = getMasterPage("off-plan") as MasterPageDef;
const section = offPlan.sections.find((s) => s.key === "interest_form")!;

describe("off-plan interest form image", () => {
  it("exposes an image field", () => {
    expect(section, "interest_form section is missing").toBeDefined();
    const field = section.fields.find(
      (f) => isImageField(f) && f.key === "image",
    );
    expect(field, "interest_form has no image field").toBeDefined();
  });

  it("defaults to no asset picked, keeping the placeholder art", () => {
    const resolved = resolveSections(offPlan, null).find(
      (s) => s.key === "interest_form",
    )!;
    const value = img(resolved.values, "image");
    expect(value).not.toBeNull();
    expect(value!.media_id).toBeNull();
    // The caption is what PlaceholderImage renders until a photo is chosen.
    expect(value!.label).toBe("off-plan development · architectural render");
  });

  it("survives a stored document written before the field existed", () => {
    // interest_form previously stored `values: {}`. That must resolve to the
    // default rather than throwing or rendering a broken image.
    const resolved = resolveSections(offPlan, [
      { key: "interest_form", enabled: true, values: {} },
    ]).find((s) => s.key === "interest_form")!;
    const value = img(resolved.values, "image");
    expect(value!.media_id).toBeNull();
  });

  it("stays reorderable and hideable like every other section", () => {
    // It has no `locked` flag, so an editor can switch the whole band off.
    expect(section.locked).toBeUndefined();
  });
});
