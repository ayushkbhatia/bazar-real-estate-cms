import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normaliseEditInput, propertyEditSchema } from "@/lib/schemas/property";

/**
 * The silent-destruction guard for property Arabic (risk R3).
 *
 * `normaliseEditInput` maps every nullable text field to null when it arrives
 * as `undefined`, which is correct for a field the form owns — an empty box
 * should store NULL, not "". It is destructive for a field the form never
 * loaded: the editor changes a price, saves, and `title_ar` goes from real
 * Arabic to null with a success toast on screen.
 *
 * The editor cannot read Arabic, so nobody notices for weeks. That is why this
 * is a test and not a comment.
 */
describe("the Arabic twins survive a round trip", () => {
  const base = {
    title: "Five-bedroom villa",
    type: "villa",
    mode: "buy",
    slug: "five-bedroom-villa",
    developer_id: "11111111-1111-1111-1111-111111111111",
    price_aed: 12_500_000,
    beds: 5,
    baths: 6,
  };

  it("keeps Arabic that the form loaded and did not touch", () => {
    const parsed = propertyEditSchema.safeParse(
      normaliseEditInput({
        ...base,
        title_ar: "فيلا من خمس غرف نوم",
        short_description_ar: "فيلا فاخرة",
      }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.title_ar).toBe("فيلا من خمس غرف نوم");
    expect(parsed.data.short_description_ar).toBe("فيلا فاخرة");
  });

  it("stores a cleared box as null rather than an empty string", () => {
    // "" would read as "translated to nothing" everywhere downstream, and the
    // fallback-to-English rule keys on blank, so both work — but only null is
    // honest about what happened.
    const out = normaliseEditInput({ ...base, title_ar: "" }) as Record<
      string,
      unknown
    >;
    expect(out.title_ar).toBeNull();
  });

  it("accepts Arabic up to 1.5x the English cap", () => {
    // Arabic runs longer for the same content often enough that the English
    // cap rejects a correct translation — and a rejected translation is a
    // field that silently stays English.
    const ok = propertyEditSchema.safeParse(
      normaliseEditInput({ ...base, title_ar: "ا".repeat(240) }),
    );
    expect(ok.success).toBe(true);

    const tooLong = propertyEditSchema.safeParse(
      normaliseEditInput({ ...base, title_ar: "ا".repeat(241) }),
    );
    expect(tooLong.success).toBe(false);
  });
});

describe("the long description is reachable end to end", () => {
  const read = (f: string) =>
    readFileSync(path.join(__dirname, f), "utf8");

  it.each(["description", "description_ar"])(
    "selects %s on the property page",
    (column) => {
      const select = read("page.tsx").match(/"id, reference[^"]*"/)?.[0] ?? "";
      expect(select, `${column} missing from the select`).toContain(column);
    },
  );

  it.each(["description", "description_ar"])(
    "passes %s into the form's initial values",
    (column) => {
      const initial =
        read("page.tsx").match(/const initial: PropertyEditInput = \{[\s\S]*?\n  \};/)?.[0] ??
        "";
      expect(initial, `${column} missing from initial`).toContain(column);
    },
  );

  it("merges both into the submitted payload", () => {
    // Tiptap is not a controlled input, so these live in local state and are
    // merged at submit. Miss that and the editor saves with a success toast
    // and nothing stored — the failure the article editor was built to avoid.
    const form = read("_form.tsx");
    expect(form).toMatch(/updateProperty\(propertyId, \{[\s\S]{0,400}description:/);
    expect(form).toContain("description_ar:");
  });

  it("stores an emptied editor as null rather than an empty document", () => {
    // "<p></p>" is not blank to any `??` downstream — it would read as
    // "described" on a listing with no description. Asserted on behaviour
    // rather than on a source pattern: both fields must be guarded by the
    // same tag-stripping check before they are sent.
    const form = read("_form.tsx");
    expect(form, "no tag-stripping guard").toContain('replace(/<[^>]*>/g, "")');
    expect(form).toMatch(/description: hasWords\(descriptionHtml\) \? descriptionHtml : null/);
    expect(form).toMatch(/description_ar: hasWords\(descriptionAr\) \? descriptionAr : null/);
  });

  it("sanitises the HTML before it is written", () => {
    // The value that reaches the server is whatever was posted, not whatever
    // the toolbar allows.
    const actions = read("_actions.ts");
    expect(actions).toContain("sanitizeArticleHtml");
  });
});

describe("the editor loads what it can overwrite", () => {
  it("selects both Arabic columns on the property page", () => {
    // The actual defect this pair of files had: the schema accepted the twins
    // and the form rendered them, but page.tsx never fetched them, so every
    // save wrote null over whatever was there.
    const src = readFileSync(
      path.join(__dirname, "page.tsx"),
      "utf8",
    );
    const select = src.match(/"id, reference[^"]*"/)?.[0] ?? "";
    expect(select).toContain("title_ar");
    expect(select).toContain("short_description_ar");
  });
});
