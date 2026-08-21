/**
 * @vitest-environment node
 */
import { describe, it, expect, vi } from "vitest";

/**
 * What an editor saves is what the search page renders — in both languages.
 *
 * `getSearchHeaderCopy` is the choke point and it is not pure: it picks the
 * document from the `(mode, form)` pair, reads it, folds it to the request
 * locale, and applies the one piece of behaviour that is not `resolveSections`
 * — a cleared title falls back to the shipped headline while a cleared eyebrow
 * or sub-title is honoured. So this runs the real loader against a stubbed
 * storage read rather than asserting on the fold alone.
 *
 * The fallback is the assertion that earns its place. Reading the registry's
 * English default there — the obvious way to write it — puts an English
 * headline on `/ar` the one time an editor blanks the field, which is exactly
 * the hole the six search routes had before this copy left `messages/`.
 */

/** Documents by slug. A slug missing here reads as "never saved". */
const DOCS: Record<string, unknown> = {
  "subpage/search/buy": [
    {
      key: "header",
      enabled: true,
      values: {
        eyebrow: "Freehold and leasehold",
        eyebrow_ar: "تملك حر وحق انتفاع",
        title: "Homes worth keeping",
        title_ar: "منازل تستحق الاقتناء",
        subtitle: "Every listing an advisor has stood inside.",
        subtitle_ar: "كل عقار وقف بداخله أحد مستشارينا.",
        meta_title: "Homes worth keeping",
        meta_title_ar: "منازل تستحق الاقتناء",
        meta_description: "Every listing an advisor has stood inside.",
        meta_description_ar: "كل عقار وقف بداخله أحد مستشارينا.",
      },
    },
  ],
  // An editor who cleared the two optional lines, and the title with them.
  "subpage/search/resale": [
    {
      key: "header",
      enabled: true,
      values: {
        eyebrow: "",
        eyebrow_ar: "",
        title: "",
        title_ar: "",
        subtitle: "",
        subtitle_ar: "",
        meta_title: "",
        meta_title_ar: "",
        meta_description: "",
        meta_description_ar: "",
      },
    },
  ],
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true, env: {} }));
vi.mock("@/lib/i18n/current", () => ({ currentLocale: async () => "en" }));
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({
    from: () => {
      let slug = "";
      const q = {
        select: () => q,
        eq: (_column: string, value: string) => {
          slug = value;
          return q;
        },
        maybeSingle: async () => ({
          data: slug in DOCS ? { blocks: DOCS[slug] } : null,
          error: null,
        }),
      };
      return q;
    },
  }),
}));

import { getSearchHeaderCopy, getSearchHeaderMeta } from "./search-headers";
import { getSearchHeader } from "@/lib/master-pages/search-headers";

describe("a saved header reaches the page", () => {
  it("renders the editor's English on /en", async () => {
    expect(await getSearchHeaderCopy("buy", null, "en")).toEqual({
      eyebrow: "Freehold and leasehold",
      title: "Homes worth keeping",
      subtitle: "Every listing an advisor has stood inside.",
    });
  });

  it("renders the editor's Arabic on /ar", async () => {
    expect(await getSearchHeaderCopy("buy", null, "ar")).toEqual({
      eyebrow: "تملك حر وحق انتفاع",
      title: "منازل تستحق الاقتناء",
      subtitle: "كل عقار وقف بداخله أحد مستشارينا.",
    });
  });

  it("leaves a facet nobody has saved on its shipped copy", async () => {
    const shipped = getSearchHeader("rent")!.section.defaults;
    expect(await getSearchHeaderCopy("rent", null, "en")).toEqual({
      eyebrow: shipped.eyebrow,
      title: shipped.title,
      subtitle: shipped.subtitle,
    });
  });

  it("does not let the buy document leak onto the form facets", async () => {
    // Each facet is its own document precisely so /buy/ready and /buy/resale
    // cannot share a headline with the umbrella or with each other.
    const ready = getSearchHeader("ready-new")!.section.defaults;
    expect((await getSearchHeaderCopy("buy", "ready_new", "en")).title).toBe(
      ready.title,
    );
  });
});

describe("a cleared field", () => {
  it("drops the eyebrow and sub-title — blanking one is a choice", async () => {
    const copy = await getSearchHeaderCopy("buy", "resale", "en");
    expect(copy.eyebrow).toBeNull();
    expect(copy.subtitle).toBeNull();
  });

  it("puts the shipped headline back rather than an empty h1", async () => {
    const shipped = getSearchHeader("resale")!.section.defaults;
    expect((await getSearchHeaderCopy("buy", "resale", "en")).title).toBe(
      shipped.title,
    );
  });

  it("puts back the ARABIC headline on /ar, not the English one", async () => {
    const shipped = getSearchHeader("resale")!.section.defaults;
    expect((await getSearchHeaderCopy("buy", "resale", "ar")).title).toBe(
      shipped.title_ar,
    );
  });
});

describe("the search-engine snippet", () => {
  it("publishes the editor's snippet on /en", async () => {
    expect(await getSearchHeaderMeta("buy", null, "en")).toEqual({
      title: "Homes worth keeping",
      description: "Every listing an advisor has stood inside.",
    });
  });

  it("publishes it in Arabic on /ar", async () => {
    expect(await getSearchHeaderMeta("buy", null, "ar")).toEqual({
      title: "منازل تستحق الاقتناء",
      description: "كل عقار وقف بداخله أحد مستشارينا.",
    });
  });

  it("gives an unsaved facet its shipped Arabic snippet, not English", async () => {
    // The whole point of this change: before it, all six routes declared an
    // English literal and published it on `/ar` too.
    const shipped = getSearchHeader("off-plan")!.section.defaults;
    expect(await getSearchHeaderMeta("off_plan", null, "ar")).toEqual({
      title: shipped.meta_title_ar,
      description: shipped.meta_description_ar,
    });
  });

  it("gives the buy off-plan facet its own snippet, not the umbrella's", async () => {
    const shipped = getSearchHeader("off-plan-sale")!.section.defaults;
    // `buy` IS saved in this fixture, so a facet that fell through to the
    // umbrella document would return "Homes worth keeping" here.
    expect((await getSearchHeaderMeta("buy", "off_plan", "en")).title).toBe(
      shipped.meta_title,
    );
  });

  it("puts the shipped snippet back when an editor clears it", async () => {
    const shipped = getSearchHeader("resale")!.section.defaults;
    expect(await getSearchHeaderMeta("buy", "resale", "ar")).toEqual({
      title: shipped.meta_title_ar,
      description: shipped.meta_description_ar,
    });
  });
});
