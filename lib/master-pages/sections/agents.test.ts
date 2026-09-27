import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getMasterPage, resolveSections, str, validateSections } from "../index";
import { unknownTokenIssues } from "../tokens";
import type { MasterPageDef } from "../types";
import { AGENTS_PAGE, AGENTS_PAGE_TOKENS } from "./agents";
import { DESK_INTRO, DESK_LABEL, DESK_ORDER } from "@/lib/agents/desk";

/**
 * /agents — the team index, in Pages & blocks.
 *
 * The generic invariants (unique keys, a default for every required field,
 * an Arabic twin for every translatable one) are asserted for every master
 * page elsewhere. This covers what is specific to this one: the desks are
 * sections the page keys its groups on, and the card message is a template.
 */

const PAGE = join(
  import.meta.dirname,
  "../../../app/[locale]/(public)/agents/page.tsx",
);
const pageSource = readFileSync(PAGE, "utf8");

describe("/agents master page", () => {
  const def = getMasterPage("agents") as MasterPageDef;

  it("is registered at /agents", () => {
    expect(def).toBe(AGENTS_PAGE);
    expect(def.path).toBe("/agents");
  });

  it("has one section per desk, keyed by the desk", () => {
    const keys = def.sections.map((s) => s.key);
    for (const desk of DESK_ORDER) expect(keys).toContain(desk);
    // In the order the page has always drawn them, so an unedited page is
    // the page it was.
    expect(keys.filter((k) => (DESK_ORDER as string[]).includes(k))).toEqual(
      DESK_ORDER,
    );
  });

  it("defaults every desk to the words it has always had", () => {
    const resolved = resolveSections(def, null, "en");
    for (const desk of DESK_ORDER) {
      const section = resolved.find((s) => s.key === desk)!;
      expect(str(section.values, "eyebrow")).toBe(DESK_LABEL[desk]);
      expect(str(section.values, "body")).toBe(DESK_INTRO[desk]);
      expect(section.enabled).toBe(true);
    }
  });

  it("keeps the headline the page published, on two lines", () => {
    const hero = resolveSections(def, null, "en").find((s) => s.key === "hero")!;
    expect(str(hero.values, "eyebrow")).toBe("Our team");
    expect(str(hero.values, "title")).toBe("Twelve advisors.");
    expect(str(hero.values, "title_second")).toBe("By design.");
  });

  it("reads Arabic on /ar for every band", () => {
    const resolved = resolveSections(def, null, "ar");
    for (const section of resolved) {
      for (const [key, value] of Object.entries(section.values)) {
        if (typeof value !== "string" || value.trim() === "") continue;
        expect(value, `${section.key}.${key} is still English`).toMatch(
          /[؀-ۿ]/,
        );
      }
    }
  });

  it("lets a desk be hidden, and not the header", () => {
    const resolved = resolveSections(def, [
      { key: "hero", enabled: false, values: {} },
      { key: "lettings", enabled: false, values: {} },
    ]);
    expect(resolved.find((s) => s.key === "hero")!.enabled).toBe(true);
    expect(resolved.find((s) => s.key === "lettings")!.enabled).toBe(false);
  });

  it("ships a card message that uses only tokens the page fills", () => {
    const shipped = resolveSections(def, null, "bilingual").map((s) => ({
      key: s.key,
      enabled: s.enabled,
      values: s.values,
    }));
    expect(unknownTokenIssues(def, shipped, AGENTS_PAGE_TOKENS)).toEqual([]);
  });

  it("refuses a card message with a token the page does not fill", () => {
    const result = validateSections(def, [
      {
        key: "cards",
        enabled: true,
        values: { whatsapp_message: "Hi {advisor}" },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      unknownTokenIssues(def, result.sections, AGENTS_PAGE_TOKENS),
    ).toHaveLength(1);
  });

  it("fills every token it offers", () => {
    for (const token of AGENTS_PAGE_TOKENS) {
      const key = token.slice(1, -1);
      expect(pageSource, `the page never fills ${token}`).toMatch(
        new RegExp(`\\b${key}:`),
      );
    }
  });

  it("reads every field it declares", () => {
    for (const section of def.sections) {
      for (const field of section.fields) {
        // Desk sections are read through `v(desk)`, so their fields appear
        // once, under the loop variable, rather than once per desk.
        expect(pageSource, `${section.key}.${field.key}`).toContain(
          `"${field.key}")`,
        );
      }
    }
  });
});
