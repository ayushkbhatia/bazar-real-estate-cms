import { describe, it, expect } from "vitest";
import { filterParsers } from "./property";
import { FILTER_PARAM_KEYS } from "./property-keys";
import { categoryToUrlSlug } from "@/lib/schemas/article";
import {
  legacyQueryRedirect,
  searchRedirectTarget,
  insightsCategoryRedirect,
} from "./search-redirect";

const qs = (s: string) => new URLSearchParams(s);

describe("FILTER_PARAM_KEYS", () => {
  it("stays in sync with filterParsers", () => {
    // The proxy imports the plain list to keep nuqs out of the middleware
    // bundle; this is what stops the two drifting apart.
    expect([...FILTER_PARAM_KEYS].sort()).toEqual(
      Object.keys(filterParsers).sort(),
    );
  });
});

describe("searchRedirectTarget", () => {
  it("sends a filter deep-link to the search sub-route, params intact", () => {
    expect(searchRedirectTarget("/buy", qs("type=apartment&beds=2"))).toBe(
      "/buy/search?type=apartment&beds=2",
    );
  });

  it("treats the view toggle as a search signal", () => {
    expect(searchRedirectTarget("/rent", qs("view=map"))).toBe(
      "/rent/search?view=map",
    );
  });

  it("leaves campaign params on the marketing page", () => {
    expect(
      searchRedirectTarget("/buy", qs("utm_source=ig&utm_campaign=spring")),
    ).toBeNull();
    expect(searchRedirectTarget("/buy", qs("ref=partner"))).toBeNull();
  });

  it("leaves a bare landing alone", () => {
    expect(searchRedirectTarget("/off-plan", qs(""))).toBeNull();
  });

  it("redirects when a filter rides alongside campaign params", () => {
    const target = searchRedirectTarget("/buy", qs("utm_source=ig&beds=3"));
    expect(target).toBe("/buy/search?utm_source=ig&beds=3");
  });
});

describe("insightsCategoryRedirect", () => {
  it("sends ?category= to the canonical archive route", () => {
    expect(insightsCategoryRedirect("/insights", qs("category=market"))).toBe(
      "/insights/category/market",
    );
  });

  it("hyphenates underscored category slugs the way the archive expects", () => {
    const slug = "off_plan_watch";
    expect(insightsCategoryRedirect("/insights", qs(`category=${slug}`))).toBe(
      `/insights/category/${categoryToUrlSlug(slug)}`,
    );
  });

  it("ignores other paths and the bare index", () => {
    expect(insightsCategoryRedirect("/insights", qs(""))).toBeNull();
    expect(
      insightsCategoryRedirect("/insights/some-article", qs("category=market")),
    ).toBeNull();
  });
});

describe("legacyQueryRedirect", () => {
  it("routes each landing to its own search sub-route", () => {
    expect(legacyQueryRedirect("/buy", qs("beds=2"))).toBe("/buy/search?beds=2");
    expect(legacyQueryRedirect("/rent", qs("beds=2"))).toBe(
      "/rent/search?beds=2",
    );
    expect(legacyQueryRedirect("/off-plan", qs("beds=2"))).toBe(
      "/off-plan/search?beds=2",
    );
  });

  it("does not touch the search routes themselves", () => {
    // Otherwise /buy/search?beds=2 would redirect to itself forever.
    expect(legacyQueryRedirect("/buy/search", qs("beds=2"))).toBeNull();
  });

  it("passes through everything else untouched", () => {
    expect(legacyQueryRedirect("/", qs("beds=2"))).toBeNull();
    expect(legacyQueryRedirect("/commercial", qs("beds=2"))).toBeNull();
    expect(legacyQueryRedirect("/p/some-listing-baz-ad-01", qs(""))).toBeNull();
  });
});
