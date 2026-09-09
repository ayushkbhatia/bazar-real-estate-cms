import { describe, expect, it } from "vitest";
import {
  getLibrarySection,
  librarySectionPageDef,
  partnersFrom,
  PARTNERS_MAX,
} from "./library";
import {
  getMasterPage,
  mergeValues,
  resolveSections,
  validateSections,
} from "./index";
import { arabicTwins } from "./twins";
import { isListField, isSelectField, type ListFieldDef, type StoredSection } from "./types";
import {
  ECOSYSTEM_PARTNERS,
  PARTNER_CATEGORIES,
  shippedPartners,
} from "@/lib/partners/directory-data";

const PARTNERS = getLibrarySection("partners")!;
const DEF = librarySectionPageDef(PARTNERS);

function partnerField(): ListFieldDef {
  const field = PARTNERS.section.fields.find(isListField);
  if (!field) throw new Error("the partner section lost its list field");
  return field;
}

function values(items: unknown[]) {
  return { items } as never;
}

describe("the partner ecosystem section", () => {
  it("is a library entry, not a page section — three surfaces read it", () => {
    // Filing the institutions under /partners would make one marketing route
    // the owner of a list the home page and /about also render.
    expect(PARTNERS.usedOn.map((u) => u.href)).toEqual([
      "/partners",
      "/about",
      "/",
    ]);
  });

  it("ships the seven partners the site already rendered", () => {
    const [section] = resolveSections(DEF, null);
    expect(partnersFrom(section!.values)).toEqual(shippedPartners());
  });

  it("keeps every shipped card's logo without an upload", () => {
    const [section] = resolveSections(DEF, null);
    for (const card of partnersFrom(section!.values)) {
      expect(card.logo?.src, card.name).toBe(
        ECOSYSTEM_PARTNERS.find((p) => p.slug === card.slug)!.logo,
      );
    }
  });

  it("offers exactly the groups the pages can filter on", () => {
    // The select's options and the categories the /partners bands are bound to
    // are two lists that must not drift: an option nobody filters on puts a
    // card on no page at all.
    const category = partnerField().fields.find(isSelectField)!;
    expect(category.options?.map((o) => o.value)).toEqual(PARTNER_CATEGORIES);
  });

  it("has a band on the Partners master page for each group", () => {
    const partnersPage = getMasterPage("partners")!;
    for (const key of PARTNER_CATEGORIES) {
      expect(
        partnersPage.sections.some((s) => s.key === key),
        `no ${key} band on /partners`,
      ).toBe(true);
    }
  });

  it("lets an editor hide or reorder a band, now the page reads its order", () => {
    const partnersPage = getMasterPage("partners")!;
    for (const key of PARTNER_CATEGORIES) {
      expect(partnersPage.sections.find((s) => s.key === key)!.locked).toBeFalsy();
    }
  });

  it("cannot be switched off — the section is the document", () => {
    expect(PARTNERS.section.locked).toBe(true);
  });

  it("sends an editor from the bands to the list, by link not by prose", () => {
    // The whole hazard of shared content is that the screen that owns it is
    // somewhere else. A path spelled out in a `dataNote` is a path an editor
    // has to retrace by hand — and one nobody re-checks when a route moves.
    const partnersPage = getMasterPage("partners")!;
    for (const key of PARTNER_CATEGORIES) {
      const band = partnersPage.sections.find((s) => s.key === key)!;
      expect(band.dataLink?.href, `${key} band has no link to the list`).toBe(
        `/admin/pages/sub/section/${PARTNERS.key}`,
      );
    }
  });
});

describe("partnersFrom", () => {
  it("drops a partner switched off and keeps the stored order", () => {
    const out = partnersFrom(
      values([
        { enabled: true, name: "Second", category: "banking" },
        { enabled: false, name: "Hidden", category: "banking" },
        { enabled: true, name: "First", category: "regulatory" },
      ]),
    );
    expect(out.map((p) => p.name)).toEqual(["Second", "First"]);
  });

  it("drops a card that was added and then left blank", () => {
    const out = partnersFrom(
      values([
        { enabled: true, name: "", tag: "Nothing here" },
        { enabled: true, name: "Real", category: "banking" },
      ]),
    );
    expect(out.map((p) => p.name)).toEqual(["Real"]);
  });

  it("derives a slug from the name when the logo key was cleared", () => {
    const [card] = partnersFrom(
      values([{ enabled: true, name: "Dubai Islamic Bank" }]),
    );
    expect(card!.slug).toBe("dubai-islamic-bank");
    // …which is still enough to find the art that ships for it.
    expect(card!.logo?.src).toBe("/partners/dib.png");
  });

  it("prefers a picked asset's resolved url over the shipped art", () => {
    const [card] = partnersFrom(
      values([
        {
          enabled: true,
          name: "First Abu Dhabi Bank",
          slug: "fab",
          // `url` is what `attachImageUrls` writes onto the stored value.
          logo: { media_id: "abc", url: "https://cdn.example/fab.png", alt: null },
        },
      ]),
    );
    expect(card!.logo?.src).toBe("https://cdn.example/fab.png");
  });

  it("leaves a card with no art at all logo-less rather than broken", () => {
    const [card] = partnersFrom(
      values([{ enabled: true, name: "Emirates NBD", category: "banking" }]),
    );
    expect(card!.logo).toBeNull();
    expect(card!.name).toBe("Emirates NBD");
  });

  it("keeps a card with no group out of both bands but in the strip", () => {
    const [card] = partnersFrom(values([{ enabled: true, name: "Somebody" }]));
    expect(card!.category).toBeNull();
  });

  it("ignores a group value that isn't one of the two", () => {
    const [card] = partnersFrom(
      values([{ enabled: true, name: "Somebody", category: "legal" }]),
    );
    expect(card!.category).toBeNull();
  });

  it("falls back to the shipped set rather than emptying three pages", () => {
    expect(partnersFrom(values([]))).toEqual(shippedPartners());
    expect(partnersFrom({} as never)).toEqual(shippedPartners());
  });
});

describe("Arabic", () => {
  it("derives a twin for the name and the tag, but not the logo key", () => {
    const twins = arabicTwins(partnerField().fields).map((f) => f.key);
    expect(twins).toEqual(["name_ar", "tag_ar"]);
  });

  it("fills the shipped partners from the store, so /ar is not English", () => {
    const [section] = resolveSections(DEF, null, "bilingual");
    const items = section!.values.items as Record<string, string>[];
    expect(items.length).toBe(ECOSYSTEM_PARTNERS.length);
    for (const [i, item] of items.entries()) {
      expect(item.name_ar, `partner ${i} name has no Arabic`).toBeTruthy();
      expect(item.tag_ar, `partner ${i} tag has no Arabic`).toBeTruthy();
    }
  });

  it("folds to Arabic on read, with no storage keys left behind", () => {
    const [section] = resolveSections(DEF, null, "ar");
    const [first] = partnersFrom(section!.values);
    expect(first!.name).not.toBe(ECOSYSTEM_PARTNERS[0]!.name);
    // The logo, the slug and the group survive the fold — only prose changes.
    expect(first!.slug).toBe(ECOSYSTEM_PARTNERS[0]!.slug);
    expect(first!.category).toBe(ECOSYSTEM_PARTNERS[0]!.category);
    expect(first!.logo?.src).toBe(ECOSYSTEM_PARTNERS[0]!.logo);
    const item = (section!.values.items as Record<string, unknown>[])[0]!;
    expect(Object.keys(item).some((k) => k.endsWith("_ar"))).toBe(false);
  });

  it("survives a save — the twins are not stripped by validation", () => {
    const incoming: StoredSection[] = [
      {
        key: "partners",
        enabled: true,
        values: {
          items: [
            {
              enabled: true,
              name: "Emirates NBD",
              name_ar: "بنك الإمارات دبي الوطني",
              tag: "Mortgage partner",
              tag_ar: "شريك التمويل العقاري",
              category: "banking",
              slug: "emirates-nbd",
            },
          ],
        },
      },
    ];
    const result = validateSections(DEF, incoming);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = result.sections[0]!.values.items as Record<string, string>[];
    expect(stored[0]!.name_ar).toBe("بنك الإمارات دبي الوطني");
    expect(stored[0]!.tag_ar).toBe("شريك التمويل العقاري");
  });
});

describe("validation", () => {
  it("refuses a partner with no name", () => {
    const result = validateSections(DEF, [
      {
        key: "partners",
        enabled: true,
        values: { items: [{ enabled: true, name: "", category: "banking" }] },
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it("refuses a group that isn't one of the declared choices", () => {
    const result = validateSections(DEF, [
      {
        key: "partners",
        enabled: true,
        values: { items: [{ enabled: true, name: "X", category: "legal" }] },
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it("caps the list", () => {
    const result = validateSections(DEF, [
      {
        key: "partners",
        enabled: true,
        values: {
          items: Array.from({ length: PARTNERS_MAX + 3 }, (_, i) => ({
            enabled: true,
            name: `Partner ${i}`,
            category: "banking",
          })),
        },
      },
    ]);
    expect(result.ok).toBe(false);
  });

  it("stores the picked asset id, not a url", () => {
    const result = validateSections(DEF, [
      {
        key: "partners",
        enabled: true,
        values: {
          items: [
            {
              enabled: true,
              name: "Emirates NBD",
              category: "banking",
              logo: {
                media_id: "asset-1",
                alt: "Emirates NBD",
                label: null,
                url: "https://cdn.example/x.png",
              },
            },
          ],
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [item] = result.sections[0]!.values.items as Record<string, unknown>[];
    expect(item!.logo).toEqual({
      media_id: "asset-1",
      alt: "Emirates NBD",
      label: null,
    });
  });

  it("keeps a document written before a field existed renderable", () => {
    const merged = mergeValues(PARTNERS.section, {
      items: [{ enabled: true, name: "Emirates NBD" }],
    } as never);
    expect(partnersFrom(merged)).toHaveLength(1);
  });
});
