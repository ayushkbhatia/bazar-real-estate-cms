import { describe, expect, it } from "vitest";
import { MASTER_PAGES } from "./index";
import { MASTER_PAGE_SEO_DEFAULTS } from "./seo-defaults";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX } from "@/lib/schemas/seo";

/**
 * These defaults used to be seventeen literals in seventeen route files. The
 * risk of moving them into one table is that a page quietly loses its entry
 * and starts publishing `undefined`, which no type error catches once the
 * record is indexed by a union that a new page joins.
 */
describe("MASTER_PAGE_SEO_DEFAULTS", () => {
  it("covers every master page, and nothing that is not one", () => {
    const keys = MASTER_PAGES.map((p) => p.key).sort();
    expect(Object.keys(MASTER_PAGE_SEO_DEFAULTS).sort()).toEqual(keys);
  });

  it("gives every page a non-empty title and description", () => {
    for (const [key, seo] of Object.entries(MASTER_PAGE_SEO_DEFAULTS)) {
      expect(seo.title.trim(), key).not.toBe("");
      expect(seo.description.trim(), key).not.toBe("");
    }
  });

  it("keeps every default inside the caps an editor is held to", () => {
    // An editor cannot save a title longer than the fallback they are
    // replacing — that would be a field that refuses to accept what is
    // already published.
    for (const [key, seo] of Object.entries(MASTER_PAGE_SEO_DEFAULTS)) {
      expect(seo.title.length, `${key} title`).toBeLessThanOrEqual(
        SEO_TITLE_MAX,
      );
      expect(seo.description.length, `${key} description`).toBeLessThanOrEqual(
        SEO_DESCRIPTION_MAX,
      );
    }
  });

  it("marks only the home page's title as absolute", () => {
    // Home publishes the root layout's `title.default`, which is already the
    // untemplated form; every other page took `%s · Bazar` and must keep it.
    const absolute = Object.entries(MASTER_PAGE_SEO_DEFAULTS)
      .filter(([, seo]) => seo.titleIsAbsolute)
      .map(([key]) => key);
    expect(absolute).toEqual(["home"]);
  });
});
