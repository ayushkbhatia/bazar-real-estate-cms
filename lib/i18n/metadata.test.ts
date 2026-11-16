import { describe, expect, it } from "vitest";
import { localeAlternates, sitemapAlternates } from "./metadata";

/** Path part of an absolute URL, so the assertions hold for any SITE_URL. */
const pathOf = (url: string | URL | null | undefined) => {
  const u = new URL(String(url));
  return u.pathname;
};

describe("localeAlternates", () => {
  it("is self-canonical on /ar, not a pointer to the English page", () => {
    const ar = localeAlternates("/buy", "ar");
    expect(pathOf(ar.canonical)).toBe("/ar/buy");
  });

  it("is self-canonical on English, with no locale segment", () => {
    const en = localeAlternates("/buy", "en");
    expect(pathOf(en.canonical)).toBe("/buy");
  });

  it("names both translations and x-default the same way from either side", () => {
    const en = localeAlternates("/areas/al-reem-island", "en");
    const ar = localeAlternates("/areas/al-reem-island", "ar");
    expect(en.languages).toEqual(ar.languages);
    expect(Object.keys(en.languages).sort()).toEqual(
      ["ar-AE", "en-AE", "x-default"].sort(),
    );
    expect(pathOf(en.languages["en-AE"])).toBe("/areas/al-reem-island");
    expect(pathOf(en.languages["ar-AE"])).toBe("/ar/areas/al-reem-island");
    expect(pathOf(en.languages["x-default"])).toBe("/areas/al-reem-island");
  });

  it("handles the home page: /ar, not /ar/", () => {
    const ar = localeAlternates("/", "ar");
    expect(pathOf(ar.canonical)).toBe("/ar");
    expect(pathOf(ar.languages["en-AE"])).toBe("/");
  });

  it("is absolute, so a relative path can never resolve against the wrong locale", () => {
    const ar = localeAlternates("/contact", "ar");
    expect(String(ar.canonical)).toMatch(/^https?:\/\//);
    for (const href of Object.values(ar.languages)) {
      expect(href).toMatch(/^https?:\/\//);
    }
  });

  it("agrees with the sitemap's hreflang set", () => {
    const page = localeAlternates("/guides/golden-visa", "ar").languages;
    const map = sitemapAlternates("/guides/golden-visa").languages;
    for (const [tag, href] of Object.entries(map)) {
      expect(page[tag]).toBe(href);
    }
  });
});
