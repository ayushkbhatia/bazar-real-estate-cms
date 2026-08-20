import { describe, expect, it } from "vitest";
import {
  LIBRARY_SECTIONS,
  getLibrarySection,
  isLibrarySectionKey,
  librarySectionPageDef,
  testimonialsFrom,
} from "./library";
import { resolveSections, validateSections, mergeValues } from "./index";
import { arabicTwins } from "./twins";
import { SEED_TESTIMONIALS } from "@/lib/seeds/awards";
import { SUBPAGE_KINDS, subPageSlug } from "./subpages";
import { isListField, type ListFieldDef, type StoredSection } from "./types";

const TESTIMONIALS = getLibrarySection("testimonials")!;

function reviewField(): ListFieldDef {
  const field = TESTIMONIALS.section.fields.find(isListField);
  if (!field) throw new Error("the testimonials section lost its list field");
  return field;
}

describe("the section library", () => {
  it("registers itself as a sub-page kind, so it has a home in the CMS", () => {
    const kind = SUBPAGE_KINDS.find((k) => k.kind === "section");
    expect(kind, "no Sections card on /admin/pages").toBeTruthy();
    expect(kind!.adminPath).toBe("/admin/pages/sub/section");
    // Every other kind prints `<publicPath>/…`; this one has no route of its
    // own, so it must supply the label or the card reads "//…".
    expect(kind!.pathLabel).toBeTruthy();
  });

  it("stores under the reserved sub-page prefix", () => {
    expect(subPageSlug("section", "testimonials")).toBe(
      "subpage/section/testimonials",
    );
  });

  it("only answers to keys it declares", () => {
    expect(isLibrarySectionKey("testimonials")).toBe(true);
    expect(isLibrarySectionKey("reviews")).toBe(false);
    expect(getLibrarySection("reviews")).toBeNull();
  });

  it("names where each section renders, so the blast radius is visible", () => {
    for (const entry of LIBRARY_SECTIONS) {
      expect(entry.usedOn.length, entry.key).toBeGreaterThan(0);
    }
  });
});

describe("testimonials defaults", () => {
  it("ships the three reviews the home page already rendered", () => {
    const [section] = resolveSections(librarySectionPageDef(TESTIMONIALS), null);
    expect(testimonialsFrom(section!.values)).toEqual(
      SEED_TESTIMONIALS.map((t, i) => ({
        id: `review-${i}`,
        quote: t.quote,
        attribution: t.attribution,
        context: t.context,
      })),
    );
  });

  it("cannot be switched off — the section is the document", () => {
    expect(TESTIMONIALS.section.locked).toBe(true);
  });
});

describe("testimonialsFrom", () => {
  const values = (items: unknown[]) => ({ items }) as never;

  it("drops a review switched off, then slices — so the next one promotes", () => {
    const out = testimonialsFrom(
      values([
        { enabled: false, quote: "Hidden", attribution: "A" },
        { enabled: true, quote: "First", attribution: "B" },
        { enabled: true, quote: "Second", attribution: "C" },
      ]),
      2,
    );
    expect(out.map((t) => t.quote)).toEqual(["First", "Second"]);
  });

  it("drops a card that was added and then blanked", () => {
    const out = testimonialsFrom(
      values([
        { enabled: true, quote: "  ", attribution: "A" },
        { enabled: true, quote: "Real", attribution: "B" },
      ]),
    );
    expect(out.map((t) => t.quote)).toEqual(["Real"]);
  });

  it("falls back to the shipped reviews rather than rendering an empty band", () => {
    // "Never edited" and "deliberately emptied" are the same thing in storage,
    // and blanking a live section is the more expensive reading.
    expect(testimonialsFrom(values([]))).toEqual(SEED_TESTIMONIALS);
  });

  it("keeps `context` optional rather than emitting an empty line", () => {
    const [only] = testimonialsFrom(
      values([{ enabled: true, quote: "Q", attribution: "A", context: "" }]),
    );
    expect(only!.context).toBeUndefined();
  });
});

describe("Arabic", () => {
  it("derives a twin for every review sub-field a translator needs", () => {
    const twins = arabicTwins(reviewField().fields).map((f) => f.key);
    expect(twins).toEqual(["quote_ar", "attribution_ar", "context_ar"]);
  });

  it("fills the shipped reviews from the store, so /ar is not English", () => {
    const [section] = resolveSections(
      librarySectionPageDef(TESTIMONIALS),
      null,
      "bilingual",
    );
    const items = section!.values.items as Record<string, string>[];
    expect(items.length).toBe(SEED_TESTIMONIALS.length);
    for (const [i, item] of items.entries()) {
      expect(item.quote_ar, `review ${i} quote has no Arabic`).toBeTruthy();
      expect(item.attribution_ar, `review ${i} name has no Arabic`).toBeTruthy();
    }
  });

  it("folds to Arabic on read, with no storage keys left behind", () => {
    const [section] = resolveSections(
      librarySectionPageDef(TESTIMONIALS),
      null,
      "ar",
    );
    const [first] = testimonialsFrom(section!.values);
    expect(first!.quote).not.toBe(SEED_TESTIMONIALS[0]!.quote);
    const item = (section!.values.items as Record<string, unknown>[])[0]!;
    expect(Object.keys(item).some((k) => k.endsWith("_ar"))).toBe(false);
  });

  it("survives a save — the twin is not stripped by validation", () => {
    const def = librarySectionPageDef(TESTIMONIALS);
    const incoming: StoredSection[] = [
      {
        key: "testimonials",
        enabled: true,
        values: {
          items: [
            {
              enabled: true,
              quote: "They told us when to walk away.",
              quote_ar: "نصحونا بالانسحاب.",
              attribution: "A buyer",
              attribution_ar: "أحد المشترين",
              context: null,
            },
          ],
        },
      },
    ];
    const result = validateSections(def, incoming);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = result.sections[0]!.values.items as Record<string, string>[];
    expect(stored[0]!.quote_ar).toBe("نصحونا بالانسحاب.");
    expect(stored[0]!.attribution_ar).toBe("أحد المشترين");
  });
});

describe("validation", () => {
  it("refuses a review with no quote", () => {
    const result = validateSections(librarySectionPageDef(TESTIMONIALS), [
      {
        key: "testimonials",
        enabled: true,
        values: { items: [{ enabled: true, quote: "", attribution: "A" }] },
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it("keeps a section that gained a field renderable", () => {
    // A document written before `context` existed must still resolve.
    const merged = mergeValues(TESTIMONIALS.section, {
      items: [{ enabled: true, quote: "Q", attribution: "A" }],
    } as never);
    expect(testimonialsFrom(merged)).toHaveLength(1);
  });
});
