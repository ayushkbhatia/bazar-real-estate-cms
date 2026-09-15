import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROPERTY_PAGE_COPY_SECTIONS,
  PROPERTY_TOKENS,
  propertyPageCopyDef,
} from "./property-page";
import { resolveSections, str } from "./index";
import { arabicTwins, isArKey } from "./twins";
import type { ListFieldDef } from "./types";

/**
 * The listing page's shared copy.
 *
 * The bug this closes was every band heading, the enquiry card and three FAQ
 * answers rendering English on `/ar/p/<slug>` around content that was already
 * Arabic. These pin the three ways it would come back: a default with no
 * Arabic beside it, a token that one language dropped, and the page reading a
 * field this document does not declare — which `text()` answers with "", an
 * empty eyebrow nobody would notice in review.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..");

const sections = PROPERTY_PAGE_COPY_SECTIONS;

describe("property page copy — Arabic beside every English default", () => {
  it("declares a shipped Arabic value for every translatable field", () => {
    const missing: string[] = [];
    for (const section of sections) {
      for (const twin of arabicTwins(section.fields)) {
        if (!str(section.defaults, twin.key)) {
          missing.push(`${section.key}.${twin.key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("declares no Arabic key a field does not ask for", () => {
    // A stray `_ar` default is storage `mergeValues` drops on the first save.
    for (const section of sections) {
      const twins = new Set(arabicTwins(section.fields).map((f) => f.key));
      for (const key of Object.keys(section.defaults).filter(isArKey)) {
        expect(twins.has(key), `${section.key}.${key}`).toBe(true);
      }
    }
  });

  it("gives every shared FAQ question and answer its Arabic", () => {
    const faq = sections.find((s) => s.key === "faq")!;
    const items = faq.defaults.items as Record<string, string>[];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      for (const key of ["q", "a"]) {
        expect(item[`${key}_ar`], `${item.q} → ${key}_ar`).toMatch(/[؀-ۿ]/);
        expect(item[`${key}_ar`]).not.toBe(item[key]);
      }
    }
    const list = faq.fields.find((f) => f.key === "items") as ListFieldDef;
    expect(list.kind).toBe("list");
  });

  it("never repeats the English as the Arabic", () => {
    for (const section of sections) {
      for (const key of Object.keys(section.defaults).filter(isArKey)) {
        expect(section.defaults[key], `${section.key}.${key}`).not.toBe(
          section.defaults[key.slice(0, -3)],
        );
      }
    }
  });

  it("keeps each token in both languages of the field that carries it", () => {
    const tokens = Object.values(PROPERTY_TOKENS);
    const used = (value: unknown) =>
      tokens.filter((t) => String(value ?? "").includes(t)).sort();

    for (const section of sections) {
      for (const [key, value] of Object.entries(section.defaults)) {
        if (isArKey(key) || typeof value !== "string") continue;
        expect(
          used(section.defaults[`${key}_ar`]),
          `${section.key}.${key}_ar lost a token`,
        ).toEqual(used(value));
      }
    }
    const faq = sections.find((s) => s.key === "faq")!;
    for (const item of faq.defaults.items as Record<string, string>[]) {
      expect(used(item.q_ar)).toEqual(used(item.q));
      expect(used(item.a_ar)).toEqual(used(item.a));
    }
  });

  it("keeps the Arabic the moved band labels already published", () => {
    // These were catalogue strings (`pages.property.*`,
    // `property.floorPlan.unitLayout`) that already rendered Arabic. Moving
    // them into the document must not re-word them.
    const ar = resolveSections(propertyPageCopyDef(), null, "ar");
    const at = (key: string) => ar.find((s) => s.key === key)!.values;
    expect(str(at("description"), "eyebrow")).toBe("لماذا هذا العقار");
    expect(str(at("amenities"), "eyebrow")).toBe("المزايا والمرافق");
    expect(str(at("location"), "eyebrow")).toBe("الموقع");
    expect(str(at("enquiry"), "eyebrow")).toBe("استفسر عن هذا العقار");
    expect(str(at("floor-plan"), "heading")).toBe("تخطيط الوحدة");
  });
});

describe("property page copy — the fold", () => {
  it("folds to Arabic with no storage shape left behind", () => {
    for (const section of resolveSections(propertyPageCopyDef(), null, "ar")) {
      expect(
        Object.keys(section.values).some(isArKey),
        `${section.key} leaked an _ar key`,
      ).toBe(false);
      const items = section.values.items;
      if (Array.isArray(items)) {
        for (const item of items as Record<string, unknown>[]) {
          expect(Object.keys(item).some(isArKey)).toBe(false);
          expect(String(item.q)).toMatch(/[؀-ۿ]/);
        }
      }
    }
  });

  it("renders the English defaults unchanged on /en", () => {
    const en = resolveSections(propertyPageCopyDef(), null, "en");
    const at = (key: string) => en.find((s) => s.key === key)!.values;
    // What the page's literals said before they moved.
    expect(str(at("specification"), "heading")).toBe("The full detail.");
    expect(str(at("enquiry"), "valuation_cta")).toBe(
      "Get a free valuation report",
    );
    expect(str(at("similar"), "heading")).toBe("Nearby Properties");
  });
});

describe("the listing page reads only what the document declares", () => {
  /*
   * `copy.text()` answers "" for a field it does not know, because an
   * exception on the busiest template on the site is worse than a blank. So
   * the page's calls are checked here instead, by reading its source — a
   * renamed field would otherwise ship as an invisible hole.
   */
  const files = [
    "app/[locale]/(public)/p/[slug]/page.tsx",
  ].map((f) => readFileSync(join(REPO_ROOT, f), "utf8"));

  const calls = files.flatMap((src) =>
    [
      ...src.matchAll(
        /copy\.(?:text|template)\(\s*"([\w-]+)",\s*(?:"([\w]+)"|([^,)]+))/g,
      ),
    ].map((m) => ({ section: m[1]!, field: m[2] ?? null, raw: m[3] ?? null })),
  );

  it("finds the calls, so the assertion below is not vacuous", () => {
    expect(calls.length).toBeGreaterThan(15);
  });

  it("resolves every literal (section, field) pair in both languages", () => {
    for (const locale of ["en", "ar"] as const) {
      const resolved = resolveSections(propertyPageCopyDef(), null, locale);
      for (const { section, field } of calls) {
        if (field === null) continue;
        const values = resolved.find((s) => s.key === section)?.values;
        expect(values, `no section "${section}"`).toBeDefined();
        expect(str(values!, field), `${locale}: ${section}.${field}`).not.toBe(
          null,
        );
      }
    }
  });

  it("only ever picks between the two dialog notes the document has", () => {
    // The one non-literal field argument: `leadAdvisor ? "dialog_note" :
    // "dialog_note_no_advisor"`. Pin both halves.
    const dynamic = calls.filter((c) => c.field === null);
    expect(dynamic.map((c) => c.section)).toEqual(["enquiry"]);
    const enquiry = sections.find((s) => s.key === "enquiry")!;
    expect(str(enquiry.defaults, "dialog_note")).not.toBe(null);
    expect(str(enquiry.defaults, "dialog_note_no_advisor")).not.toBe(null);
    expect(files[0]).toContain('"dialog_note_no_advisor"');
  });
});
