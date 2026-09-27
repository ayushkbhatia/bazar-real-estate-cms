import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getMasterPage, list, resolveSections, str } from "../index";
import { isListField, isSelectField, type MasterPageDef } from "../types";
import { arabicFor } from "@/lib/i18n/arabic-store";
import { MASTER_PAGE_SEO_DEFAULTS } from "../seo-defaults";
import { LAUNCHES_PAGE, LAUNCHES_PATH } from "./launches";

/**
 * /off-plan/launches — every published project, in Pages & blocks.
 *
 * The generic invariants (unique keys, a default for every required field, an
 * Arabic twin input for every translatable one) are asserted for every master
 * page elsewhere. This covers what is specific to this one.
 */

const ROOT = join(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("/off-plan/launches master page", () => {
  const def = getMasterPage("launches") as MasterPageDef;

  it("is registered at the path the New Projects rail links to", () => {
    expect(def).toBe(LAUNCHES_PAGE);
    expect(def.path).toBe("/off-plan/launches");
    expect(LAUNCHES_PATH).toBe(def.path);
    // The rail's link and the route are the two ends of the same promise.
    expect(read("app/[locale]/(public)/off-plan/page.tsx")).toContain(
      "allViewAllHref={LAUNCHES_PATH}",
    );
    expect(() =>
      read("app/[locale]/(public)/off-plan/launches/page.tsx"),
    ).not.toThrow();
  });

  it("locks the header and the grid, so the page cannot be emptied", () => {
    const locked = def.sections.filter((s) => s.locked).map((s) => s.key);
    expect(locked).toEqual(["hero", "grid"]);
  });

  it("pins projects from the published developments", () => {
    const grid = def.sections.find((s) => s.key === "grid")!;
    const pinned = grid.fields.find((f) => f.key === "pinned");
    expect(pinned && isListField(pinned)).toBe(true);
    if (!pinned || !isListField(pinned)) return;
    const project = pinned.fields.find((f) => f.key === "slug");
    expect(project && isSelectField(project) && project.optionsKey).toBe(
      "developments",
    );
    expect(pinned.fields.map((f) => f.key)).toContain("enabled");
  });

  it("offers no seed button on the pin list", () => {
    // "Load the N projects on the page" would pin every project there is, in
    // today's order — and the next one published would land at the bottom of
    // a page whose whole promise is newest first.
    const grid = def.sections.find((s) => s.key === "grid")!;
    const pinned = grid.fields.find((f) => f.key === "pinned");
    expect(pinned && isListField(pinned) && pinned.seedKey).toBeFalsy();
  });

  it("starts with nothing pinned, so an unedited page is newest first", () => {
    const grid = resolveSections(def, null, "en").find((s) => s.key === "grid")!;
    expect(list(grid.values, "pinned")).toEqual([]);
  });

  it("reads Arabic on /ar for every word it ships with", () => {
    const en = resolveSections(def, null, "en");
    const ar = resolveSections(def, null, "ar");
    for (const section of def.sections) {
      for (const field of section.fields) {
        if (field.kind !== "text" && field.kind !== "textarea") continue;
        const english = str(en.find((s) => s.key === section.key)!.values, field.key);
        const arabic = str(ar.find((s) => s.key === section.key)!.values, field.key);
        const where = `${section.key}.${field.key}`;
        expect(english, where).toBeTruthy();
        expect(arabic, where).toBeTruthy();
        expect(arabic, where).not.toBe(english);
        expect(arabic, where).toMatch(/[؀-ۿ]/);
      }
    }
  });

  it("publishes an Arabic search title and description, both halves", () => {
    // `masterPageMetadata` applies the generated fallback only when BOTH have
    // Arabic; one without the other publishes the English pair.
    const seo = MASTER_PAGE_SEO_DEFAULTS.launches;
    expect(arabicFor(seo.title)).toMatch(/[؀-ۿ]/);
    expect(arabicFor(seo.description)).toMatch(/[؀-ۿ]/);
  });

  it("sends the closing button somewhere real by default", () => {
    const closing = resolveSections(def, null, "en").find(
      (s) => s.key === "closing",
    )!;
    expect(str(closing.values, "cta_label")).toBeTruthy();
    expect(str(closing.values, "cta_href")).toBe("/contact");
  });
});
