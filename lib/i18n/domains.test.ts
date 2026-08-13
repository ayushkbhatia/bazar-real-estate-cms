import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AWAITING_TWIN,
  DOMAINS,
  WIRED_EDITOR,
  WIRED_READ,
  missingEditor,
  missingReadFold,
  translatableColumns,
  translatableKeys,
} from "./domains";
import { MT_TARGETS, isProtected } from "./mt/targets";

/**
 * G-9 — the schema-level teacher.
 *
 * The Page Builder choke point means a new `FieldDef` gets Arabic for free. A
 * new *table* gets nothing: there is no field list to derive from, the English
 * renders correctly, and no existing test has an opinion. This is the test
 * that notices.
 *
 * It reads `db/types.ts` rather than the live database, so it works in CI with
 * no credentials and moves in lockstep with `npm run db:types`.
 */
const REPO_ROOT = path.join(__dirname, "..", "..");

const TYPES = readFileSync(path.join(REPO_ROOT, "db", "types.ts"), "utf8");

/** Every base table in the generated types, with its columns. */
function schemaTables(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const block = TYPES.match(/ {4}Tables: \{\n([\s\S]*?)\n {4}Views: \{/);
  if (!block) return out;
  for (const m of block[1].matchAll(
    / {6}(\w+): \{\n {8}Row: \{([\s\S]*?)\n {8}\}/g,
  )) {
    const columns = [...m[2].matchAll(/^\s{10}(\w+)\??:/gm)].map((c) => c[1]);
    out.set(m[1], new Set(columns));
  }
  return out;
}

const SCHEMA = schemaTables();

describe("the registry describes the whole schema", () => {
  it("finds the tables at all", () => {
    // If the shape of db/types.ts changes, every other assertion here would
    // pass vacuously. Fail loudly instead.
    expect(SCHEMA.size).toBeGreaterThan(40);
    expect(SCHEMA.has("properties")).toBe(true);
  });

  it("classifies every table exactly once", () => {
    const registered = DOMAINS.map((d) => d.table);
    expect(new Set(registered).size, "a table is listed twice").toBe(
      registered.length,
    );

    const missing = [...SCHEMA.keys()].filter((t) => !registered.includes(t));
    expect(
      missing,
      `these tables are in db/types.ts but not in lib/i18n/domains.ts. ` +
        `Add each one with its public columns, or exclude it with a reason. ` +
        `See docs/I18N.md, "I added a new column with public text".`,
    ).toEqual([]);
  });

  it("does not register tables that no longer exist", () => {
    const stale = DOMAINS.map((d) => d.table).filter((t) => !SCHEMA.has(t));
    expect(stale, "dropped tables still registered").toEqual([]);
  });

  it("gives every excluded table a reason", () => {
    for (const domain of DOMAINS) {
      if (domain.columns.length > 0) continue;
      expect(
        (domain.excluded ?? "").trim().length,
        `${domain.table} has no public columns and no stated reason`,
      ).toBeGreaterThan(20);
    }
  });

  it("names only real columns", () => {
    for (const domain of DOMAINS) {
      const columns = SCHEMA.get(domain.table);
      for (const entry of domain.columns) {
        expect(columns?.has(entry.column), `${domain.table}.${entry.column}`).toBe(
          true,
        );
      }
    }
  });

  it("cites evidence for every public column", () => {
    // The claim "a visitor can read this" is the load-bearing one, and it is
    // the one that rots. A file:line makes it re-checkable.
    for (const { table, columns } of DOMAINS) {
      for (const entry of columns) {
        expect(entry.evidence.length, `${table}.${entry.column}`).toBeGreaterThan(5);
      }
    }
  });
});

describe("the remaining work is written down, not remembered", () => {
  const twinName = (column: string) => `${column}_ar`;

  /** Registered columns that need Arabic and have no twin column yet. */
  function missingTwins(): string[] {
    const out: string[] = [];
    for (const domain of DOMAINS) {
      const columns = SCHEMA.get(domain.table);
      for (const entry of domain.columns) {
        if (entry.strategy === "never" || entry.inBag || entry.labelMapped) continue;
        if (!columns?.has(twinName(entry.column))) {
          out.push(`${domain.table}.${entry.column}`);
        }
      }
    }
    return out.sort();
  }

  it("lists exactly the columns still awaiting a twin", () => {
    // Self-cleaning in both directions: ship a twin and its stale entry fails
    // here until removed; register a new public column and it fails until
    // either the twin or an entry exists.
    expect(missingTwins()).toEqual([...AWAITING_TWIN].sort());
  });

  it("has twins for everything already shipped", () => {
    const shipped = translatableColumns()
      .filter((c) => !AWAITING_TWIN.includes(`${c.table}.${c.column}`))
      .filter((c) => {
        const entry = DOMAINS.find((d) => d.table === c.table)?.columns.find(
          (x) => x.column === c.column,
        );
        return !entry?.inBag && !entry?.labelMapped;
      });
    for (const { table, column } of shipped) {
      expect(SCHEMA.get(table)?.has(twinName(column)), `${table}.${column}`).toBe(
        true,
      );
    }
  });
});

describe("the registry and the MT pipeline agree", () => {
  it("never machine-translates something marked never", () => {
    for (const target of MT_TARGETS) {
      const entry = DOMAINS.find((d) => d.table === target.table)?.columns.find(
        (c) => c.column === target.column,
      );
      expect(entry?.strategy, `${target.table}.${target.column}`).not.toBe("never");
    }
  });

  it("does not target anything the denylist protects", () => {
    for (const target of MT_TARGETS) {
      expect(isProtected(target.table, target.column)).toBe(false);
    }
  });

  it("registers every MT target as a public column", () => {
    // A target that is not public means we are paying to translate something
    // nobody reads.
    for (const target of MT_TARGETS) {
      const entry = DOMAINS.find((d) => d.table === target.table)?.columns.find(
        (c) => c.column === target.column,
      );
      expect(entry, `${target.table}.${target.column} is an MT target but not public`)
        .toBeDefined();
    }
  });

  it("keeps every 'never' column out of the MT targets", () => {
    const targets = new Set(MT_TARGETS.map((t) => `${t.table}.${t.column}`));
    for (const domain of DOMAINS) {
      for (const entry of domain.columns) {
        if (entry.strategy !== "never") continue;
        expect(targets.has(`${domain.table}.${entry.column}`)).toBe(false);
      }
    }
  });
});

/**
 * Coverage, kept honest.
 *
 * A twin column existing is not the same as a person being able to type into
 * it, nor as the public page rendering it. Those three used to be conflated,
 * and `developers` proved the cost: columns shipped, the work-list went quiet,
 * and nothing in the CMS could reach them.
 *
 * These do not fail on incompleteness — the remaining wiring is real, planned
 * work. They fail on DISHONESTY: a wired list that names a column which is not
 * registered, or has drifted out of the schema, so the two short lists cannot
 * quietly stop describing reality.
 */
describe("editor and read-path coverage", () => {
  it("only claims columns that are actually registered", () => {
    const known = new Set(translatableKeys());
    for (const key of [...WIRED_EDITOR, ...WIRED_READ]) {
      expect(known.has(key), `${key} is claimed wired but not a registered translatable column`)
        .toBe(true);
    }
  });

  it("reports what still has no Arabic input", () => {
    // Not an assertion of completeness — a printed work-list that cannot rot,
    // because it is derived rather than typed.
    const missing = missingEditor();
    expect(Array.isArray(missing)).toBe(true);
    if (missing.length > 0) {
      console.log(`\n  ${missing.length} column(s) still need an Arabic input:\n    ${missing.join("\n    ")}\n`);
    }
  });

  it("reports what still renders English on /ar", () => {
    const missing = missingReadFold();
    expect(Array.isArray(missing)).toBe(true);
    if (missing.length > 0) {
      console.log(`\n  ${missing.length} column(s) still need a read-path fold:\n    ${missing.join("\n    ")}\n`);
    }
  });

  it("has nothing left awaiting a twin column", () => {
    // Migration 0104 finished the storage half outright.
    expect(AWAITING_TWIN).toEqual([]);
  });
});
