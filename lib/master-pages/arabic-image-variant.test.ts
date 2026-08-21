import { describe, expect, it } from "vitest";
import { applyLocale } from "./i18n";
import {
  getMasterPage,
  img,
  isImageField,
  resolveSections,
  validateSections,
  type ImageValue,
  type MasterPageDef,
  type StoredSection,
} from "./index";

/**
 * The "List your property" artwork is typeset copy, not photography — the
 * words live inside the picture. Every string around it translated and the
 * card still read English on /ar, because an image has no `_ar` twin: the
 * derivation in `twins.ts` deliberately covers text and textarea only.
 *
 * The fix is a second asset stored beside the first, inside the same
 * `ImageValue`, swapped by the same fold that swaps every string. These pin
 * the three places that has to hold: the field offers it, a save keeps it, and
 * the fold applies it before the URL is resolved.
 */
const home = getMasterPage("home") as MasterPageDef;
const areas = getMasterPage("areas") as MasterPageDef;

const EN = "11111111-1111-4111-8111-111111111111";
const AR = "22222222-2222-4222-8222-222222222222";

function listImageField(def: MasterPageDef) {
  const section = def.sections.find((s) => s.key === "list_your_property")!;
  return section.fields.find((f) => isImageField(f) && f.key === "image");
}

describe("list-your-property image, in Arabic", () => {
  it("offers an Arabic variant on both pages that render the band", () => {
    for (const def of [home, areas]) {
      const field = listImageField(def);
      expect(field, `${def.key} has no list_your_property image`).toBeDefined();
      expect(
        isImageField(field!) && field!.arabicVariant,
        `${def.key} image is not marked arabicVariant`,
      ).toBe(true);
    }
  });

  it("leaves every other image alone — the flag is opt-in", () => {
    // Photography carries no language. If this ever fails, someone has turned
    // the second picker on site-wide, which is the thing the flag exists to
    // avoid.
    const flagged = home.sections.flatMap((s) =>
      s.fields
        .filter((f) => isImageField(f) && f.arabicVariant)
        .map((f) => `${s.key}.${f.key}`),
    );
    expect(flagged).toEqual(["list_your_property.image"]);
  });
});

describe("storage", () => {
  it("keeps media_id_ar through a save", () => {
    // `validateFieldValues` rebuilds a media value key by key with no spread,
    // so anything it does not name is destroyed on save.
    const result = validateSections(home, [
      {
        key: "list_your_property",
        enabled: true,
        values: {
          image: {
            media_id: EN,
            media_id_ar: AR,
            alt: "keys",
            alt_ar: "مفاتيح",
            label: null,
          },
        },
      },
    ]);
    expect(result.ok).toBe(true);
    const saved = (result as { sections: StoredSection[] }).sections.find(
      (s) => s.key === "list_your_property",
    )!.values.image as ImageValue;
    expect(saved.media_id).toBe(EN);
    expect(saved.media_id_ar).toBe(AR);
    expect(saved.alt_ar).toBe("مفاتيح");
  });

  it("writes no media_id_ar key at all when there is no Arabic asset", () => {
    // Every image in every section document carries one of these. A null on
    // all of them is pure jsonb weight, and it keeps the stored shape
    // byte-identical for English-only pages.
    const result = validateSections(home, [
      {
        key: "list_your_property",
        enabled: true,
        values: { image: { media_id: EN, alt: null, label: null } },
      },
    ]);
    expect(result.ok).toBe(true);
    const saved = (result as { sections: StoredSection[] }).sections.find(
      (s) => s.key === "list_your_property",
    )!.values.image as ImageValue;
    expect("media_id_ar" in saved).toBe(false);
  });
});

describe("the fold", () => {
  const stored = [
    {
      key: "list_your_property",
      enabled: true,
      values: {
        image: {
          media_id: EN,
          media_id_ar: AR,
          alt: "keys",
          alt_ar: "مفاتيح",
          label: "agent handing over keys",
        },
      },
    },
  ];

  it("swaps the asset under Arabic", () => {
    const section = resolveSections(home, stored, "ar").find(
      (s) => s.key === "list_your_property",
    )!;
    const value = img(section.values, "image")!;
    // `attachImageUrls` runs after this and resolves whatever media_id says,
    // so swapping here is the whole public-side change.
    expect(value.media_id).toBe(AR);
    expect(value.alt).toBe("مفاتيح");
  });

  it("leaves English untouched", () => {
    const section = resolveSections(home, stored, "en").find(
      (s) => s.key === "list_your_property",
    )!;
    expect(img(section.values, "image")!.media_id).toBe(EN);
  });

  it("keeps the English asset when no Arabic one is picked", () => {
    const { values } = applyLocale(
      { image: { media_id: EN, alt: "keys", label: "caption" } },
      "ar",
    );
    const value = values.image as ImageValue;
    expect(value.media_id).toBe(EN);
    // The placeholder caption survives — the object is folded key by key, not
    // replaced wholesale.
    expect(value.label).toBe("caption");
  });

  it("never emits the storage shape to a renderer", () => {
    const { values } = applyLocale(
      { image: { media_id: EN, media_id_ar: AR, alt: null, label: null } },
      "ar",
    );
    expect("media_id_ar" in (values.image as object)).toBe(false);
  });

  it("applies inside a list item too", () => {
    // Cards fold through `foldItem`, which used to look for a sibling key
    // named `image_ar` — a key that never exists — and so left both the alt
    // text and the asset in English on every card on the site.
    const { values } = applyLocale(
      {
        items: [
          {
            image: { media_id: EN, media_id_ar: AR, alt: "keys", alt_ar: "مفاتيح", label: null },
          },
        ],
      },
      "ar",
    );
    const item = (values.items as Record<string, unknown>[])[0];
    const value = item.image as ImageValue;
    expect(value.media_id).toBe(AR);
    expect(value.alt).toBe("مفاتيح");
  });
});
