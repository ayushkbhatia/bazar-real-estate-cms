/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { WIRED_READ } from "./domains";

/**
 * The ratchet that stops `WIRED_READ` being self-certification.
 *
 * `WIRED_READ` is the epic's own answer to "what still renders English on
 * /ar", and `missingReadFold()` derives the remaining backlog from it. Until
 * now the only thing stopping someone adding a column to that list with a fold
 * that does nothing was care — nothing in the suite could tell the difference,
 * because a fold applied downstream of a shaping function type-checks, reads
 * correctly, and is a no-op. PR #341 shipped exactly that and it was caught by
 * a person, not by CI.
 *
 * So: every column added to `WIRED_READ` from now on must name a spec that
 * proves it folds, using the helpers in `fold-harness.ts`. The forty-five
 * entries that predate this rule are grandfathered — retro-fitting proofs for
 * all of them is real work and blocking on it would have meant shipping none
 * of this.
 *
 * `GRANDFATHERED` may only ever SHRINK. That is the whole mechanism: it cannot
 * absorb a new column, so the only way to add one is to prove it. Deleting an
 * entry from it (because you wrote the proof) is the good direction and the
 * test encourages it.
 */

/**
 * Columns whose fold predates this file. Shrink freely; never add.
 *
 * Snapshot taken on the commit that introduced the harness.
 */
const GRANDFATHERED: readonly string[] = [
  "amenities_taxonomy.label",
  "article_categories.description",
  "article_categories.label",
  "articles.body_html",
  "articles.excerpt",
  "articles.title",
  "developers.description",
  "developers.name",
  "development_unit_types.blurb",
  "development_unit_types.label",
  "development_units.lagoon_access",
  "development_units.orientation",
  "development_units.unit_type",
  "developments.amenities",
  "developments.bedrooms_text",
  "developments.description",
  "developments.name",
  "developments.tagline",
  "developments.vision",
  "floating_ctas.label",
  "floating_ctas.message_template",
  "floating_ctas.subject_template",
  "floor_plans.description",
  "floor_plans.label",
  "form_fields.help",
  "form_fields.label",
  "form_fields.placeholder",
  "form_fields.unit",
  "landing_pages.title",
  "megamenu_columns.heading",
  "megamenu_featured_tiles.badge_label",
  "megamenu_featured_tiles.cta_label",
  "megamenu_featured_tiles.headline",
  "megamenu_items.badge_label",
  "megamenu_items.label",
  "megamenu_tabs.label",
  "megamenu_tabs.panel_title",
  "megamenu_tabs.right_column_title",
  "site_settings.brand_name",
  "site_settings.brand_tagline",
  "staff.bio",
  "staff.display_name",
  "staff.languages",
  "staff.specialties",
  "staff.title",
];

/** How many entries the snapshot had. Lowering this is the point. */
const GRANDFATHERED_CEILING = 45;

/**
 * `table.column` → the spec that proves the fold, repo-relative.
 *
 * One entry per newly-wired column. The spec must use `expectFolds` from
 * `fold-harness.ts` against the real reader — asserting on a hand-built object
 * proves nothing, which is the trap the two pre-existing `_ar` assertions in
 * `localise.test.ts` fall into.
 */
const FOLD_PROOFS: Record<string, string> = {
  "areas.name": "lib/queries/areas.fold.test.ts",
  "areas.description": "lib/queries/areas.fold.test.ts",
  "media_assets.alt_text": "lib/queries/developments.fold.test.ts",
  "properties.title": "lib/queries/properties.fold.test.ts",
  "properties.short_description": "lib/queries/properties.fold.test.ts",
  "properties.description": "lib/queries/properties.fold.test.ts",
  "properties.address_line": "lib/queries/properties.fold.test.ts",
  "properties.view": "lib/queries/properties.fold.test.ts",
  "properties.orientation": "lib/queries/properties.fold.test.ts",
  "search_bar_tabs.label": "lib/queries/search-bar.fold.test.ts",
  "search_bar_tabs.placeholder": "lib/queries/search-bar.fold.test.ts",
};

describe("WIRED_READ fold proofs", () => {
  it("requires a proof for every column wired since the harness landed", () => {
    const unproven = WIRED_READ.filter(
      (key) => !GRANDFATHERED.includes(key) && !FOLD_PROOFS[key],
    ).sort();

    expect(
      unproven,
      unproven.length === 0
        ? ""
        : `These columns claim a read fold with nothing proving it:\n` +
            unproven.map((k) => `  · ${k}`).join("\n") +
            `\n\nAdd a spec using expectFolds() from lib/i18n/fold-harness.ts and ` +
            `register it in FOLD_PROOFS. Do NOT add them to GRANDFATHERED — that ` +
            `list is closed.`,
    ).toEqual([]);
  });

  it("points every proof at a file that exists", () => {
    for (const [key, file] of Object.entries(FOLD_PROOFS)) {
      expect(
        existsSync(join(process.cwd(), file)),
        `FOLD_PROOFS["${key}"] names ${file}, which is not on disk`,
      ).toBe(true);
    }
  });

  it("keeps proofs and WIRED_READ in step", () => {
    const stale = Object.keys(FOLD_PROOFS).filter(
      (k) => !WIRED_READ.includes(k),
    );
    expect(
      stale,
      `FOLD_PROOFS names columns that are no longer in WIRED_READ: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  it("only ever lets the grandfathered list shrink", () => {
    // The ratchet. If this fails because the number went UP, someone widened
    // the exemption instead of writing a proof — which is the one move that
    // would quietly undo this file.
    expect(GRANDFATHERED.length).toBeLessThanOrEqual(GRANDFATHERED_CEILING);
    expect(
      GRANDFATHERED.filter((k) => !WIRED_READ.includes(k)),
      "a grandfathered column left WIRED_READ — drop it from GRANDFATHERED too",
    ).toEqual([]);
    expect(new Set(GRANDFATHERED).size).toBe(GRANDFATHERED.length);
  });
});
