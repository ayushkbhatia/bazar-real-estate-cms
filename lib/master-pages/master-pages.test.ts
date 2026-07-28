import { describe, it, expect } from "vitest";
import {
  MASTER_PAGES,
  defaultDocument,
  faqPairs,
  getMasterPage,
  isMasterSlug,
  masterSlug,
  parseStoredSections,
  resolveSections,
  statPairs,
  str,
  validateSections,
  type MasterPageDef,
  type SectionValues,
  type StoredSection,
} from "./index";

const buy = getMasterPage("buy") as MasterPageDef;

describe("registry", () => {
  it("declares the four master pages with unique section keys", () => {
    expect(MASTER_PAGES.map((p) => p.key)).toEqual([
      "home",
      "buy",
      "rent",
      "off-plan",
    ]);
    for (const page of MASTER_PAGES) {
      const keys = page.sections.map((s) => s.key);
      expect(new Set(keys).size, `${page.key} has duplicate keys`).toBe(
        keys.length,
      );
      expect(page.sections.length).toBeGreaterThan(0);
    }
  });

  it("gives every editable field a default, so nothing renders blank", () => {
    for (const page of MASTER_PAGES) {
      for (const section of page.sections) {
        for (const field of section.fields) {
          // Optional fields may legitimately default to null/absent.
          if (field.kind === "list" || "optional" in field) continue;
          expect(
            section.defaults[field.key],
            `${page.key}/${section.key}/${field.key}`,
          ).toBeDefined();
        }
      }
    }
  });

  it("keeps master rows out of the public pages route", () => {
    expect(masterSlug("home")).toBe("master/home");
    expect(isMasterSlug("master/buy")).toBe(true);
    expect(isMasterSlug("about")).toBe(false);
  });
});

describe("resolveSections", () => {
  it("returns the code defaults when nothing is stored", () => {
    const resolved = resolveSections(buy, null);
    expect(resolved.map((s) => s.key)).toEqual(buy.sections.map((s) => s.key));
    expect(resolved.every((s) => s.enabled)).toBe(true);
    const hero = resolved.find((s) => s.key === "hero")!;
    expect(str(hero.values, "eyebrow")).toBe("Buy a Property");
  });

  it("honours a stored order and hidden sections", () => {
    const stored: StoredSection[] = [
      { key: "faq", enabled: true, values: {} },
      { key: "hero", enabled: true, values: {} },
      { key: "why", enabled: false, values: {} },
    ];
    const resolved = resolveSections(buy, stored);
    expect(resolved.slice(0, 3).map((s) => s.key)).toEqual([
      "faq",
      "hero",
      "why",
    ]);
    expect(resolved.find((s) => s.key === "why")!.enabled).toBe(false);
    // Sections the stored document never mentioned still appear, at the end.
    expect(resolved.map((s) => s.key)).toContain("communities");
  });

  it("cannot hide a locked section", () => {
    const resolved = resolveSections(buy, [
      { key: "hero", enabled: false, values: {} },
    ]);
    expect(resolved.find((s) => s.key === "hero")!.enabled).toBe(true);
  });

  it("drops sections that no longer exist in code", () => {
    const resolved = resolveSections(buy, [
      { key: "a_section_we_deleted", enabled: true, values: {} },
    ]);
    expect(resolved.map((s) => s.key)).not.toContain("a_section_we_deleted");
  });

  it("falls back per field, so a partial document still renders", () => {
    const resolved = resolveSections(buy, [
      { key: "hero", enabled: true, values: { eyebrow: "Buy in Abu Dhabi" } },
    ]);
    const hero = resolved.find((s) => s.key === "hero")!;
    expect(str(hero.values, "eyebrow")).toBe("Buy in Abu Dhabi");
    // Untouched field keeps the shipped copy rather than going blank.
    expect(str(hero.values, "sub")).toContain("Browse ready, resale");
  });
});

describe("validateSections", () => {
  it("trims, strips unknown fields, and keeps known ones", () => {
    const result = validateSections(buy, [
      {
        key: "hero",
        enabled: true,
        values: { eyebrow: "  Spaced  ", nonsense: "x" },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hero = result.sections.find((s) => s.key === "hero")!;
    expect(hero.values.eyebrow).toBe("Spaced");
    expect(hero.values).not.toHaveProperty("nonsense");
  });

  it("rejects a blank required field and an over-long one", () => {
    const blank = validateSections(buy, [
      { key: "hero", enabled: true, values: { title: "   " } },
    ]);
    expect(blank.ok).toBe(false);
    if (blank.ok) return;
    expect(blank.issues.some((i) => /can't be empty/i.test(i.message))).toBe(
      true,
    );

    const long = validateSections(buy, [
      { key: "hero", enabled: true, values: { title: "x".repeat(400) } },
    ]);
    expect(long.ok).toBe(false);
  });

  it("caps list length and normalises image values", () => {
    const result = validateSections(buy, [
      {
        key: "ways",
        enabled: true,
        values: {
          ways_title: "Ways",
          tiles: Array.from({ length: 3 }, (_, i) => ({
            name: `Tile ${i}`,
            desc: "d",
            cta: "c",
            href: "/x",
            img: "",
            image: { media_id: "  ", alt: "  ", label: "cap" },
          })),
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tiles = result.sections.find((s) => s.key === "ways")!.values
      .tiles as Record<string, unknown>[];
    expect(tiles).toHaveLength(3);
    expect(tiles[0].image).toEqual({
      media_id: null,
      alt: null,
      label: "cap",
    });
  });

  it("keeps sections a stale editor tab didn't send", () => {
    const result = validateSections(buy, [
      { key: "hero", enabled: true, values: {} },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sections.map((s) => s.key)).toEqual(
      expect.arrayContaining(buy.sections.map((s) => s.key)),
    );
  });
});

describe("storage round-trip", () => {
  it("survives defaults → store → parse → resolve unchanged", () => {
    const stored = defaultDocument(buy);
    const parsed = parseStoredSections(JSON.parse(JSON.stringify(stored)));
    const resolved = resolveSections(buy, parsed);
    const hero = resolved.find((s) => s.key === "hero")!;
    expect(str(hero.values, "eyebrow")).toBe("Buy a Property");
    const faq = resolved.find((s) => s.key === "faq")!;
    expect(faqPairs(faq.values).length).toBeGreaterThan(0);
    const why = resolved.find((s) => s.key === "why")!;
    expect(statPairs(why.values)).toEqual([
      ["20+ yrs", "In the UAE market"],
      ["Ready + off-plan", "Full-market access"],
    ]);
  });

  it("treats junk jsonb as 'never edited'", () => {
    expect(parseStoredSections(null)).toBeNull();
    expect(parseStoredSections([])).toBeNull();
    expect(parseStoredSections([{ nope: 1 }])).toBeNull();
    expect(parseStoredSections("string")).toBeNull();
  });
});

describe("location cards (toggleable list items)", () => {
  const home = getMasterPage("home") as MasterPageDef;

  it("ships an empty card list, so the live areas still drive the section", () => {
    const resolved = resolveSections(home, null);
    const section = resolved.find((s) => s.key === "location_browsing")!;
    expect(section.values.cards).toEqual([]);
  });

  it("keeps a card's off switch through validation", () => {
    const result = validateSections(home, [
      {
        key: "location_browsing",
        enabled: true,
        values: {
          cards: [
            { enabled: false, name: "Yas Island", href: "/areas/yas-island", slug: "yas-island" },
            { enabled: true, name: "Saadiyat", href: "/areas/saadiyat", slug: "saadiyat" },
          ],
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cards = result.sections.find((s) => s.key === "location_browsing")!
      .values.cards as Record<string, unknown>[];
    expect(cards.map((c) => c.enabled)).toEqual([false, true]);
  });

  it("defaults a card with no explicit switch to visible", () => {
    const result = validateSections(home, [
      {
        key: "location_browsing",
        enabled: true,
        values: { cards: [{ name: "Reem", href: "/areas/reem", slug: "reem" }] },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cards = result.sections.find((s) => s.key === "location_browsing")!
      .values.cards as Record<string, unknown>[];
    expect(cards[0].enabled).toBe(true);
  });

  it("stores the picked asset id, not a URL", () => {
    const result = validateSections(home, [
      {
        key: "location_browsing",
        enabled: true,
        values: {
          cards: [
            {
              enabled: true,
              name: "Yas",
              href: "/areas/yas",
              slug: "yas",
              image: {
                media_id: "aaaaaaaa-1111-2222-3333-444444444444",
                alt: "Yas Island marina",
                label: "yas",
                url: "https://example.test/should-not-persist.jpg",
              },
            },
          ],
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cards = result.sections.find((s) => s.key === "location_browsing")!
      .values.cards as Record<string, Record<string, unknown>>[];
    expect(cards[0].image).toEqual({
      media_id: "aaaaaaaa-1111-2222-3333-444444444444",
      alt: "Yas Island marina",
      label: "yas",
    });
    // The resolved URL is derived on read — persisting it would go stale.
    expect(cards[0].image).not.toHaveProperty("url");
  });
});

describe("featured developments on the home page", () => {
  const home = getMasterPage("home") as MasterPageDef;
  const section = home.sections.find((s) => s.key === "off_plan_projects")!;

  it("ships empty, so the section keeps showing the latest projects", () => {
    expect(section.defaults.projects).toEqual([]);
  });

  it("offers a picker fed from the development sub-pages", () => {
    const list = section.fields.find((f) => f.key === "projects");
    expect(list?.kind).toBe("list");
    if (list?.kind !== "list") return;
    expect(list.seedKey).toBe("developments");
    const picker = list.fields.find((f) => f.key === "slug");
    expect(picker?.kind).toBe("select");
    if (picker?.kind !== "select") return;
    expect(picker.optionsKey).toBe("developments");
  });

  it("stores slugs in the chosen order and keeps the off switches", () => {
    const result = validateSections(home, [
      {
        key: "off_plan_projects",
        enabled: true,
        values: {
          projects: [
            { enabled: true, slug: "six-senses-residences" },
            { enabled: false, slug: "solaya-by-aldar" },
            { enabled: true, slug: "  reem-hills-phase-4  " },
          ],
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const picks = result.sections.find((s) => s.key === "off_plan_projects")!
      .values.projects as Record<string, unknown>[];
    expect(picks.map((p) => p.slug)).toEqual([
      "six-senses-residences",
      "solaya-by-aldar",
      "reem-hills-phase-4",
    ]);
    expect(picks.map((p) => p.enabled)).toEqual([true, false, true]);
  });

  it("caps the list and keeps an empty pick as null", () => {
    const result = validateSections(home, [
      {
        key: "off_plan_projects",
        enabled: true,
        values: {
          projects: [
            { enabled: true, slug: "" },
            ...Array.from({ length: 8 }, () => ({
              enabled: true,
              slug: "solaya-by-aldar",
            })),
          ],
        },
      },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => /6 projects or fewer/i.test(i.message))).toBe(
      true,
    );
  });
});

describe("New Projects master page", () => {
  const offPlan = getMasterPage("off-plan") as MasterPageDef;

  it("lets an editor curate the launch grid from the development pages", () => {
    const launches = offPlan.sections.find((s) => s.key === "launches")!;
    expect(launches.defaults.projects).toEqual([]);
    const list = launches.fields.find((f) => f.key === "projects");
    expect(list?.kind).toBe("list");
    if (list?.kind !== "list") return;
    expect(list.seedKey).toBe("developments");
    // The grid fits more than the home carousel, so the cap is higher.
    expect(list.max).toBeGreaterThanOrEqual(6);
    const picker = list.fields.find((f) => f.key === "slug");
    expect(picker?.kind).toBe("select");
    if (picker?.kind !== "select") return;
    expect(picker.optionsKey).toBe("developments");
  });

  it("gives every property type an image field", () => {
    const types = offPlan.sections.find((s) => s.key === "prop_types")!;
    const list = types.fields.find((f) => f.key === "items");
    expect(list?.kind).toBe("list");
    if (list?.kind !== "list") return;
    expect(list.fields.some((f) => f.kind === "image")).toBe(true);

    // The five shipped types are all editable, images included.
    const items = types.defaults.items as Record<string, unknown>[];
    expect(items.map((i) => i.name)).toEqual([
      "Apartments",
      "Villas",
      "Townhouses",
      "Penthouses",
      "Branded Residences",
    ]);
  });

  it("stores a picked image against the right property type", () => {
    const types = offPlan.sections.find((s) => s.key === "prop_types")!;
    const blank = (): Record<string, string | null> => ({
      media_id: null,
      alt: null,
      label: null,
    });
    const items = (types.defaults.items as Record<string, unknown>[]).map(
      (i) => ({ ...i, image: blank() }),
    );
    items[4] = {
      ...items[4],
      image: {
        media_id: "bbbbbbbb-1111-2222-3333-444444444444",
        alt: "Branded residence lobby",
        label: null,
      },
    };

    const result = validateSections(offPlan, [
      {
        key: "prop_types",
        enabled: true,
        values: { items } as unknown as SectionValues,
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const saved = result.sections.find((s) => s.key === "prop_types")!.values
      .items as Record<string, Record<string, unknown>>[];
    expect(saved[4].name).toBe("Branded Residences");
    expect(saved[4].image.media_id).toBe("bbbbbbbb-1111-2222-3333-444444444444");
    expect(saved[0].image.media_id).toBeNull();
  });

  it("keeps launch picks in order with their switches", () => {
    const result = validateSections(offPlan, [
      {
        key: "launches",
        enabled: true,
        values: {
          projects: [
            { enabled: true, slug: "bulgari-residences" },
            { enabled: false, slug: "saadiyat-lagoons" },
          ],
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const picks = result.sections.find((s) => s.key === "launches")!.values
      .projects as Record<string, unknown>[];
    expect(picks.map((p) => p.slug)).toEqual([
      "bulgari-residences",
      "saadiyat-lagoons",
    ]);
    expect(picks.map((p) => p.enabled)).toEqual([true, false]);
  });
});
