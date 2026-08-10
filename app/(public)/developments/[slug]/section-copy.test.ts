import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEVELOPMENT_SECTIONS } from "@/lib/master-pages/subpages";

/**
 * The sub-page editor renders whatever the registry declares. Nothing forces
 * the page to *read* it, and for a long stretch it mostly didn't: eleven copy
 * fields across ten sections were saved to `pages.blocks` and then dropped on
 * the floor, so an editor could fill them in and watch the page ignore them.
 *
 * Every override on this page flows through the same `sv("<section>", "<field>")`
 * helper — including the ones handed to child components as props — so the
 * source is a reliable place to check the wiring exists. It's a coarse test,
 * but it fails in exactly the case that kept shipping: a field added to the
 * registry with no reader on the other end.
 */
const pageSource = readFileSync(join(__dirname, "page.tsx"), "utf8");

describe("development page copy overrides", () => {
  const copyFields = DEVELOPMENT_SECTIONS.flatMap((section) =>
    section.fields
      .filter((f) => f.kind === "text" || f.kind === "textarea")
      .map((f) => ({ section: section.key, field: f.key })),
  );

  it("has copy fields to check", () => {
    // Guards the test itself: a registry that stopped declaring fields would
    // otherwise make this file pass by having nothing to assert.
    expect(copyFields.length).toBeGreaterThan(20);
  });

  it.each(copyFields)(
    "reads the $section section's $field override",
    ({ section, field }) => {
      expect(pageSource).toContain(`sv("${section}", "${field}")`);
    },
  );

  it("does not read fields the registry never declares", () => {
    // The mirror-image bug: the renders section read an `eyebrow` field that
    // was never declared, so it silently resolved to null on every page.
    const declared = new Set(
      DEVELOPMENT_SECTIONS.flatMap((s) =>
        s.fields.map((f) => `${s.key}:${f.key}`),
      ),
    );
    const read = [...pageSource.matchAll(/sv\("([\w-]+)", "(\w+)"\)/g)].map(
      (m) => `${m[1]}:${m[2]}`,
    );
    expect(read.length).toBeGreaterThan(0);
    for (const key of new Set(read)) expect(declared).toContain(key);
  });
});
