import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * An editor can only show Arabic it was handed, and this page hands it over in
 * three separate places — the select, the `initial` object, and the form's own
 * state. Missing any one of them looks completely different from the outside:
 *
 *   - missing from the SELECT: the column never loads, and on a form that
 *     writes back what it loaded, the next save nulls it.
 *   - missing from `initial`: the column loads and is then dropped on the way
 *     to the form, so an article WITH Arabic shows "— not set" and invites
 *     someone to translate it a second time. That one shipped in #345 and was
 *     caught here.
 *   - missing from the submitted payload: the editor types Arabic, sees a
 *     success toast, and nothing is stored.
 *
 * Only the first is dangerous, but all three are silent, and none is visible
 * to a reviewer reading the diff of a single file. Hence a test that reads all
 * three.
 */
const HERE = __dirname;
const read = (f: string) => readFileSync(path.join(HERE, f), "utf8");

const TWINS = ["title_ar", "excerpt_ar", "body_html_ar"] as const;

describe("the blog editor can see and save Arabic", () => {
  const page = read("page.tsx");
  const form = read("_form.tsx");

  it.each(TWINS)("selects %s from the database", (twin) => {
    const select = page.match(/"id, title[^"]*"/)?.[0] ?? "";
    expect(select, `${twin} missing from the select`).toContain(twin);
  });

  it.each(TWINS)("passes %s into the form's initial values", (twin) => {
    const initial =
      page.match(/const initial: ArticleEditInput = \{[\s\S]*?\n  \};/)?.[0] ?? "";
    expect(initial, `${twin} missing from initial`).toContain(twin);
  });

  it.each(TWINS)("submits %s back to the action", (twin) => {
    expect(form, `${twin} missing from the submitted payload`).toContain(twin);
  });

  it("stores an untouched Arabic body as null, not an empty document", () => {
    // Tiptap serialises an empty document as "<p></p>", which is not blank to
    // any `?? ` or truthiness check downstream — it would read as "translated"
    // and suppress the English fallback on /ar.
    expect(form).toMatch(/body_html_ar:[\s\S]{0,200}replace\(\/<\[\^>\]\*>\/g, ""\)/);
  });
});
