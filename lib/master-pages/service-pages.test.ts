import { describe, it, expect } from "vitest";
import { getMasterPage, resolveSections, type MasterPageDef } from "./index";
import {
  PROPERTY_MANAGEMENT_PAGE,
  SERVICE_FORM_ANCHOR,
} from "./sections/property-management";
import {
  CONSULTATION_INTENTS,
  PROPERTY_CONSULTATION_PAGE,
} from "./sections/property-consultation";

const manage = getMasterPage("manage") as MasterPageDef;
const consultation = getMasterPage("consultation") as MasterPageDef;

type Card = { enabled?: boolean; name?: string; desc?: string; href?: string };

const cards = (page: MasterPageDef, key: string): Card[] =>
  (page.sections.find((s) => s.key === key)?.defaults.items ?? []) as Card[];

describe("service master pages", () => {
  it("registers both landings under their public paths", () => {
    expect(manage).toBe(PROPERTY_MANAGEMENT_PAGE);
    expect(consultation).toBe(PROPERTY_CONSULTATION_PAGE);
    expect(manage.path).toBe("/services/manage");
    expect(consultation.path).toBe("/services/consultation");
  });

  it("locks the hero and the lead form on both", () => {
    // The closing CTA links to `#lead-form`, which only resolves because the
    // hero is always rendered and always first.
    for (const page of [manage, consultation]) {
      const [first, second] = page.sections;
      expect(first!.key).toBe("hero");
      expect(first!.locked).toBe(true);
      expect(second!.key).toBe("hero_form");
      expect(second!.locked).toBe(true);
    }
  });

  it("defaults both closing CTAs to the form anchor", () => {
    for (const page of [manage, consultation]) {
      const cta = page.sections.find((s) => s.key === "final_cta");
      expect(cta?.defaults.cta_href).toBe(`#${SERVICE_FORM_ANCHOR}`);
      expect(cta?.defaults.cta_label).toBeTruthy();
    }
  });

  it("ships the content document's copy as defaults", () => {
    const hero = manage.sections.find((s) => s.key === "hero");
    expect(hero?.defaults.title).toBe("Property Management in Abu Dhabi");

    const form = manage.sections.find((s) => s.key === "hero_form");
    expect(form?.defaults.form_title).toBe("Let Us Manage Your Property");
    expect(form?.defaults.submit_label).toBe(
      "Request Property Management Support",
    );

    expect(cards(manage, "support").map((c) => c.name)).toEqual([
      "Tenant Management",
      "Rent Collection",
      "Lease Administration",
      "Maintenance Coordination",
      "Property Inspections",
      "Move-In & Move-Out Support",
    ]);
    expect(cards(manage, "care").map((c) => c.name)).toEqual([
      "Property Care",
      "Tenant Support",
      "Clear Administration",
      "Dedicated Support",
    ]);

    const steps = manage.sections.find((s) => s.key === "how_it_works")
      ?.defaults.steps as { title?: string }[];
    expect(steps.map((s) => s.title)).toEqual([
      "Share Your Property Details",
      "Property Review",
      "Management Begins",
    ]);

    expect(cards(consultation, "covers")).toHaveLength(6);
    expect(cards(consultation, "who").map((c) => c.name)).toEqual([
      "First-Time Buyers",
      "Homebuyers",
      "Property Investors",
      "Property Owners",
    ]);
  });

  it("points every consultation tile at a route that exists", () => {
    expect(cards(consultation, "help").map((c) => c.href)).toEqual([
      "/buy",
      "/services/sell",
      "/off-plan",
      "/buy/ready",
      "/buy/resale",
    ]);
  });

  it("gives the two consultation tiles distinct copy", () => {
    // The content document repeats the Ready Properties description on the
    // Resale tile. Two adjacent cards with identical text read as a bug, so
    // the defaults differ — see the module header.
    const help = cards(consultation, "help");
    const descriptions = help.map((c) => c.desc);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("tags every interest option with a known intent", () => {
    const options = consultation.sections.find((s) => s.key === "hero_form")
      ?.defaults.options as { label?: string; intent?: string }[];
    expect(options.map((o) => o.label)).toEqual([
      "Buying",
      "Selling",
      "Investing",
    ]);
    for (const option of options) {
      expect(CONSULTATION_INTENTS).toContain(option.intent);
    }
  });

  it("renders every default when nothing has been stored", () => {
    for (const page of [manage, consultation]) {
      const resolved = resolveSections(page, null);
      expect(resolved.map((s) => s.key)).toEqual(
        page.sections.map((s) => s.key),
      );
      expect(resolved.every((s) => s.enabled)).toBe(true);
    }
  });

  it("keeps a stored arrangement and still surfaces a section added later", () => {
    // An editor who has hidden "Who it is for" and moved the CTA up keeps both
    // choices; a section the stored document predates lands at the end, on.
    const resolved = resolveSections(consultation, [
      { key: "final_cta", enabled: true, values: {} },
      { key: "who", enabled: false, values: {} },
      { key: "hero", enabled: true, values: {} },
    ]);
    expect(resolved.slice(0, 3).map((s) => s.key)).toEqual([
      "final_cta",
      "who",
      "hero",
    ]);
    expect(resolved.find((s) => s.key === "who")?.enabled).toBe(false);
    expect(resolved.find((s) => s.key === "help")?.enabled).toBe(true);
  });
});
