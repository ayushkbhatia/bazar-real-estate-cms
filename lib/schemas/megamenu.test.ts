import { describe, it, expect } from "vitest";
import {
  columnEditSchema,
  defaultNewColumn,
  defaultNewFeaturedTile,
  defaultNewItem,
  featuredTileEditSchema,
  itemEditSchema,
  tabEditPayloadSchema,
  tabMetaEditSchema,
} from "./megamenu";

// ───────────────────────────────────────────────────────────────
// tabMetaEditSchema
// ───────────────────────────────────────────────────────────────
describe("tabMetaEditSchema", () => {
  it("accepts a fully-populated panel tab", () => {
    const r = tabMetaEditSchema.safeParse({
      label: "Commercial",
      href: null,
      has_panel: true,
      panel_title: "Commercial in Abu Dhabi",
      panel_title_href: "/commercial",
      right_column_title: "Sub-markets",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a direct-link tab (no panel)", () => {
    const r = tabMetaEditSchema.safeParse({
      label: "Insights",
      href: "/insights",
      has_panel: false,
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty label", () => {
    const r = tabMetaEditSchema.safeParse({ label: "", has_panel: true });
    expect(r.success).toBe(false);
  });

  it("rejects a label over 60 chars", () => {
    const r = tabMetaEditSchema.safeParse({
      label: "a".repeat(61),
      has_panel: true,
    });
    expect(r.success).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────
// itemEditSchema
// ───────────────────────────────────────────────────────────────
describe("itemEditSchema", () => {
  it("accepts a minimal valid item", () => {
    const r = itemEditSchema.safeParse({
      position: 0,
      label: "Apartments",
      href: "/buy?type=apartment",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.badge_variant).toBe("default");
  });

  it("accepts all badge variants", () => {
    for (const v of ["default", "hot", "luxury", "new", "trending", "partner"]) {
      const r = itemEditSchema.safeParse({
        position: 0,
        label: "X",
        href: "/x",
        badge_variant: v,
      });
      expect(r.success).toBe(true);
    }
  });

  it("rejects negative position", () => {
    const r = itemEditSchema.safeParse({
      position: -1,
      label: "X",
      href: "/x",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty href", () => {
    const r = itemEditSchema.safeParse({ position: 0, label: "X", href: "" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown target_kind", () => {
    const r = itemEditSchema.safeParse({
      position: 0,
      label: "X",
      href: "/x",
      target_kind: "team",
    });
    expect(r.success).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────
// columnEditSchema
// ───────────────────────────────────────────────────────────────
describe("columnEditSchema", () => {
  it("accepts a left zone column with items", () => {
    const r = columnEditSchema.safeParse({
      zone: "left",
      position: 0,
      heading: "Resale",
      items: [
        { position: 0, label: "Apartments", href: "/buy?type=apartment" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("accepts an empty items array", () => {
    const r = columnEditSchema.safeParse({
      zone: "right",
      position: 0,
      heading: null,
      items: [],
    });
    expect(r.success).toBe(true);
  });

  it("rejects more than 50 items", () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      position: i,
      label: `Item ${i}`,
      href: `/x/${i}`,
    }));
    const r = columnEditSchema.safeParse({
      zone: "left",
      position: 0,
      items,
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown zone", () => {
    const r = columnEditSchema.safeParse({
      zone: "centre",
      position: 0,
      items: [],
    });
    expect(r.success).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────
// featuredTileEditSchema
// ───────────────────────────────────────────────────────────────
describe("featuredTileEditSchema", () => {
  it("accepts a complete tile", () => {
    const r = featuredTileEditSchema.safeParse({
      position: 0,
      variant: "dark",
      badge_label: "New launch",
      badge_kind: "dot",
      headline: "Solaya by Aldar",
      href: "/off-plan/solaya-by-aldar",
      cta_label: "Discover more",
    });
    expect(r.success).toBe(true);
  });

  it("accepts position 0 or 1, rejects 2+", () => {
    expect(
      featuredTileEditSchema.safeParse({
        position: 0,
        headline: "A",
        href: "/a",
      }).success,
    ).toBe(true);
    expect(
      featuredTileEditSchema.safeParse({
        position: 1,
        headline: "A",
        href: "/a",
      }).success,
    ).toBe(true);
    expect(
      featuredTileEditSchema.safeParse({
        position: 2,
        headline: "A",
        href: "/a",
      }).success,
    ).toBe(false);
  });

  it("rejects empty headline", () => {
    const r = featuredTileEditSchema.safeParse({
      position: 0,
      headline: "",
      href: "/x",
    });
    expect(r.success).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────
// tabEditPayloadSchema (top-level, transactional save)
// ───────────────────────────────────────────────────────────────
describe("tabEditPayloadSchema", () => {
  it("accepts a full Buy-style payload", () => {
    const r = tabEditPayloadSchema.safeParse({
      meta: {
        label: "Buy",
        has_panel: true,
        panel_title: "Buy properties in Abu Dhabi",
        panel_title_href: "/buy",
        right_column_title: "Other Locations",
      },
      columns: [
        {
          zone: "left",
          position: 0,
          heading: "Resale",
          items: [
            { position: 0, label: "Apartments", href: "/buy?type=apartment" },
          ],
        },
        {
          zone: "right",
          position: 0,
          heading: "Other Emirates",
          items: [{ position: 0, label: "Dubai", href: "/buy?emirate=dubai" }],
        },
      ],
      featured: [
        {
          position: 0,
          variant: "dark",
          badge_label: "New launch",
          badge_kind: "dot",
          headline: "Solaya by Aldar",
          href: "/off-plan/solaya-by-aldar",
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects more than 2 featured tiles", () => {
    const tile = {
      position: 0,
      variant: "dark" as const,
      badge_kind: "dot" as const,
      headline: "X",
      href: "/x",
    };
    const r = tabEditPayloadSchema.safeParse({
      meta: { label: "Buy", has_panel: true },
      columns: [],
      featured: [tile, tile, tile],
    });
    expect(r.success).toBe(false);
  });

  it("accepts an empty columns/featured (direct-link tab)", () => {
    const r = tabEditPayloadSchema.safeParse({
      meta: { label: "About", has_panel: false, href: "/about" },
      columns: [],
      featured: [],
    });
    expect(r.success).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// defaultNew* helpers
// ───────────────────────────────────────────────────────────────
describe("default factories", () => {
  it("defaultNewItem yields a schema-valid row", () => {
    const r = itemEditSchema.safeParse(defaultNewItem(0));
    expect(r.success).toBe(true);
  });

  it("defaultNewColumn yields a schema-valid row", () => {
    const r = columnEditSchema.safeParse(defaultNewColumn("left", 0));
    expect(r.success).toBe(true);
  });

  it("defaultNewFeaturedTile yields a schema-valid row", () => {
    const r = featuredTileEditSchema.safeParse(defaultNewFeaturedTile(0));
    expect(r.success).toBe(true);
  });

  it("first vs second tile gets different default variant", () => {
    expect(defaultNewFeaturedTile(0).variant).toBe("dark");
    expect(defaultNewFeaturedTile(1).variant).toBe("light");
  });
});
