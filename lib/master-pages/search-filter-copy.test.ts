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
});
