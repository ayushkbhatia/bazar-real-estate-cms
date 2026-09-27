import { describe, expect, it } from "vitest";
import { mergeValues, type SectionValues } from "@/lib/master-pages";
import * as adapt from "./adapters";
import { EMPTY_LANDING_DATA, type LandingData } from "./data";
import { getBlockDef } from "./catalogue";
import { blockCatalogueGap, projectFeaturesOf } from "./content-gap";
import { FSI, PDI } from "@/lib/i18n/bidi";
import type { LandingProject } from "@/lib/queries/landing-projects";
import type { AgentProfile } from "@/lib/queries/agents";
import type { ProjectFeature } from "./types";

/**
 * The project sections, the advisor card and the new content blocks, at the
 * adapter — pure, no DOM. `render.test.tsx` proves each draws; this proves
 * what it draws from, and that the editor's "this project has no …" note and
 * the section going missing are one fact rather than two that can drift.
 */

function project(over: Partial<LandingProject> = {}): LandingProject {
  return {
    id: "dev-1",
    slug: "yas-riva",
    name: "Yas Riva Reserve",
    tagline: null,
    description: "Waterfront villas.",
    vision: "A vision statement.",
    developerName: "Aldar",
    areaName: "Yas Island",
    startingPrice: 7_900_000,
    bedroomsText: "4 - 6",
    totalUnits: 292,
    handoverDate: "2030-08-30",
    facts: {},
    paymentPlan: {
      name: "50/50 Payment Plan",
      milestones: [{ percent: 100, label: "On handover", timing: "" }],
    },
    masterPlanPins: [],
    masterplan: { url: "https://example.test/mp.jpg", alt: null },
    hero: null,
    coords: { lat: 24.49, lng: 54.6 },
    floorplanGated: true,
    units: [],
    unitTypes: [
      {
        id: "t-1",
        label: "4 Bedroom",
        beds: 4,
        blurb: null,
        size_from_ft2: null,
        size_to_ft2: null,
        price_from_aed: null,
        plans: [],
        placeholder: false,
      },
    ],
    ...over,
  };
}

function data(p: LandingProject | null, over: Partial<LandingData> = {}) {
  return {
    ...EMPTY_LANDING_DATA,
    projectsBySlug: new Map(p ? [[p.slug, p]] : []),
    ...over,
  };
}

function values(key: string, over: SectionValues = {}): SectionValues {
  return { ...mergeValues(getBlockDef(key)!, null), ...over };
}

describe("project facts", () => {
  it("falls back to the project's own name and description", () => {
    const p = adapt.projectFactsProps(
      values("project_facts", { development: "yas-riva" }),
      data(project()),
    )!;
    expect(p.heading).toBe("Yas Riva Reserve");
    expect(p.intro).toBe("Waterfront villas.");
    // The ratio, not the plan's whole English name.
    expect(p.paymentPlan).toBe("50/50");
    expect(p.handover).toEqual({ q: 3, year: 2030 });
  });

  it("keeps the facts in the project page's order, and only the known ones", () => {
    const p = adapt.projectFactsProps(
      values("project_facts", { development: "yas-riva" }),
      data(
        project({
          facts: {
            tenure: "Freehold",
            architecture: "SOM",
            // Not a fact this site labels — never rendered unlabelled.
            ...({ stray: "x" } as object),
          },
        }),
      ),
    )!;
    expect(p.facts).toEqual([
      { key: "architecture", value: "SOM" },
      { key: "tenure", value: "Freehold" },
    ]);
  });

  it("answers null when the pick is blank or no longer published", () => {
    expect(
      adapt.projectFactsProps(values("project_facts"), data(project())),
    ).toBeNull();
    expect(
      adapt.projectFactsProps(
        values("project_facts", { development: "gone" }),
        data(project()),
      ),
    ).toBeNull();
  });
});

describe("the payment-plan calculator", () => {
  it("prices the units on sale when there are any", () => {
    const units = adapt.calculatorUnitsFor(
      project({
        units: [
          { id: "u1", unitType: "Villa", beds: 4, builtUpFt2: 5000, priceAed: 8_000_000 },
          { id: "u2", unitType: "Villa", beds: 5, builtUpFt2: 6000, priceAed: null },
        ],
      }),
    );
    expect(units.map((u) => [u.id, u.price_aed, u.isStartingPrice])).toEqual([
      ["u1", 8_000_000, false],
      // A unit with no price is priced at the floor rather than at zero.
      ["u2", 7_900_000, false],
    ]);
  });

  it("stands the starting price in for a project with no inventory", () => {
    expect(adapt.calculatorUnitsFor(project())).toEqual([
      expect.objectContaining({ id: "starting-price", isStartingPrice: true }),
    ]);
    expect(adapt.calculatorUnitsFor(project({ startingPrice: null }))).toEqual([]);
  });
});

/**
 * One fact, read twice. `projectFeaturesOf` feeds the editor's advisory note;
 * each adapter decides whether the section renders. If they disagree, the
 * editor either warns about a section that shows, or stays quiet about one
 * that doesn't.
 */
describe("the editor's advisory note and the section agree", () => {
  const cases: [string, ProjectFeature, Partial<LandingProject>][] = [
    ["project_payment_plan", "payment_plan", { paymentPlan: null }],
    ["project_master_plan", "master_plan", { masterplan: null }],
    ["project_unit_plans", "unit_types", { unitTypes: [] }],
    ["project_location", "location", { coords: null }],
  ];
  const render: Record<string, (v: SectionValues, d: LandingData) => unknown> = {
    project_payment_plan: adapt.projectPaymentPlanProps,
    project_master_plan: adapt.projectMasterPlanProps,
    project_unit_plans: adapt.projectUnitPlansProps,
    project_location: adapt.projectLocationProps,
  };

  for (const [key, feature, without] of cases) {
    it(`${key} ↔ ${feature}`, () => {
      const def = getBlockDef(key)!;
      expect(def.pickRequired?.requires).toBe(feature);
      const v = values(key, { development: "yas-riva" });

      const full = project();
      expect(projectFeaturesOf(full)).toContain(feature);
      expect(render[key]!(v, data(full))).not.toBeNull();
      expect(
        blockCatalogueGap(def, v, { "yas-riva": projectFeaturesOf(full) }),
      ).toBeNull();

      const lacking = project(without);
      expect(projectFeaturesOf(lacking)).not.toContain(feature);
      expect(render[key]!(v, data(lacking))).toBeNull();
      expect(
        blockCatalogueGap(def, v, { "yas-riva": projectFeaturesOf(lacking) }),
      ).not.toBeNull();
    });
  }

  it("keeps the project's own layout gate", () => {
    const p = adapt.projectUnitPlansProps(
      values("project_unit_plans", { development: "yas-riva" }),
      data(project()),
    )!;
    expect(p.gated).toBe(true);
  });

  it("names the site plan after the project when it has no alt text", () => {
    const p = adapt.projectMasterPlanProps(
      values("project_master_plan", { development: "yas-riva" }),
      data(project()),
    )!;
    expect(p.image.alt).toBe("Yas Riva Reserve · Master Plan");
  });
});

describe("advisor card", () => {
  const mariam = {
    user_id: "u-1",
    slug: "mariam",
    display_name: "Mariam Haddad",
    title: "Senior advisor",
    brn: null,
    photo_url: null,
    bio: null,
    email: null,
    phone: "+971 50 000 0000",
    whatsapp: "+971500000000",
  } as unknown as AgentProfile;
  const withMariam = data(null, {
    advisorsBySlug: new Map([["mariam", mariam]]),
  });

  it("fills the advisor's name into the copy", () => {
    const p = adapt.advisorProps(values("advisor", { agent: "mariam" }), withMariam)!;
    expect(p.callLabel).toBe("Call Mariam");
    expect(p.visitMessage).toBe("Hi Mariam, I'd like to know more.");
    expect(p.agent.display_name).toBe("Mariam Haddad");
  });

  it("isolates the name inside Arabic copy, but never inside the message", () => {
    const p = adapt.advisorProps(
      values("advisor", {
        agent: "mariam",
        call_label: "اتصل بـ{advisor_first}",
        visit_message: "مرحباً {advisor_first}",
      }),
      withMariam,
    )!;
    expect(p.callLabel).toBe(`اتصل بـ${FSI}Mariam${PDI}`);
    // Invisible on a page, percent-encoded noise in the WhatsApp draft.
    expect(p.visitMessage).toBe("مرحباً Mariam");
  });

  it("keeps a blank label blank rather than letting English back in", () => {
    const p = adapt.advisorProps(
      values("advisor", { agent: "mariam", eyebrow: null }),
      withMariam,
    )!;
    expect(p.eyebrow).toBe("");
  });

  it("drops the card for an advisor no longer on the roster", () => {
    expect(
      adapt.advisorProps(values("advisor", { agent: "left-the-team" }), withMariam),
    ).toBeNull();
    expect(adapt.advisorProps(values("advisor"), withMariam)).toBeNull();
  });
});

describe("the new content blocks", () => {
  const photo = (url: string | null) => ({
    image: { media_id: url ? "m" : null, alt: "A photo", label: null, url },
    caption: "",
  });

  it("drops photo rows with no picture, and a second set with no first", () => {
    const one = adapt.galleryProps({
      ...values("gallery"),
      first_images: [photo("https://example.test/a.jpg"), photo(null)],
      second_images: [photo("https://example.test/b.jpg")],
    });
    expect(one.interior).toHaveLength(1);
    expect(one.exterior).toHaveLength(1);

    const orphan = adapt.galleryProps({
      ...values("gallery"),
      first_images: [photo(null)],
      second_images: [photo("https://example.test/b.jpg")],
    });
    expect(orphan.interior).toEqual([]);
    expect(orphan.exterior).toEqual([]);
  });

  it("ships the value grid with the consultation page's own cards", () => {
    const p = adapt.valueGridProps(values("value_grid"));
    expect(p.cols).toBe(4);
    expect(p.items.map((i) => i.name)).toEqual([
      "First-Time Buyers",
      "Homebuyers",
      "Property Investors",
      "Property Owners",
    ]);
  });

  it("keeps the calculator's own copy when a field is blanked", () => {
    const p = adapt.mortgageCalculatorProps({ eyebrow: null, heading: null });
    // undefined, so the component's destructuring defaults apply.
    expect(p).toEqual({ eyebrow: undefined, heading: undefined });
  });

  it("hands the partner band the shared list, or nothing to fall back from", () => {
    expect(adapt.partnersProps(values("partners"), EMPTY_LANDING_DATA).partners)
      .toBeUndefined();
  });
});
