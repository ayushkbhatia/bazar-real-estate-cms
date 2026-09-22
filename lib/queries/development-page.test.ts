/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  developmentPageCopySlug,
  getDevelopmentPageCopy,
} from "./development-page";
import { SUBPAGE_SLUG_PREFIX, subPageSlug } from "@/lib/master-pages/subpages";
import { stripIsolates } from "@/lib/i18n/bidi";

/**
 * The resolution path no page on the live site can currently demonstrate.
 *
 * Every one of the 22 published projects carries its own copy document, so the
 * shared wording is never what renders today — it is what renders for project
 * 23. That makes this the only place the behaviour is observable, which is
 * exactly the kind of code that rots: it works when written, nobody looks at
 * it for a year, and the first person to see it fail is the client on the day
 * they add a project.
 *
 * Runs with no Supabase configured, which is the fallback branch — the
 * document read is skipped and `resolveSections(def, null, fold)` supplies the
 * defaults. That is the same values an unsaved document produces, so the
 * assertions hold for both.
 */
const TOKENS = {
  name: "Yas Point",
  area: "Yas Island",
  developer: "ALDAR Properties",
  plan: "60/40",
  available: 3,
  total: 12,
  advisor: "Bazar Real Estate",
  advisor_first: "Bazar",
};

describe("one project's shared wording", () => {
  it("substitutes the area into the overview heading", async () => {
    const copy = await getDevelopmentPageCopy(TOKENS, "en");
    // The line all 22 projects had typed out by hand, once each.
    expect(copy("overview", "heading")).toBe("A Community Within Yas Island");
    expect(copy("overview", "eyebrow")).toBe("Discover the Community");
  });

  it("puts the token where each language wants it", async () => {
    const en = await getDevelopmentPageCopy(TOKENS, "en");
    const ar = await getDevelopmentPageCopy(
      { ...TOKENS, area: "جزيرة ياس" },
      "ar",
    );
    // English closes on the name, Arabic opens with the preposition. This is
    // the pair concatenation cannot express, and the reason for `fillTokens`.
    expect(en("overview", "heading")).toMatch(/Yas Island$/);
    expect(ar("overview", "heading")).toBe("مجتمع متكامل في جزيرة ياس");
  });

  it("substitutes the two unit counts", async () => {
    const copy = await getDevelopmentPageCopy(TOKENS, "en");
    expect(copy("units", "eyebrow")).toBe(
      "Available units · 3 of 12 remaining",
    );
  });

  it("answers for every band the page asks about", async () => {
    const copy = await getDevelopmentPageCopy(TOKENS, "en");
    // A null here is a band the page would render unlabelled. The registry
    // guard in lib/master-pages/development-page.test.ts checks the reverse
    // direction — that the page reads nothing the registry lacks.
    for (const [section, field] of [
      ["hero", "brochure_label"],
      ["hero", "interest_label"],
      ["overview", "heading_no_area"],
      ["master-plan", "heading"],
      ["payment-plan", "eyebrow"],
      ["floor-plans", "heading"],
      ["renders", "interior_heading"],
      ["features", "eyebrow"],
      ["unit-plans", "intro"],
      ["location", "intro"],
      ["nearby", "intro"],
      ["developer", "heading"],
      ["other-projects", "eyebrow"],
      ["faq", "heading"],
      ["advisor", "heading"],
      ["advisor", "quote"],
      ["advisor", "call_label"],
      ["advisor", "visit_label"],
      ["advisor", "visit_message"],
    ] as const) {
      expect(copy(section, field), `${section}.${field}`).toBeTruthy();
    }
  });

  /*
   * The advisor band's three name-bearing strings.
   *
   * Worth their own test because the quote is the field that had no home at
   * all before this: it came from `SEED_AGENTS[0].pull_quote`, spread under
   * the real staff row by `getAdvisorForBanner`, so every project page
   * published a placeholder written for a different advisor — in English on
   * /ar too. A null or an English string here is that bug returning.
   */
  it("fills the advisor's name into the banner's buttons", async () => {
    const en = await getDevelopmentPageCopy(TOKENS, "en");
    expect(en("advisor", "call_label")).toBe("Call Bazar");
    expect(en("advisor", "visit_message")).toBe(
      "Hi Bazar, I'd like to book a site visit at Yas Point.",
    );
    // The quote the page shipped with, now editable rather than inherited
    // from a seed record.
    expect(en("advisor", "quote")).toMatch(/^We don't show twenty units/);
  });

  it("writes the advisor band in Arabic, with the name isolated", async () => {
    const ar = await getDevelopmentPageCopy(TOKENS, "ar");
    expect(ar("advisor", "visit_label")).toBe("احجز زيارة للموقع");
    expect(stripIsolates(ar("advisor", "call_label") ?? "")).toBe(
      "اتصل بـBazar",
    );
    // A Latin name dropped into an Arabic sentence must carry its own
    // direction, or the run reorders around the preposition before it.
    expect(ar("advisor", "call_label")).not.toBe("اتصل بـBazar");
    expect(ar("advisor", "quote")).toMatch(/^لا نعرض/);
  });

  it("returns null for a field it does not carry", async () => {
    // Not an empty string: the page distinguishes "no copy for this" from
    // "copy that happens to be blank", and only the first should drop an
    // element.
    const copy = await getDevelopmentPageCopy(TOKENS, "en");
    expect(copy("features", "intro")).toBeNull();
    expect(copy("nope", "eyebrow")).toBeNull();
  });

  it("stores outside the namespace one project's own document uses", () => {
    expect(developmentPageCopySlug().startsWith(SUBPAGE_SLUG_PREFIX)).toBe(true);
    // The collision that would clobber both documents, silently, in both
    // directions — a project may legitimately be slugged "copy".
    expect(developmentPageCopySlug()).not.toBe(subPageSlug("development", "copy"));
  });
});
