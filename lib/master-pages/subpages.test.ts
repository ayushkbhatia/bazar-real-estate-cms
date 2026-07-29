import { describe, it, expect } from "vitest";
import {
  parseStoredSections,
  resolveSections,
  str,
  validateSections,
} from "./index";
import {
  DEVELOPMENT_SECTIONS,
  SUBPAGE_KINDS,
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
      "location",
      "developer",
      "faq",
    ]) {
      expect(keys).toContain(expected);
    }
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

  it("gives the renders section an add/remove gallery", () => {
    const renders = DEVELOPMENT_SECTIONS.find((s) => s.key === "renders")!;
    const gallery = renders.fields.find((f) => f.key === "images");
    expect(gallery?.kind).toBe("list");
    if (gallery?.kind !== "list") return;
    expect(gallery.fields.some((f) => f.kind === "image")).toBe(true);
    expect(gallery.fields.some((f) => f.kind === "toggle")).toBe(true);
    // Empty ⇒ the development record's own media still shows.
    expect(renders.defaults.images).toEqual([]);
  });

  it("stores gallery images as asset ids, in order, with their switches", () => {
    const result = validateSections(def, [
      {
        key: "renders",
        enabled: true,
        values: {
          images: [
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
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const images = result.sections.find((s) => s.key === "renders")!.values
      .images as Record<string, Record<string, unknown> | unknown>[];
    expect(images).toHaveLength(2);
    expect((images[0].image as Record<string, unknown>).media_id).toBe("aaaa");
    expect(images[0].caption).toBe("Pool deck");
    expect(images[1].enabled).toBe(false);
  });

  it("includes the nearby-developments map as a section", () => {
    // It renders on the page, so it has to be switchable and orderable like
    // everything else — it was invisible to the editor before.
    expect(DEVELOPMENT_SECTIONS.map((s) => s.key)).toContain("nearby");
  });
});
