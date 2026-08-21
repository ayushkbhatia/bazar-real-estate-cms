import { describe, expect, it } from "vitest";
import {
  SEARCH_HEADERS,
  SEARCH_HEADER_SECTION_KEY,
  getSearchHeader,
  isSearchHeaderKey,
  searchHeaderFor,
  searchHeaderPageDef,
} from "./search-headers";
import { mergeValues, resolveSections, str, validateSections } from "./index";
import { arabicTwins } from "./twins";
import { SUBPAGE_KINDS, subPageSlug } from "./subpages";
import { PROPERTY_FORMS, PROPERTY_MODES } from "@/lib/schemas/property";
import type { StoredSection } from "./types";

const BUY = getSearchHeader("buy")!;

describe("the search-header registry", () => {
  it("registers itself as a sub-page kind, so it has a home in the CMS", () => {
    const kind = SUBPAGE_KINDS.find((k) => k.kind === "search");
    expect(kind, "no Search results card on /admin/pages").toBeTruthy();
    expect(kind!.adminPath).toBe("/admin/pages/sub/search");
    // It spans six routes, so `<publicPath>/…` would read "//…" — the label
    // has to be supplied, the way the library entry supplies one.
    expect(kind!.pathLabel).toBeTruthy();
  });

  it("stores under the reserved sub-page prefix", () => {
    expect(subPageSlug("search", "buy")).toBe("subpage/search/buy");
  });

  it("only answers to keys it declares", () => {
    expect(isSearchHeaderKey("buy")).toBe(true);
    expect(isSearchHeaderKey("mode.buy")).toBe(false);
    expect(getSearchHeader("mode.buy")).toBeNull();
  });

  it("has one document per key — a duplicate would orphan the other", () => {
    const keys = SEARCH_HEADERS.map((h) => h.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("names a public route and a revalidation path for every entry", () => {
    for (const entry of SEARCH_HEADERS) {
      expect(entry.publicPath.startsWith("/"), entry.key).toBe(true);
      // `revalidatePath` takes a path. A query on it names a cache key that
      // does not exist and silently no-ops — the whole reason this is a
      // separate field from `publicPath`.
      expect(entry.revalidatePath, entry.key).not.toContain("?");
      expect(entry.publicPath.startsWith(entry.revalidatePath), entry.key).toBe(
        true,
      );
    }
  });
});

describe("addressing", () => {
  it("covers every property mode, so no search route falls through", () => {
    for (const mode of PROPERTY_MODES) {
      const entry = searchHeaderFor(mode);
      expect(entry.match.mode, mode).toBe(mode);
      expect(entry.match.form, `${mode} resolved to a form facet`).toBeUndefined();
    }
  });

  it("covers every completion form on the buy umbrella", () => {
    for (const form of PROPERTY_FORMS) {
      const entry = searchHeaderFor("buy", form);
      expect(entry.match.form, form).toBe(form);
    }
  });

  it("gives /buy/ready and /buy/resale different headlines", () => {
    // The bug this whole split exists to prevent: the two sale sub-routes
    // looked identical for 27 migrations because they shared an h1.
    const ready = searchHeaderFor("buy", "ready_new").section.defaults.title;
    const resale = searchHeaderFor("buy", "resale").section.defaults.title;
    expect(ready).not.toBe(resale);
  });

  it("keeps the buy off-plan slice off the /off-plan heading", () => {
    expect(searchHeaderFor("buy", "off_plan").key).toBe("off-plan-sale");
    expect(searchHeaderFor("off_plan").key).toBe("off-plan");
    expect(searchHeaderFor("buy", "off_plan").section.defaults.title).not.toBe(
      searchHeaderFor("off_plan").section.defaults.title,
    );
  });

  it("ignores a form on a mode that has none — /rent has no completion form", () => {
    // `SearchList` never passes one, but a caller that did must get the mode
    // copy rather than nothing.
    expect(searchHeaderFor("rent", "resale").key).toBe("rent");
  });
});

describe("defaults", () => {
  it("ships a headline for every facet, in English and in Arabic", () => {
    for (const entry of SEARCH_HEADERS) {
      const d = entry.section.defaults;
      for (const key of ["eyebrow", "title", "subtitle"]) {
        expect(d[key], `${entry.key}.${key}`).toBeTruthy();
        expect(d[`${key}_ar`], `${entry.key}.${key}_ar`).toBeTruthy();
        expect(
          d[`${key}_ar`],
          `${entry.key}.${key}_ar is the English pasted in`,
        ).not.toBe(d[key]);
      }
    }
  });

  it("cannot be switched off — the section is the document", () => {
    for (const entry of SEARCH_HEADERS) {
      expect(entry.section.locked, entry.key).toBe(true);
      expect(entry.section.key, entry.key).toBe(SEARCH_HEADER_SECTION_KEY);
    }
  });

  it("says what is NOT editable here, so nobody hunts for the result count", () => {
    for (const entry of SEARCH_HEADERS) {
      expect(entry.section.dataNote, entry.key).toBeTruthy();
    }
  });
});

describe("Arabic", () => {
  it("derives a twin for each of the three fields", () => {
    const twins = arabicTwins(BUY.section.fields).map((f) => f.key);
    expect(twins).toEqual(["eyebrow_ar", "title_ar", "subtitle_ar"]);
  });

  it("folds to Arabic on read, with no storage keys left behind", () => {
    const [section] = resolveSections(searchHeaderPageDef(BUY), null, "ar");
    expect(str(section!.values, "title")).toBe(
      BUY.section.defaults.title_ar as string,
    );
    expect(Object.keys(section!.values).some((k) => k.endsWith("_ar"))).toBe(
      false,
    );
  });

  it("keeps English on /en", () => {
    const [section] = resolveSections(searchHeaderPageDef(BUY), null, "en");
    expect(str(section!.values, "title")).toBe(
      BUY.section.defaults.title as string,
    );
  });

  it("survives a save — the twin is not stripped by validation", () => {
    const incoming: StoredSection[] = [
      {
        key: SEARCH_HEADER_SECTION_KEY,
        enabled: true,
        values: {
          eyebrow: "For sale",
          eyebrow_ar: "للبيع",
          title: "Homes worth keeping",
          title_ar: "منازل تستحق الاقتناء",
          subtitle: null,
          subtitle_ar: null,
        },
      },
    ];
    const result = validateSections(searchHeaderPageDef(BUY), incoming);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sections[0]!.values.title_ar).toBe("منازل تستحق الاقتناء");
  });
});

describe("validation", () => {
  it("refuses a header with no title — a search page never gets an empty h1", () => {
    const result = validateSections(searchHeaderPageDef(BUY), [
      {
        key: SEARCH_HEADER_SECTION_KEY,
        enabled: true,
        values: { eyebrow: "For sale", title: "", subtitle: null },
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it("accepts a blank eyebrow and sub-title — dropping the line is a choice", () => {
    const result = validateSections(searchHeaderPageDef(BUY), [
      {
        key: SEARCH_HEADER_SECTION_KEY,
        enabled: true,
        values: { eyebrow: "", title: "Properties for sale", subtitle: "" },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(str(result.sections[0]!.values, "eyebrow")).toBeNull();
  });

  it("keeps a document that predates a new field renderable", () => {
    const merged = mergeValues(BUY.section, { title: "Only a title" } as never);
    expect(str(merged, "title")).toBe("Only a title");
    expect(str(merged, "eyebrow")).toBe(BUY.section.defaults.eyebrow);
  });
});
