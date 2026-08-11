import { describe, it, expect } from "vitest";
import {
  defaultDocument,
  isListField,
  parseStoredSections,
  resolveSections,
  str,
  validateSections,
} from "./index";
import {
  AREA_SECTIONS,
  DEVELOPMENT_SECTIONS,
  SUBPAGE_KINDS,
  areaPageDef,
  developmentPageDef,
  getSubPageKind,
  isSubPageSlug,
  subPageSlug,
} from "./subpages";

const record = { name: "Solaya by Aldar", slug: "solaya-by-aldar" };
const def = developmentPageDef(record);

describe("development sub-pages", () => {
  it("namespaces its storage away from master pages and real pages", () => {
    expect(subPageSlug("development", "solaya-by-aldar")).toBe(
      "subpage/development/solaya-by-aldar",
    );
    expect(isSubPageSlug("subpage/development/solaya-by-aldar")).toBe(true);
    expect(isSubPageSlug("master/home")).toBe(false);
    expect(isSubPageSlug("about")).toBe(false);
  });

  it("mirrors the page template, with unique keys", () => {
    const keys = DEVELOPMENT_SECTIONS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const expected of [
      "hero",
      "overview",
      "master-plan",
      "payment-plan",
      "units",
      "floor-plans",
      "renders",
      "features",
      "unit-plans",
      "location",
      "developer",
      "faq",
    ]) {
      expect(keys).toContain(expected);
    }
  });

  it("puts units & floor plans between the features and the map", () => {
    // The design places the unit-type buttons under Named features and above
    // the map. An editor can move it afterwards; this is where it starts, and
    // migration 0080 splices it into the same slot in already-saved documents.
    const keys = DEVELOPMENT_SECTIONS.map((s) => s.key);
    expect(keys.indexOf("unit-plans")).toBe(keys.indexOf("features") + 1);
    expect(keys.indexOf("unit-plans")).toBe(keys.indexOf("location") - 1);
  });

  it("lets the units & floor plans section be hidden and moved", () => {
    const def = DEVELOPMENT_SECTIONS.find((s) => s.key === "unit-plans")!;
    expect(def.locked).toBeUndefined();
    const resolved = resolveSections(developmentPageDef(record), [
      { key: "unit-plans", enabled: false, values: {} },
    ]);
    expect(resolved.find((s) => s.key === "unit-plans")!.enabled).toBe(false);
  });

  it("starts every copy field blank, so the template's wording is used", () => {
    const resolved = resolveSections(def, null);
    for (const section of resolved) {
      for (const field of section.def.fields) {
        expect(str(section.values, field.key)).toBeNull();
      }
    }
    expect(resolved.every((s) => s.enabled)).toBe(true);
  });

  it("keeps a hidden section hidden, and the hero always on", () => {
    const stored = [
      { key: "units", enabled: false, values: {} },
      { key: "hero", enabled: false, values: {} },
    ];
    const resolved = resolveSections(def, stored);
    expect(resolved.find((s) => s.key === "units")!.enabled).toBe(false);
    // The hero is locked — it's the page's cover, there is no page without it.
    expect(resolved.find((s) => s.key === "hero")!.enabled).toBe(true);
  });

  it("accepts a copy override and trims it", () => {
    const result = validateSections(def, [
      {
        key: "master-plan",
        enabled: true,
        values: { heading: "  The masterplan  ", intro: "" },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const section = result.sections.find((s) => s.key === "master-plan")!;
    expect(section.values.heading).toBe("The masterplan");
    // Blank means "use the template's copy", not a validation failure —
    // every field on a sub-page is an override.
    expect(section.values.intro).toBeNull();
  });

  it("round-trips a saved document", () => {
    const saved = validateSections(def, [
      { key: "units", enabled: false, values: {} },
      { key: "location", enabled: true, values: { heading: "Getting there" } },
    ]);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const parsed = parseStoredSections(JSON.parse(JSON.stringify(saved.sections)));
    const resolved = resolveSections(def, parsed);
    expect(resolved.find((s) => s.key === "units")!.enabled).toBe(false);
    expect(
      str(resolved.find((s) => s.key === "location")!.values, "heading"),
    ).toBe("Getting there");
  });

  it("gives each development its own document", () => {
    expect(subPageSlug("development", "reem-hills-phase-4")).not.toBe(
      subPageSlug("development", "six-senses-residences"),
    );
    expect(developmentPageDef({ name: "Reem Hills Phase 4", slug: "reem-hills-phase-4" }).path).toBe(
      "/developments/reem-hills-phase-4",
    );
  });
});

describe("sub-page kinds registry", () => {
  it("exposes each kind as a block with a distinct admin route", () => {
    expect(SUBPAGE_KINDS.length).toBeGreaterThan(0);
    const kinds = SUBPAGE_KINDS.map((k) => k.kind);
    const paths = SUBPAGE_KINDS.map((k) => k.adminPath);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(new Set(paths).size).toBe(paths.length);
    for (const k of SUBPAGE_KINDS) {
      // The block links to the kind's own index, not the shared one — that's
      // what lets a second kind sit beside developments without a rewrite.
      expect(k.adminPath).toBe(`/admin/pages/sub/${k.kind}`);
      expect(k.publicPath.startsWith("/")).toBe(true);
      expect(k.label.length).toBeGreaterThan(0);
    }
  });

  it("resolves a kind by name and rejects unknown ones", () => {
    expect(getSubPageKind("development")?.label).toBe("Developments");
    expect(getSubPageKind("nonsense")).toBeNull();
  });
});

describe("reordering and gallery", () => {
  it("renders sections in the stored order", () => {
    const resolved = resolveSections(def, [
      { key: "faq", enabled: true, values: {} },
      { key: "overview", enabled: true, values: {} },
      { key: "location", enabled: true, values: {} },
    ]);
    expect(resolved.slice(0, 3).map((s) => s.key)).toEqual([
      "faq",
      "overview",
      "location",
    ]);
  });

  it("gives the renders section an add/remove gallery per half", () => {
    const renders = DEVELOPMENT_SECTIONS.find((s) => s.key === "renders")!;
    for (const key of ["interior_images", "exterior_images"]) {
      const gallery = renders.fields.find((f) => f.key === key);
      expect(gallery?.kind, key).toBe("list");
      if (gallery?.kind !== "list") continue;
      expect(gallery.fields.some((f) => f.kind === "image")).toBe(true);
      expect(gallery.fields.some((f) => f.kind === "toggle")).toBe(true);
      // Empty ⇒ that half drops out, and (for exteriors) the development
      // record's own media still shows.
      expect(renders.defaults[key]).toEqual([]);
    }
    // The single undifferentiated gallery is gone — migration 0090 moved its
    // contents to the exterior half. Leaving the key declared would put a
    // third, unread list in front of an editor.
    expect(renders.fields.map((f) => f.key)).not.toContain("images");
  });

  it("stores gallery images as asset ids, in order, with their switches", () => {
    const result = validateSections(def, [
      {
        key: "renders",
        enabled: true,
        values: {
          exterior_images: [
            {
              enabled: true,
              caption: " Pool deck ",
              image: { media_id: "aaaa", alt: "Pool", label: null },
            },
            {
              enabled: false,
              caption: null,
              image: { media_id: "bbbb", alt: null, label: null },
            },
          ],
          interior_images: [
            {
              enabled: true,
              caption: null,
              image: { media_id: "cccc", alt: "Living room", label: null },
            },
          ],
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const values = result.sections.find((s) => s.key === "renders")!.values;
    const images = values.exterior_images as Record<string, unknown>[];
    expect(images).toHaveLength(2);
    expect((images[0].image as Record<string, unknown>).media_id).toBe("aaaa");
    expect(images[0].caption).toBe("Pool deck");
    expect(images[1].enabled).toBe(false);
    // The two halves are stored apart, so neither can bleed into the other.
    const interior = values.interior_images as Record<string, unknown>[];
    expect(interior).toHaveLength(1);
    expect((interior[0].image as Record<string, unknown>).media_id).toBe("cccc");
  });

  it("keeps a stored gallery out of the other half", () => {
    // The interior half starts empty on every project in the catalogue, and a
    // read that fell through to the exterior list would quietly show the same
    // images twice.
    const resolved = resolveSections(def, [
      {
        key: "renders",
        enabled: true,
        values: {
          exterior_images: [
            { enabled: true, caption: null, image: { media_id: "aaaa", alt: null, label: null } },
          ],
        },
      },
    ]);
    const values = resolved.find((s) => s.key === "renders")!.values;
    expect(values.interior_images).toEqual([]);
    expect(values.exterior_images).toHaveLength(1);
  });

  it("no longer offers a market-context section", () => {
    // Removed from the template, so it must be gone from the editor too —
    // otherwise the wizard advertises a section that renders nothing.
    expect(DEVELOPMENT_SECTIONS.map((s) => s.key)).not.toContain(
      "market-context",
    );
  });

  it("includes the nearby-developments map as a section", () => {
    // It renders on the page, so it has to be switchable and orderable like
    // everything else — it was invisible to the editor before.
    expect(DEVELOPMENT_SECTIONS.map((s) => s.key)).toContain("nearby");
  });

  it("calls the section Nearby Developments in the editor", () => {
    // The section key stays `nearby` — it's what saved documents are filed
    // under — but the label an editor reads has to match the heading the
    // page prints, or the section is unfindable from the live page.
    const nearby = DEVELOPMENT_SECTIONS.find((s) => s.key === "nearby")!;
    expect(nearby.label).toBe("Nearby Developments");
  });

  it("gives every content section an overridable eyebrow", () => {
    // The eyebrow is the one line of a section an editor could never touch.
    // Hero has no eyebrow to override (it leads with the tagline pill) and
    // sub-navigation has no copy at all.
    for (const s of DEVELOPMENT_SECTIONS) {
      if (s.key === "hero" || s.key === "subnav") continue;
      expect(
        s.fields.map((f) => f.key).slice(0, 3),
        `${s.key} should lead with eyebrow/heading/intro`,
      ).toEqual(["eyebrow", "heading", "intro"]);
    }
  });

  it("keeps the eyebrow off the area template", () => {
    // Area guides render their own eyebrow from the hero section only, so
    // declaring one per section there would put a dead field in front of an
    // editor — the exact problem the development template just shed.
    for (const s of AREA_SECTIONS) {
      if (s.key === "hero") continue;
      expect(s.fields.map((f) => f.key)).not.toContain("eyebrow");
    }
  });

  it("lets an editor override all three lines of the nearby-developments copy", () => {
    // The section carried heading/intro fields the page never read, and no
    // eyebrow field at all, so the whole block was effectively hardcoded.
    const nearby = DEVELOPMENT_SECTIONS.find((s) => s.key === "nearby")!;
    expect(nearby.fields.map((f) => f.key)).toEqual([
      "eyebrow",
      "heading",
      "intro",
    ]);
    const resolved = resolveSections(def, [
      {
        key: "nearby",
        enabled: true,
        values: {
          eyebrow: "What's next door",
          heading: "Coming up around you",
          intro: "Three projects breaking ground within walking distance.",
        },
      },
    ]);
    const values = resolved.find((s) => s.key === "nearby")!.values;
    expect(str(values, "eyebrow")).toBe("What's next door");
    expect(str(values, "heading")).toBe("Coming up around you");
    expect(str(values, "intro")).toBe(
      "Three projects breaking ground within walking distance.",
    );
  });
});

describe("area sub-pages", () => {
  const areaRecord = { name: "Saadiyat Island", slug: "saadiyat-island" };
  const areaDef = areaPageDef(areaRecord);

  it("is registered as its own kind, with its own admin route", () => {
    const kind = getSubPageKind("area");
    expect(kind?.label).toBe("Areas");
    expect(kind?.adminPath).toBe("/admin/pages/sub/area");
    expect(kind?.publicPath).toBe("/areas");
  });

  it("namespaces storage away from developments", () => {
    expect(subPageSlug("area", "saadiyat-island")).toBe(
      "subpage/area/saadiyat-island",
    );
    // Two records with the same slug in different kinds must not collide.
    expect(subPageSlug("area", "saadiyat-lagoons")).not.toBe(
      subPageSlug("development", "saadiyat-lagoons"),
    );
  });

  /** The thirteen bands of the guide, in the order the brief lays them out. */
  const GUIDE_ORDER = [
    "hero",
    "hero-image",
    "stats",
    "map",
    "landmarks",
    "communities",
    "listings",
    "rentals",
    "nearby",
    "why",
    "lead-form",
    "faq",
    "final-cta",
  ];

  /** Bands that predate the restructure — still editable, but off by default. */
  const LEGACY = [
    "schools",
    "reports",
    "valuation",
    "lifestyle",
    "advisors",
    "similar",
  ];

  it("mirrors the guide template, in page order", () => {
    const keys = AREA_SECTIONS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual([...GUIDE_ORDER, ...LEGACY]);
  });

  it("ships the older bands switched off, so a new area follows the template", () => {
    for (const key of LEGACY) {
      expect(
        AREA_SECTIONS.find((s) => s.key === key)?.defaultEnabled,
        key,
      ).toBe(false);
    }
    const resolved = resolveSections(areaDef, null);
    expect(
      resolved.filter((s) => s.enabled).map((s) => s.key),
    ).toEqual(GUIDE_ORDER);
  });

  it("keeps the older bands editable rather than deleting them", () => {
    // Switched off is not gone: an editor can turn any of them back on, and
    // the fields have to still be there when they do.
    for (const key of LEGACY) {
      const section = AREA_SECTIONS.find((s) => s.key === key)!;
      expect(section.fields.map((f) => f.key), key).toEqual([
        "heading",
        "intro",
      ]);
    }
  });

  it("starts blank, so the shipped guide copy is used", () => {
    const resolved = resolveSections(areaDef, null);
    for (const section of resolved) {
      for (const field of section.def.fields) {
        expect(str(section.values, field.key)).toBeNull();
      }
    }
  });

  it("gives every band that renders a list somewhere to hold it", () => {
    const withLists: Record<string, string> = {
      stats: "stats",
      landmarks: "items",
      communities: "items",
      nearby: "items",
      why: "items",
      faq: "items",
    };
    for (const [key, listKey] of Object.entries(withLists)) {
      const field = AREA_SECTIONS.find((s) => s.key === key)!.fields.find(
        (f) => f.key === listKey,
      );
      expect(field?.kind, key).toBe("list");
    }
  });

  it("offers a photo per landmark and per community", () => {
    for (const key of ["landmarks", "communities"]) {
      const field = AREA_SECTIONS.find((s) => s.key === key)!.fields.find(
        isListField,
      );
      expect(
        field!.fields.some((f) => f.kind === "image"),
        key,
      ).toBe(true);
      // Switching a row off has to be possible without deleting it.
      expect(
        field!.fields.some((f) => f.key === "enabled" && f.kind === "toggle"),
        key,
      ).toBe(true);
    }
  });

  it("resets to the template rather than switching every legacy band on", () => {
    const doc = defaultDocument(areaDef);
    const on = doc.filter((s) => s.enabled).map((s) => s.key);
    expect(on).toEqual(GUIDE_ORDER);
  });

  it("reorders and hides sections, but keeps the hero", () => {
    const resolved = resolveSections(areaDef, [
      { key: "listings", enabled: true, values: {} },
      { key: "stats", enabled: false, values: {} },
      { key: "hero", enabled: false, values: {} },
    ]);
    expect(resolved.slice(0, 2).map((s) => s.key)).toEqual([
      "listings",
      "stats",
    ]);
    expect(resolved.find((s) => s.key === "stats")!.enabled).toBe(false);
    expect(resolved.find((s) => s.key === "hero")!.enabled).toBe(true);
  });

  it("accepts hero copy overrides", () => {
    const result = validateSections(areaDef, [
      {
        key: "hero",
        enabled: true,
        values: {
          heading: "  Saadiyat  ",
          intro: "Culture, beaches and the museums.",
          position: null,
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hero = result.sections.find((s) => s.key === "hero")!;
    expect(hero.values.heading).toBe("Saadiyat");
    expect(hero.values.position).toBeNull();
  });
});
