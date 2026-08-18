/**
 * The sub-page loaders fold to the request locale, and hand the editor both.
 *
 * Two bugs in one signature. `resolveSections` defaults to English, and
 * neither loader passed a locale, so:
 *
 *  - every `/ar/areas/<slug>` and `/ar/developments/<slug>` rendered its
 *    section document in English regardless of what was stored — 44 routes;
 *  - and the CMS editors, which share these loaders, received values with the
 *    `_ar` keys already stripped by `applyLocale`. The Arabic inputs rendered
 *    blank and the save wrote that blank back, destroying stored Arabic.
 *
 * The second is why this file tests the editor path as well as the public one:
 * a fix that only made `/ar` correct would still eat the client's typing.
 */
import { describe, expect, it } from "vitest";
import { resolveSections, type MasterPageDef } from "@/lib/master-pages";

const def = {
  key: "area",
  label: "Area",
  sections: [
    {
      key: "intro",
      label: "Intro",
      fields: [
        { key: "title", label: "Title", kind: "text" },
        { key: "body", label: "Body", kind: "textarea" },
      ],
      defaults: {},
    },
  ],
} as unknown as MasterPageDef;

const stored = [
  {
    key: "intro",
    enabled: true,
    values: {
      title: "Saadiyat Island",
      title_ar: "جزيرة السعديات",
      body: "A cultural district.",
      body_ar: "حي ثقافي.",
    },
  },
];

const values = (locale: Parameters<typeof resolveSections>[2]) =>
  resolveSections(def, stored, locale)[0]!.values;

describe("sub-page section folding", () => {
  it("renders Arabic on the Arabic route", () => {
    expect(values("ar")).toMatchObject({
      title: "جزيرة السعديات",
      body: "حي ثقافي.",
    });
  });

  it("renders English on the English route", () => {
    expect(values("en")).toMatchObject({
      title: "Saadiyat Island",
      body: "A cultural district.",
    });
  });

  it("hides the storage shape from renderers in both languages", () => {
    // `applyLocale` guarantees no `_ar` key survives, so a renderer cannot
    // read the wrong field by accident.
    for (const locale of ["en", "ar"] as const) {
      expect(Object.keys(values(locale)).filter((k) => k.endsWith("_ar"))).toEqual([]);
    }
  });

  it("keeps both sides for the editor", () => {
    // The data-loss case. Without "bilingual" the editor sees no `_ar` key,
    // renders its Arabic inputs blank, and saves the blank back.
    const editor = values("bilingual");
    expect(editor).toMatchObject({
      title: "Saadiyat Island",
      title_ar: "جزيرة السعديات",
      body_ar: "حي ثقافي.",
    });
  });

  it("fills a blank twin from the content-addressed store", () => {
    // Not a fallback to English. `fillArabic` keys the store on the ENGLISH
    // string, so a section whose twin was never typed still renders Arabic if
    // that exact phrase has been translated anywhere else on the site. This
    // is why "Yas Island" comes back Arabic from an empty `title_ar`.
    const known = [
      { key: "intro", enabled: true, values: { title: "Yas Island", title_ar: "" } },
    ];
    expect(resolveSections(def, known as never, "ar")[0]!.values.title).toBe(
      "جزيرة ياس",
    );
  });

  it("keeps English when the store has never seen the phrase", () => {
    const unknown = [
      {
        key: "intro",
        enabled: true,
        values: { title: "Quite specific unseen heading", title_ar: "" },
      },
    ];
    expect(resolveSections(def, unknown as never, "ar")[0]!.values.title).toBe(
      "Quite specific unseen heading",
    );
  });
});
