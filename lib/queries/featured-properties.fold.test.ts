/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import type { Locale } from "@/lib/i18n/locales";
import { expectFolds, expectNoTwinsLeak } from "@/lib/i18n/fold-harness";
import { foldRow } from "./featured-properties";

/**
 * Proof that the home page's featured row folds its joined area.
 *
 * `lib/queries/properties.ts` fixed this months ago and documented why —
 * `localiseRow` walks one level, so a joined `areas: {name, name_ar}` is one
 * opaque value whose twin never pairs. This module is a second reader of the
 * same table, written separately, and it inherited neither the `name_ar` in
 * its select nor the second fold. The visible cost was "Saadiyat Island" and
 * "Yas Island" printed in English on every card of the Arabic home page.
 */

const ROW = {
  id: "p-1",
  reference: "BAZ-AD-00001",
  title: "Sea-view apartment",
  title_ar: "شقة بإطلالة على البحر",
  areas: {
    name: "Saadiyat Island",
    name_ar: "جزيرة السعديات",
    slug: "saadiyat-island",
  },
};

const read = (locale: Locale) => foldRow({ ...ROW }, locale);

describe("the featured row's joined area", () => {
  it("folds the area name one level down", async () => {
    await expectFolds({
      read,
      pick: (row) => (row.areas as { name: string }).name,
      english: "Saadiyat Island",
      arabic: "جزيرة السعديات",
      what: "areas.name (featured row)",
    });
  });

  it("still folds the row's own columns", async () => {
    await expectFolds({
      read,
      pick: (row) => row.title,
      english: "Sea-view apartment",
      arabic: "شقة بإطلالة على البحر",
      what: "properties.title (featured row)",
    });
  });

  it("never folds the slug — that is the URL, not a label", () => {
    const ar = read("ar" as Locale);
    expect((ar.areas as { slug: string }).slug).toBe("saadiyat-island");
    expectNoTwinsLeak(ar, "featured row");
  });

  it("resolves a blank twin through the shared store", () => {
    const ar = foldRow(
      { ...ROW, areas: { ...ROW.areas, name_ar: "  " } },
      "ar" as Locale,
    );
    // The approved proper noun, from the curated list rather than from a
    // per-row copy of the answer.
    expect((ar.areas as { name: string }).name).toBe("جزيرة السعديات");
  });

  it("leaves a row with no area alone", () => {
    const ar = foldRow({ ...ROW, areas: null }, "ar" as Locale);
    expect(ar.areas).toBeNull();
  });
});
