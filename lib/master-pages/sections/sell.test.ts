import { describe, expect, it } from "vitest";
import { faqPairs, getMasterPage, list, resolveSections, str } from "../index";
import type { ImageValue, MasterPageDef } from "../types";
import { SELL_ADVISOR_TOKEN, SELL_WHEN_TOKEN } from "./sell";

/**
 * /services/sell — "List your property".
 *
 * The generic registry invariants (unique section keys, every non-optional
 * field has a default) are asserted for all master pages in
 * ../master-pages.test.ts. This file covers what is specific to this page: the
 * compliance-sensitive FAQ, the motif keywords the pricing cards hand to the
 * component, and the placeholders the confirmation copy relies on.
 */
const sell = getMasterPage("sell") as MasterPageDef;
const resolved = resolveSections(sell, null);
const values = (key: string) =>
  resolved.find((s) => s.key === key)?.values ?? {};

describe("sell master page", () => {
  it("registers at the public path", () => {
    expect(sell).not.toBeNull();
    expect(sell.path).toBe("/services/sell");
  });

  it("locks the hero, the form and its confirmation", () => {
    // The form *is* the page. Hiding it, or the screen an owner sees after
    // submitting, would leave a landing page with no way to enquire.
    for (const key of ["hero", "form", "confirmation"]) {
      const section = sell.sections.find((s) => s.key === key);
      expect(section?.locked, `${key} is not locked`).toBe(true);
    }
  });

  it("renders every section by default, in declaration order", () => {
    expect(resolved.map((s) => s.key)).toEqual(sell.sections.map((s) => s.key));
    expect(resolved.every((s) => s.enabled)).toBe(true);
  });

  it("leaves the hero stat rail empty so it keeps counting live rows", () => {
    // A typed figure here would go stale silently; the page falls back to the
    // live counts whenever this list is empty.
    expect(list(values("hero"), "stats")).toEqual([]);
  });

  it("keeps the compliance-signed FAQ copy as the default", () => {
    const items = faqPairs(values("faq"));
    expect(items.length).toBe(6);
    const answers = items.map(([, a]) => a).join(" ");
    // The figures the design handoff flags for sign-off. They are editable
    // now, but the shipped defaults must still be the reviewed ones.
    expect(answers).toContain("2% transfer fee");
    expect(answers).toContain("AED 500 to 5,000");
    expect(answers).toContain("twelve months' written notice");
  });

  it("splits the FAQ phone line either side of the number", () => {
    // The number itself comes from Settings → Brand so the tap-to-call link
    // and the visible text cannot drift apart.
    const faq = values("faq");
    expect(str(faq, "phone_intro")).toBeTruthy();
    expect(str(faq, "phone_outro")).toBeTruthy();
    expect(`${str(faq, "phone_intro")} ${str(faq, "phone_outro")}`).not.toMatch(
      /\+?\d{3}/,
    );
  });

  it("names a motif the pricing component can draw on every card", () => {
    const cards = list<{ visual?: string; image?: ImageValue }>(
      values("pricing"),
      "cards",
    );
    expect(cards.length).toBe(3);
    // The keywords PricingResources switches on. A card may also carry an
    // image, which replaces the motif — none do by default.
    expect(cards.map((c) => c.visual)).toEqual([
      "range",
      "transactions",
      "guides",
    ]);
    expect(cards.every((c) => c.image?.media_id === null)).toBe(true);
  });

  it("carries the placeholders the confirmation screen fills in", () => {
    const confirmation = values("confirmation");
    // The advisor and the call window are only known after routing, so they
    // are tokens rather than text an editor could type.
    expect(str(confirmation, "heading_matched")).toContain(SELL_ADVISOR_TOKEN);
    expect(str(confirmation, "heading_matched")).toContain(SELL_WHEN_TOKEN);
    expect(str(confirmation, "heading_desk")).toContain(SELL_WHEN_TOKEN);
    expect(str(confirmation, "heading_desk")).not.toContain(
      SELL_ADVISOR_TOKEN,
    );

    const steps = list<{ what?: string }>(confirmation, "steps");
    expect(steps.length).toBe(3);
    expect(steps[0]?.what).toContain(SELL_ADVISOR_TOKEN);
  });
});
