import { describe, expect, it } from "vitest";
import { evaluateLandingPublishability } from "./publishability";
import { resolveDocument } from "./document";
import { newBlockInstance } from "./catalogue";
import { heroMedia } from "./blocks/openers";
import { faq } from "./blocks/content";
import { ctaBand, formBand } from "./blocks/conversion";
import { featuredProperties } from "./blocks/listings";
import type { BlockDef } from "./types";
import type { SectionValues } from "@/lib/master-pages";

const FORMS = ["contact_enquiry", "buy_lead_band"] as const;

function make(def: BlockDef, values: SectionValues = {}) {
  const instance = newBlockInstance(def);
  return { ...instance, values: { ...instance.values, ...values } };
}

function evaluate(
  blocks: ReturnType<typeof make>[],
  over: Partial<Parameters<typeof evaluateLandingPublishability>[0]> = {},
) {
  return evaluateLandingPublishability({
    title: "Spring launch",
    slug: "spring-launch",
    metaDescription: "A campaign page.",
    noindex: false,
    blocks: resolveDocument(blocks),
    knownFormKeys: FORMS,
    enabledFormKeys: FORMS,
    ...over,
  });
}

/** A minimal page that ought to pass every blocker. */
function validPage() {
  return [
    make(heroMedia, { title: "Saadiyat Lagoons" }),
    make(faq, { items: [{ q: "When?", a: "Q4." }] }),
  ];
}

function has(blockers: string[], fragment: string) {
  return blockers.some((b) => b.includes(fragment));
}

describe("evaluateLandingPublishability", () => {
  it("passes a minimal, complete page", () => {
    const result = evaluate(validPage());
    expect(result.blockers).toEqual([]);
    expect(result.ok).toBe(true);
  });

  /**
   * The regression this check was added for: a page published with four
   * sections and two of them missing from the live URL, because both lists
   * were empty and an empty list renders nothing at all.
   */
  it("blocks a page whose section would render nothing", () => {
    const result = evaluate([
      make(heroMedia, { title: "Saadiyat Lagoons" }),
      make(faq, { items: [] }),
    ]);
    expect(result.ok).toBe(false);
    expect(has(result.blockers, "FAQ has nothing in it")).toBe(true);
    expect(
      result.checks.find((c) => c.label === "Every section has something to show")
        ?.passed,
    ).toBe(false);
  });

  it("ignores an empty section that is switched off", () => {
    const result = evaluate([
      make(heroMedia, { title: "Saadiyat Lagoons" }),
      make(faq, { items: [{ q: "When?", a: "Q4." }] }),
      { ...make(faq, { items: [] }), enabled: false },
    ]);
    expect(result.ok).toBe(true);
  });

  it("blocks a page with no title", () => {
    const result = evaluate(validPage(), { title: "  " });
    expect(result.ok).toBe(false);
    expect(has(result.blockers, "title")).toBe(true);
    expect(result.checks.find((c) => c.label === "Title is set")?.passed).toBe(false);
  });

  it("blocks a slug with a slash — /lp/[slug] is one path segment", () => {
    const result = evaluate(validPage(), { slug: "spring/launch" });
    expect(result.ok).toBe(false);
    expect(has(result.blockers, "no slashes")).toBe(true);
  });

  it("blocks a reserved slug", () => {
    const result = evaluate(validPage(), { slug: "preview" });
    expect(result.ok).toBe(false);
    expect(has(result.blockers, "reserved")).toBe(true);
  });

  it("blocks an empty page", () => {
    const result = evaluate([]);
    expect(result.ok).toBe(false);
    expect(has(result.blockers, "Add a section")).toBe(true);
  });

  it("blocks a page holding a section this build can't render", () => {
    const blocks = [
      ...validPage(),
      { id: "u", type: "market_stats_strip", v: 1, enabled: true, values: {} },
    ];
    const result = evaluate(blocks);
    expect(result.ok).toBe(false);
    expect(has(result.blockers, "market_stats_strip")).toBe(true);
  });

  it("blocks a blank required field and names the block", () => {
    const result = evaluate([
      make(heroMedia, { title: "Hero" }),
      make(ctaBand, { title: "" }),
    ]);
    expect(result.ok).toBe(false);
    expect(has(result.blockers, "Call to action · Heading")).toBe(true);
  });

  it("blocks zero H1 sections", () => {
    const result = evaluate([make(faq, { items: [{ q: "Q", a: "A" }] })]);
    expect(result.ok).toBe(false);
    expect(has(result.blockers, "carries the main heading")).toBe(true);
  });

  it("blocks two H1 sections", () => {
    const result = evaluate([
      make(heroMedia, { title: "One" }),
      { ...make(heroMedia, { title: "Two" }), id: "hero-2" },
    ]);
    expect(result.ok).toBe(false);
    expect(has(result.blockers, "Keep one")).toBe(true);
  });

  it("blocks a picked photo with no alt text", () => {
    const result = evaluate([
      make(heroMedia, {
        title: "Hero",
        image: { media_id: "abc", alt: null, label: "hero" },
      }),
    ]);
    expect(result.ok).toBe(false);
    expect(has(result.blockers, "alt text")).toBe(true);
  });

  it("ignores alt text on a placeholder — no asset, nothing to describe", () => {
    const result = evaluate([
      make(heroMedia, {
        title: "Hero",
        image: { media_id: null, alt: null, label: "hero" },
      }),
    ]);
    expect(has(result.blockers, "alt text")).toBe(false);
  });

  it("blocks a form that is switched off in the Forms Manager", () => {
    const result = evaluate(
      [
        make(heroMedia, { title: "Hero" }),
        make(formBand, { form_key: "buy_lead_band" }),
      ],
      { enabledFormKeys: ["contact_enquiry"] },
    );
    expect(result.ok).toBe(false);
    expect(has(result.blockers, "buy_lead_band")).toBe(true);
  });

  it("blocks a link that points nowhere resolvable", () => {
    const result = evaluate([
      make(heroMedia, { title: "Hero" }),
      make(ctaBand, { title: "Go", cta_label: "Go", cta_href: "contact" }),
    ]);
    expect(result.ok).toBe(false);
    expect(has(result.blockers, "Fix 1 link")).toBe(true);
  });

  it("accepts absolute, relative, mailto and tel links", () => {
    for (const href of ["/contact", "https://x.ae", "mailto:a@b.ae", "tel:+9715"]) {
      const result = evaluate([
        make(heroMedia, { title: "Hero" }),
        make(ctaBand, { title: "Go", cta_label: "Go", cta_href: href }),
      ]);
      expect(has(result.blockers, "Fix"), href).toBe(false);
    }
  });

  it("blocks a page over the query budget and names the number", () => {
    const rails = Array.from({ length: 7 }, (_, i) => ({
      ...make(featuredProperties, { title: `Rail ${i}` }),
      id: `rail-${i}`,
    }));
    const result = evaluate([make(heroMedia, { title: "Hero" }), ...rails]);
    expect(result.ok).toBe(false);
    expect(has(result.blockers, "7 catalogue queries")).toBe(true);
  });

  it("allows a page at exactly the budget", () => {
    const rails = Array.from({ length: 6 }, (_, i) => ({
      ...make(featuredProperties, { title: `Rail ${i}` }),
      id: `rail-${i}`,
    }));
    const result = evaluate([make(heroMedia, { title: "Hero" }), ...rails]);
    expect(has(result.blockers, "catalogue queries")).toBe(false);
  });

  it("never blocks on a missing hero photo", () => {
    // lib/publishability.ts records why: the property gate dropped its own hero
    // requirement because it blocked listings that were otherwise ready.
    const result = evaluate(validPage());
    expect(result.ok).toBe(true);
    expect(
      result.checks.find((c) => c.label === "Opens with a hero section")?.passed,
    ).toBe(true);
  });

  it("treats search visibility as decided when noindex is on", () => {
    const result = evaluate(validPage(), {
      metaDescription: null,
      noindex: true,
    });
    expect(result.ok).toBe(true);
    expect(
      result.checks.find((c) => c.label === "Search visibility is decided")?.passed,
    ).toBe(true);
  });

  it("flags an undecided search visibility without blocking", () => {
    const result = evaluate(validPage(), {
      metaDescription: null,
      noindex: false,
    });
    expect(result.ok).toBe(true);
    expect(
      result.checks.find((c) => c.label === "Search visibility is decided")?.passed,
    ).toBe(false);
  });

  it("ignores hidden sections entirely", () => {
    const blocks = validPage();
    const broken = { ...make(ctaBand, { title: "" }), enabled: false };
    const result = evaluate([...blocks, broken]);
    expect(result.ok).toBe(true);
  });
});
