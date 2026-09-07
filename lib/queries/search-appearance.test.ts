/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { authoredTitle } from "./search-appearance";

/**
 * The root layout declares `title.template = "%s · Bazar"`, which Next applies
 * to any page title given as a plain string.
 *
 * That is right for a title the route derives and wrong for one an editor
 * typed. The Search appearance card previews the authored string untemplated
 * and measures it against Google's ~60-character cut untemplated; publishing
 * it templated adds nine characters the editor never saw, and the words that
 * fall off the end are theirs. `masterPageMetadata` and `/developments/[slug]`
 * had the rule from the start; every other editable surface published the
 * suffix — /insights/[slug] published two of them.
 */
describe("authoredTitle", () => {
  it("ships an authored title exactly as typed", () => {
    expect(authoredTitle("3BR + Maid at Yas Park Place | Yas Island", "Yas Park Place")).toEqual({
      absolute: "3BR + Maid at Yas Park Place | Yas Island",
    });
  });

  it("leaves the derived fallback templated", () => {
    // The suffix is what these pages have always published when nobody has
    // written a title, and that is deliberately unchanged.
    expect(authoredTitle(null, "Yas Park Place")).toBe("Yas Park Place");
    expect(authoredTitle(undefined, "Yas Park Place")).toBe("Yas Park Place");
  });

  it("treats an empty field as unwritten", () => {
    // Every one of these inputs emits "" for a cleared field, and
    // `readSearchAppearance` maps it to null — but a caller reading a bag by
    // hand can still pass the empty string through.
    expect(authoredTitle("", "Yas Park Place")).toBe("Yas Park Place");
  });

  it("falls through to the layout default when there is no fallback", () => {
    // The search facets: title is CMS copy either way, so there is nothing to
    // fall back to except the layout's own default. Publishing `{absolute: ""}`
    // would render an empty <title>.
    expect(authoredTitle("", undefined)).toBeUndefined();
  });
});
