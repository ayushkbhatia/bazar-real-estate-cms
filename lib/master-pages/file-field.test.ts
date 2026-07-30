import { describe, it, expect } from "vitest";
import {
  isFileField,
  isImageField,
  isMediaField,
  isListField,
  resolveSections,
  validateSections,
  img,
  type FieldDef,
  type MasterPageDef,
} from ".";
import { DEVELOPMENT_SECTIONS, developmentPageDef } from "./subpages";

const def = developmentPageDef({ name: "Bayviews Saadiyat", slug: "bayviews-saadiyat" });
const hero = DEVELOPMENT_SECTIONS.find((s) => s.key === "hero")!;
const brochure = hero.fields.find((f) => f.key === "brochure") as FieldDef;

describe("the file field kind", () => {
  it("is recognised as a file, not an image", () => {
    expect(isFileField(brochure)).toBe(true);
    expect(isImageField(brochure)).toBe(false);
  });

  it("counts as a media field, which is what URL resolution keys on", () => {
    // attachImageUrls walks anything holding a media_id. A file field storing
    // the same shape is the whole reason a PDF URL resolves for free.
    expect(isMediaField(brochure)).toBe(true);
  });

  it("is not mistaken for a list or a text field", () => {
    expect(isListField(brochure)).toBe(false);
    expect(brochure.kind).toBe("file");
  });
});

describe("the development hero carries a brochure", () => {
  it("offers the PDF and a button label", () => {
    const keys = hero.fields.map((f) => f.key);
    expect(keys).toContain("brochure");
    expect(keys).toContain("brochure_label");
  });

  it("defaults to no PDF, so nothing is promised until one is set", () => {
    const resolved = resolveSections(def as MasterPageDef, null);
    const heroValues = resolved.find((s) => s.key === "hero")!.values;
    expect(img(heroValues, "brochure")?.media_id).toBeNull();
  });

  it("stays locked — the brochure button lives in the hero", () => {
    expect(hero.locked).toBe(true);
  });
});

describe("saving a brochure selection", () => {
  it("keeps the media reference", () => {
    const result = validateSections(def as MasterPageDef, [
      {
        key: "hero",
        enabled: true,
        values: {
          brochure: {
            media_id: "aaaaaaaa-0000-0000-0000-000000000001",
            alt: null,
            label: null,
          },
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = result.sections.find((s) => s.key === "hero")!;
    expect(img(stored.values, "brochure")?.media_id).toBe(
      "aaaaaaaa-0000-0000-0000-000000000001",
    );
  });

  it("normalises junk to an empty reference rather than storing it", () => {
    const result = validateSections(def as MasterPageDef, [
      { key: "hero", enabled: true, values: { brochure: "not-an-object" } },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = result.sections.find((s) => s.key === "hero")!;
    expect(img(stored.values, "brochure")?.media_id).toBeNull();
  });

  it("never stores a resolved url — media_id is the source of truth", () => {
    const result = validateSections(def as MasterPageDef, [
      {
        key: "hero",
        enabled: true,
        values: {
          brochure: {
            media_id: "aaaaaaaa-0000-0000-0000-000000000001",
            alt: null,
            label: null,
            url: "https://example.com/stale.pdf",
          },
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = result.sections.find((s) => s.key === "hero")!;
    // A stored URL would go stale the moment the asset moved.
    expect(img(stored.values, "brochure")).not.toHaveProperty("url");
  });
});
