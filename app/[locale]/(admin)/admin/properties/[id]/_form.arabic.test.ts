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
