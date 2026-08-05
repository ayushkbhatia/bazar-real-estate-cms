import { describe, expect, it } from "vitest";
import {
  getMasterPage,
  isImageField,
  isListField,
  resolveSections,
  type ListFieldDef,
  type MasterPageDef,
} from "./index";

/**
 * The property-type grid on /buy and /rent renders a card per type. Off-plan
 * has offered a per-card image since it shipped; buy and rent were stuck on
 * placeholder art because their shared section called propTypeList() without
 * the image option. These pin the wiring end to end: the field exists in the
 * registry, defaults keep the placeholder until an asset is picked, and a
 * stored document that predates the field still resolves.
 */
function propTypeItemsField(key: string): ListFieldDef {
  const def = getMasterPage(key) as MasterPageDef;
  const section = def.sections.find((s) => s.key === "prop_types");
  expect(section, `${key} has no prop_types section`).toBeDefined();
  const field = section!.fields.find(isListField);
  expect(field, `${key} prop_types has no list field`).toBeDefined();
  return field!;
}

describe.each(["buy", "rent", "off-plan"])(
  "%s property-type cards accept an image",
  (key) => {
    it("declares an image sub-field", () => {
      const field = propTypeItemsField(key);
      const image = field.fields.find(
        (f) => isImageField(f) && f.key === "image",
      );
      expect(image, `${key} is missing the image sub-field`).toBeDefined();
    });

    it("keeps a placeholder caption alongside it", () => {
      // The grid falls back to `img` when no asset is picked, so losing this
      // would replace the striped art with a bare name.
      const field = propTypeItemsField(key);
      expect(field.fields.some((f) => f.key === "img")).toBe(true);
    });
  },
);

describe("buy prop-type defaults", () => {
  const def = getMasterPage("buy") as MasterPageDef;
  const resolved = resolveSections(def, null).find(
    (s) => s.key === "prop_types",
  )!;
  const items = resolved.values.items as Record<string, unknown>[];

  it("ships the five sale property types", () => {
    expect(items.map((i) => i.name)).toEqual([
      "Apartments",
      "Villas",
      "Townhouses",
      "Penthouses",
      "Commercial Properties",
    ]);
  });

  it("starts every card with no asset picked", () => {
    // An un-edited page must render exactly what it rendered before this
    // change — placeholder art, not a broken image.
    for (const item of items) {
      const image = item.image as { media_id: string | null };
      expect(image).toBeDefined();
      expect(image.media_id).toBeNull();
    }
  });

  it("gives every card a placeholder caption", () => {
    for (const item of items) {
      expect(typeof item.img).toBe("string");
      expect((item.img as string).length).toBeGreaterThan(0);
    }
  });
});

describe("documents saved before the image field existed", () => {
  it("still resolve, keeping their stored copy", () => {
    // The buy page has been edited in production, so its stored items have
    // name/desc/cta/href and no `image` key. That must not throw or wipe copy.
    const def = getMasterPage("buy") as MasterPageDef;
    const stored = [
      {
        key: "prop_types",
        enabled: true,
        values: {
          prop_types_title: "A home for every stage.",
          items: [
            {
              name: "Apartments",
              desc: "Older stored copy.",
              cta: "Browse apartments",
              href: "/buy/search?type=apartment",
            },
          ],
        },
      },
    ];
    const resolved = resolveSections(def, stored).find(
      (s) => s.key === "prop_types",
    )!;
    const items = resolved.values.items as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Apartments");
    expect(items[0].desc).toBe("Older stored copy.");
    // No image key yet — the renderer treats that as "no asset picked".
    expect(items[0].image).toBeUndefined();
  });
});
