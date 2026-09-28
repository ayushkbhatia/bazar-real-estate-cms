/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import type { Locale } from "@/lib/i18n/locales";
import { expectFolds, expectNoTwinsLeak } from "@/lib/i18n/fold-harness";
import { landingProjectSelect, shapeLandingProject } from "./landing-projects";

/**
 * The Page Builder's project reader: one select for every project section on
 * a page, embedding only what those sections draw, folded before it is shaped.
 */

describe("landingProjectSelect", () => {
  it("embeds nothing the page did not ask for", () => {
    const select = landingProjectSelect({});
    expect(select).not.toContain("development_units");
    expect(select).not.toContain("development_unit_types");
    // The site plan and the pin come with every read — the sections that need
    // nothing else still need those.
    expect(select).toContain("masterplan:masterplan_id(");
    expect(select).toContain("meta");
  });

  it("embeds the inventory and the layouts only when asked", () => {
    expect(landingProjectSelect({ units: true })).toContain(
      "units:development_units(",
    );
    // The calculator's priced types come with the inventory — prices only.
    expect(landingProjectSelect({ units: true })).toContain(
      "unit_prices:development_unit_types(",
    );
    expect(landingProjectSelect({ units: true })).not.toContain("floor_plans");
    expect(landingProjectSelect({ unitTypes: true })).toContain(
      "plans:floor_plans(",
    );
  });

  it("selects the Arabic twin of every column it shows", () => {
    const select = landingProjectSelect({ units: true, unitTypes: true });
    for (const twin of [
      "name_ar",
      "description_ar",
      "bedrooms_text_ar",
      "unit_type_ar",
      "label_ar",
      "alt_text_ar",
    ]) {
      expect(select, twin).toContain(twin);
    }
  });
});

const ROW = {
  id: "dev-1",
  slug: "yas-riva",
  name: "Yas Riva Reserve",
  name_ar: "ياس ريفا ريزيرف",
  tagline: null,
  tagline_ar: null,
  description: "Waterfront villas.",
  description_ar: "فلل على الواجهة المائية.",
  vision: null,
  vision_ar: null,
  starting_price: "7900000",
  bedrooms_text: "4 - 6",
  bedrooms_text_ar: null,
  total_units: 292,
  handover_date: "2030-08-30",
  facts: { tenure: "Freehold" },
  payment_plan: {
    name: "50/50 Payment Plan",
    name_ar: "خطة سداد 50/50",
    milestones: [
      { percent: 50, label: "Down payment", label_ar: "الدفعة الأولى", timing: "" },
      { percent: 50, label: "On handover", timing: "" },
    ],
  },
  master_plan: { pins: [{ key: "A", x: 10, y: 20, label: "Club" }] },
  meta: { coords: { lat: "24.49", lng: 54.6 }, floorplan_gated: true },
  hero: null,
  masterplan: {
    storage_key: "developments/mp.jpg",
    alt_text: "Site plan",
    alt_text_ar: "المخطط العام",
  },
  developers: { name: "Aldar", name_ar: "الدار" },
  areas: { name: "Yas Island", name_ar: "جزيرة ياس" },
  units: [
    { id: "u2", unit_type: "Villa", unit_type_ar: "فيلا", beds: 5, built_up_ft2: 6000, price_aed: "9000000", status: "available", sort_order: 2 },
    { id: "u1", unit_type: "Villa", unit_type_ar: "فيلا", beds: 4, built_up_ft2: 5000, price_aed: 8000000, status: "available", sort_order: 1 },
    { id: "u3", unit_type: "Villa", beds: 6, built_up_ft2: 7000, price_aed: 1, status: "sold", sort_order: 0 },
  ],
  unit_types: [],
  unit_prices: [
    // Priced but no layouts yet: the calculator still offers it.
    { id: "t4", label: "4 Bedroom", label_ar: "أربع غرف نوم", beds: 4, size_from_ft2: 4800, price_from_aed: "8200000", enabled: true, sort_order: 1 },
    { id: "t5", label: "5 Bedroom", beds: 5, size_from_ft2: null, price_from_aed: null, enabled: true, sort_order: 0 },
  ],
};

const shape = (locale: Locale) =>
  shapeLandingProject(structuredClone(ROW) as Record<string, unknown>, locale);

/**
 * Everything but the payment plan, which keeps its twins on purpose (see the
 * spec below) — so the harness's leak check, which walks the whole result,
 * runs over everything else.
 */
const read = (locale: Locale) => {
  const { paymentPlan: _plan, ...rest } = shape(locale);
  return rest;
};

describe("shapeLandingProject", () => {
  it("prices every priced unit type, layouts or not, and folds its label", async () => {
    const en = shape("en" as Locale);
    // A type with no layouts still has a price to plan against.
    expect(en.unitTypePrices).toEqual([
      { id: "t4", label: "4 Bedroom", beds: 4, sizeFromFt2: 4800, priceFromAed: 8_200_000 },
    ]);
    await expectFolds({
      read,
      pick: (p) => p.unitTypePrices[0]?.label,
      english: "4 Bedroom",
      arabic: "أربع غرف نوم",
      what: "development_unit_types.label (calculator)",
    });
  });

  it("folds the project's name, and the joined developer and area", async () => {
    await expectFolds({
      read,
      pick: (p) => p.name,
      english: "Yas Riva Reserve",
      arabic: "ياس ريفا ريزيرف",
      what: "developments.name (landing)",
    });
    await expectFolds({
      read,
      pick: (p) => p.areaName,
      english: "Yas Island",
      arabic: "جزيرة ياس",
      what: "areas.name (landing)",
    });
    await expectFolds({
      read,
      pick: (p) => p.masterplan?.alt,
      english: "Site plan",
      arabic: "المخطط العام",
      what: "masterplan alt (landing)",
    });
  });

  /**
   * The one deliberate exception to "no twin leaves this module": the payment
   * plan. `PaymentPlanSection` finds the handover row by its ENGLISH label and
   * folds each milestone as it draws it. Fold here and every Arabic page
   * mis-splits its totals.
   */
  it("hands the payment plan over unfolded, twins and all", () => {
    const ar = shape("ar" as Locale);
    expect(ar.paymentPlan?.milestones[0]?.label).toBe("Down payment");
    expect(ar.paymentPlan?.milestones[0]?.label_ar).toBe("الدفعة الأولى");
    const { paymentPlan: _plan, ...rest } = ar;
    expectNoTwinsLeak(rest, "landing project");
  });

  it("keeps only units on sale, in sort order", () => {
    expect(read("en" as Locale).units.map((u) => [u.id, u.priceAed])).toEqual([
      ["u1", 8_000_000],
      ["u2", 9_000_000],
    ]);
    expect(read("ar" as Locale).units[0]?.unitType).toBe("فيلا");
  });

  it("reads the pin, the gate and the numbers off the record", () => {
    const p = read("en" as Locale);
    expect(p.coords).toEqual({ lat: 24.49, lng: 54.6 });
    expect(p.floorplanGated).toBe(true);
    expect(p.startingPrice).toBe(7_900_000);
    expect(p.masterPlanPins).toHaveLength(1);
    // The URL itself is built from env, which a unit test does not carry.
    expect(p.masterplan).not.toBeNull();
  });

  it("drops a payment plan that no longer matches the schema", () => {
    const p = shapeLandingProject(
      { ...structuredClone(ROW), payment_plan: { name: "Broken" } },
      "en" as Locale,
    );
    expect(p.paymentPlan).toBeNull();
  });
});
