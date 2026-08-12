import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MT_TARGETS,
  PROTECTED_FIELDS,
  arColumn,
  isProtected,
  targetsFor,
} from "./targets";

/**
 * G-7 — the registry describes the real schema, and never targets something
 * protected.
 *
 * The schema half is not ceremony. The first draft of `PROTECTED_FIELDS` named
 * `properties.price`, `properties.permit_number`, `site_settings.consent_copy`
 * and `pages.legal_body`. Not one of those columns exists — the real names are
 * `price_aed`, `listing_permit_no`, and the last two are not columns at all.
 * A denylist of names that match nothing looks exactly like a denylist that
 * works, and would have gone in believing prices were protected when nothing
 * was protecting them.
 */
const REPO_ROOT = path.join(__dirname, "..", "..", "..");

/** Columns of a table, read from the generated Supabase types. */
function schemaColumns(table: string): string[] {
  const src = readFileSync(path.join(REPO_ROOT, "db", "types.ts"), "utf8");
  const block = src.match(
    new RegExp(`      ${table}: \\{\\n        Row: \\{([\\s\\S]*?)\\n        \\}`),
  );
  if (!block) return [];
  return [...block[1].matchAll(/^\s{10}(\w+)\??:/gm)].map((m) => m[1]);
}

describe("every registered column exists in the schema", () => {
  it.each([...new Set(MT_TARGETS.map((t) => t.table))])(
    "%s targets are real columns",
    (table) => {
      const columns = schemaColumns(table);
      expect(columns.length, `${table} not found in db/types.ts`).toBeGreaterThan(0);
      for (const target of targetsFor(table)) {
        expect(columns, `${table}.${target.column}`).toContain(target.column);
      }
    },
  );

  it.each([...new Set(MT_TARGETS.map((t) => t.table))])(
    "%s targets each have somewhere to store the Arabic",
    (table) => {
      // The gap this caught: the registry listed media_assets.alt_text while
      // migration 0101 only added twins to properties, so that job would have
      // translated successfully and then failed on write. A target with no
      // twin column is a job that fails at the last step instead of in review.
      const columns = schemaColumns(table);
      for (const target of targetsFor(table)) {
        expect(columns, `${table}.${arColumn(target)}`).toContain(
          arColumn(target),
        );
      }
    },
  );

  it.each([...new Set(PROTECTED_FIELDS.map((f) => f.table))])(
    "%s protected fields are real columns",
    (table) => {
      const columns = schemaColumns(table);
      expect(columns.length, `${table} not found in db/types.ts`).toBeGreaterThan(0);
      for (const field of PROTECTED_FIELDS.filter((f) => f.table === table)) {
        expect(columns, `${table}.${field.column}`).toContain(field.column);
      }
    },
  );
});

describe("the two lists cannot overlap", () => {
  it("no MT target is a protected field", () => {
    for (const target of MT_TARGETS) {
      expect(
        isProtected(target.table, target.column),
        `${target.table}.${target.column} is both a target and protected`,
      ).toBe(false);
    }
  });

  it("protects the fields whose failure mode is not 'slightly wrong'", () => {
    // Spot-check the four classes by their real column names, so a rename
    // that silently drops one from the denylist fails here.
    for (const [table, column] of [
      ["properties", "price_aed"],
      ["properties", "listing_permit_no"],
      ["reviews", "body"],
      ["properties", "advisor_note"],
    ] as const) {
      expect(isProtected(table, column), `${table}.${column}`).toBe(true);
    }
  });

  it("gives every protected field a stated reason", () => {
    for (const field of PROTECTED_FIELDS) {
      expect(field.why.trim().length, `${field.table}.${field.column}`)
        .toBeGreaterThan(0);
    }
  });
});

describe("target shape", () => {
  it("names the Arabic twin by suffix, matching the migration", () => {
    expect(arColumn({ table: "properties", column: "title", kind: "title" })).toBe(
      "title_ar",
    );
  });

  it("has no duplicate table+column entries", () => {
    const keys = MT_TARGETS.map((t) => `${t.table}.${t.column}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps properties to the three fields with a public render path", () => {
    // seo.* is derived from these three and advisor_note is internal, so
    // adding either roughly doubles the token budget for nothing a visitor
    // ever sees. If this changes, change it deliberately.
    expect(targetsFor("properties").map((t) => t.column).sort()).toEqual([
      "description",
      "short_description",
      "title",
    ]);
  });
});
