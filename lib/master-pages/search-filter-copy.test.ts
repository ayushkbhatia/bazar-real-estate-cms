import { describe, expect, it } from "vitest";
import enSearch from "@/messages/en/search.json";
import {
  SEARCH_FILTER_COPY,
  searchFilterCopyFields,
  searchFilterOverrides,
} from "./search-filter-copy";

describe("search filter copy", () => {
  it("points every field at a message that exists", () => {
    for (const [, , path] of SEARCH_FILTER_COPY) {
      const v = path
        .split(".")
        .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], enSearch);
      expect(typeof v, path).toBe("string");
    }
  });

  it("shows the catalogue's words as each field's fallback", () => {
    const beds = searchFilterCopyFields().find((f) => f.key === "copy_beds");
    expect(beds).toMatchObject({ placeholder: "Beds", placeholderAr: "غرف" });
  });

  it("patches only the fields an editor filled in", () => {
    expect(
      searchFilterOverrides({
        copy_beds: "Bedrooms",
        copy_sort_recent: "Newest first",
        copy_baths: "  ",
        copy_clear: null,
      }),
    ).toEqual({
      filters: { beds: "Bedrooms" },
      sort: { recent: "Newest first" },
    });
  });

  it("never puts the editor's English on /ar when the Arabic twin is blank", () => {
    const saved = {
      copy_area: "Area",
      copy_area_ar: null,
      copy_beds: "Bedrooms",
      copy_beds_ar: "غرف",
    };
    expect(searchFilterOverrides(saved, "ar")).toEqual({
      filters: { beds: "غرف" },
    });
    expect(searchFilterOverrides(saved, "en")).toEqual({
      filters: { area: "Area", beds: "Bedrooms" },
    });
  });
});
