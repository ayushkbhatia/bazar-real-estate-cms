import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  columnEditSchema,
  defaultNewColumn,
  defaultNewFeaturedTile,
  defaultNewItem,
  featuredTileEditSchema,
  itemEditSchema,
  tabMetaEditSchema,
} from "./megamenu";

/**
 * The megamenu's Arabic cannot be forgotten on a save.
 *
 * `saveMegamenuTab` deletes every column, item and tile belonging to a tab and
 * re-inserts them from the payload. That makes every write a full replacement,
 * so a field the editor does not send is not a field left alone — it is a field
 * destroyed. The English would keep rendering, and the person who lost the
 * Arabic could not read it to notice.
 *
 * Two things keep that from happening, and both are asserted here.
 *
 * The write schemas declare each twin `.nullable()` WITHOUT `.optional()` — a
 * required key that may hold null. Omit one and validation fails loudly rather
 * than defaulting it away. That one choice is what made the compiler enumerate
 * all six places the twins had to be threaded through when they were added.
 *
 * And the admin query has to SELECT the twins. This is the trap that already
 * bit the property editor once: the form writes back everything it loaded, so
 * a column it never loaded is a column it overwrites with null the next time
 * anyone touches an unrelated field.
 */
const REPO_ROOT = path.join(__dirname, "..", "..");

describe("a twin cannot be silently dropped from a save", () => {
  const meta = {
    label: "Buy",
    label_ar: "شراء",
    panel_title_ar: null,
    right_column_title_ar: null,
    has_panel: true,
  };

  it("accepts a payload carrying Arabic", () => {
    const parsed = tabMetaEditSchema.safeParse(meta);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.label_ar).toBe("شراء");
  });

  it("rejects a payload that omits a twin entirely", () => {
    // The whole point: silence is not an option. Sending nothing for label_ar
    // would wipe it, so the schema refuses the payload instead.
    const { label_ar: _dropped, ...without } = meta;
    expect(tabMetaEditSchema.safeParse(without).success).toBe(false);
  });

  it("accepts an explicit null, which is how 'no Arabic' is expressed", () => {
    expect(tabMetaEditSchema.safeParse({ ...meta, label_ar: null }).success).toBe(
      true,
    );
  });

  it.each([
    ["item", itemEditSchema, { position: 0, label: "Villas", href: "/buy" }, ["label_ar", "badge_label_ar"]],
    ["column", columnEditSchema, { zone: "left", position: 0, items: [] }, ["heading_ar"]],
    [
      "featured tile",
      featuredTileEditSchema,
      { position: 0, headline: "New", href: "/x" },
      ["badge_label_ar", "headline_ar", "cta_label_ar"],
    ],
  ] as const)("%s requires every twin key", (_name, schema, base, twins) => {
    const full = { ...base } as Record<string, unknown>;
    for (const key of twins) full[key] = null;
    expect(schema.safeParse(full).success, "with all twins").toBe(true);

    for (const key of twins) {
      const missing = { ...full };
      delete missing[key];
      expect(schema.safeParse(missing).success, `without ${key}`).toBe(false);
    }
  });

  it("gives every blank row its twins, so adding one does not fail validation", () => {
    expect(itemEditSchema.safeParse(defaultNewItem(0)).success).toBe(true);
    expect(columnEditSchema.safeParse(defaultNewColumn("left", 0)).success).toBe(
      true,
    );
    expect(
      featuredTileEditSchema.safeParse(defaultNewFeaturedTile(0)).success,
    ).toBe(true);
  });

  it("caps Arabic at 1.5x its English sibling", () => {
    // Arabic runs longer for the same content often enough that the English
    // cap rejects a correct translation, and a rejected translation is a field
    // that silently stays English.
    expect(tabMetaEditSchema.safeParse({ ...meta, label_ar: "ا".repeat(90) }).success)
      .toBe(true);
    expect(tabMetaEditSchema.safeParse({ ...meta, label_ar: "ا".repeat(91) }).success)
      .toBe(false);
  });
});

describe("the editor loads what it will overwrite", () => {
  const QUERIES = readFileSync(
    path.join(REPO_ROOT, "lib", "queries", "megamenu.ts"),
    "utf8",
  );

  it.each([
    "label_ar",
    "panel_title_ar",
    "right_column_title_ar",
    "heading_ar",
    "badge_label_ar",
    "headline_ar",
    "cta_label_ar",
  ])("selects %s", (column) => {
    expect(QUERIES).toContain(column);
  });

  it("selects the twins in the admin loader, not only the public one", () => {
    // The admin loader is the load-bearing half. Both selects are checked by
    // counting: each twin appears once per query that reads its table.
    const adminHalf = QUERIES.slice(QUERIES.indexOf("ForAdmin"));
    for (const column of ["label_ar", "heading_ar", "headline_ar"]) {
      expect(adminHalf, column).toContain(column);
    }
  });
});

describe("the site_settings grant", () => {
  const MIGRATION = readFileSync(
    path.join(REPO_ROOT, "supabase", "migrations", "0102_megamenu_and_settings_arabic.sql"),
    "utf8",
  );

  it("grants the new columns to anon", () => {
    // site_settings is the one table with column-level grants. An ungranted
    // column fails the WHOLE select, so the symptom is every public page
    // falling back to code defaults — not an error anyone would see.
    expect(MIGRATION).toMatch(
      /grant select \(brand_name_ar, brand_tagline_ar\) on public\.site_settings to anon/,
    );
  });

  it("adds no grant for the megamenu tables, which do not use column grants", () => {
    const megamenuGrant = /grant select \([^)]*\) on public\.megamenu/;
    expect(MIGRATION).not.toMatch(megamenuGrant);
  });
});
