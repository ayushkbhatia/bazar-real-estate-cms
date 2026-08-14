import { describe, expect, it } from "vitest";
import {
  internalPath,
  localeFromPathname,
  stripLocalePrefix,
  withLocalePrefix,
} from "./routing";
import { DEFAULT_LOCALE, LOCALES } from "./locales";

/**
 * As-needed prefixing: English is served on the URLs it has always had, every
 * other locale carries its prefix, and the route tree lives under
 * `app/[locale]/` regardless.
 *
 * The subtle case these pin down is that only *served* locales count as
 * prefixes. While `LOCALES` is `["en"]`, `/ar/legal/privacy` is not a
 * locale-prefixed path — it is an ordinary path whose first segment happens to
 * read "ar", and it must keep resolving to the hand-authored Arabic page that
 * has lived at that URL since before any of this existed.
 */
describe("localeFromPathname", () => {
  it("returns null for unprefixed paths", () => {
    expect(localeFromPathname("/")).toBeNull();
    expect(localeFromPathname("/buy")).toBeNull();
    expect(localeFromPathname("/buy/search")).toBeNull();
  });

  it("does not mistake a same-named path segment for a locale", () => {
    // "areas" starts with "ar"; "en" appears inside "enquiries".
    expect(localeFromPathname("/areas/saadiyat-island")).toBeNull();
    expect(localeFromPathname("/enquiries")).toBeNull();
  });

  it("only recognises locales that are actually served", () => {
    // Guards the whole P1 arrangement: /ar is not a prefix yet, so the
    // physical /ar/legal/privacy route keeps answering.
    if (!LOCALES.includes("ar")) {
      expect(localeFromPathname("/ar/legal/privacy")).toBeNull();
    } else {
      expect(localeFromPathname("/ar/legal/privacy")).toBe("ar");
    }
  });
});

describe("stripLocalePrefix", () => {
  it("leaves unprefixed paths alone", () => {
    expect(stripLocalePrefix("/buy")).toBe("/buy");
    expect(stripLocalePrefix("/")).toBe("/");
  });

  it("round-trips with withLocalePrefix for every served locale", () => {
    for (const locale of LOCALES) {
      for (const path of [
        "/",
        "/buy",
        "/p/a-villa-baz-ab-1",
        "/legal/privacy",
      ]) {
        expect(stripLocalePrefix(withLocalePrefix(path, locale))).toBe(path);
      }
    }
  });
});

describe("withLocalePrefix", () => {
  it("keeps the default locale unprefixed — that is the point", () => {
    expect(withLocalePrefix("/buy", DEFAULT_LOCALE)).toBe("/buy");
    expect(withLocalePrefix("/", DEFAULT_LOCALE)).toBe("/");
  });
});

describe("internalPath", () => {
  it("always carries a segment, including for the default locale", () => {
    // `.next/server/app/en/buy` is the artifact that has to be hit; a bare
    // `/buy` would match nothing now that the tree lives under [locale].
    expect(internalPath("/buy")).toBe(`/${DEFAULT_LOCALE}/buy`);
    expect(internalPath("/")).toBe(`/${DEFAULT_LOCALE}`);
  });

  it("leaves an already-prefixed path untouched", () => {
    for (const locale of LOCALES) {
      const prefixed = withLocalePrefix("/buy", locale);
      if (prefixed !== "/buy") expect(internalPath(prefixed)).toBe(prefixed);
    }
  });

  it("never double-prefixes", () => {
    expect(internalPath(internalPath("/buy"))).toBe(internalPath("/buy"));
  });
});
