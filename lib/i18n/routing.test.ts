import { describe, expect, it } from "vitest";
import {
  SETLANG_PARAM,
  internalPath,
  localeFromPathname,
  localeSwitchHref,
  localiseHref,
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

/**
 * `localiseHref` is what stops the Arabic site leaking back into English.
 *
 * Every internal href in this repo is written absolute and unprefixed, which
 * was correct while one locale was served. The day `LOCALES` grew, each one
 * became a link home to English: 46 of the 56 internal links on `/ar/buy`.
 * The exemptions below are not defensive padding — each is a URL that 404s or
 * loops if it gets a prefix it should not have.
 */
describe("localiseHref", () => {
  it("prefixes an ordinary internal path", () => {
    expect(localiseHref("/insights", "ar")).toBe("/ar/insights");
    expect(localiseHref("/", "ar")).toBe("/ar");
  });

  it("leaves English byte-identical, on every path shape", () => {
    // The whole reason a 97-file swap could land in one pass: for the default
    // locale this function is the identity, so English HTML cannot change.
    for (const href of ["/", "/buy", "/p/x?a=1#b", "/api/health", "mailto:a@b"]) {
      expect(localiseHref(href, "en")).toBe(href);
    }
  });

  it("carries the query and the hash", () => {
    expect(localiseHref("/buy/search?beds=3#results", "ar")).toBe(
      "/ar/buy/search?beds=3#results",
    );
  });

  it("never compounds a prefix", () => {
    expect(localiseHref("/ar/buy", "ar")).toBe("/ar/buy");
    expect(localiseHref(localiseHref("/buy", "ar"), "ar")).toBe("/ar/buy");
  });

  it("leaves non-localised routes alone", () => {
    // `/ar/api/…` is served by nothing. On a form POST that reads as the
    // feature being broken rather than the link being wrong.
    for (const href of [
      "/api/concierge",
      "/auth/callback",
      "/sso/google/callback",
      "/sold/BZ-1042",
      "/contact-qr/vcard",
      "/opengraph-image",
    ]) {
      expect(localiseHref(href, "ar")).toBe(href);
    }
  });

  it("leaves the CMS alone", () => {
    // The proxy redirects /ar/admin back to /admin, so prefixing here would
    // cost a redirect on every admin link — and, on /admin itself, loop.
    expect(localiseHref("/admin", "ar")).toBe("/admin");
    expect(localiseHref("/admin/properties", "ar")).toBe("/admin/properties");
    // …but a public route that merely starts with those letters is fine.
    expect(localiseHref("/administrative-areas", "ar")).toBe(
      "/ar/administrative-areas",
    );
  });

  it("leaves static files alone", () => {
    // The proxy matcher excludes anything with a dot, so a prefixed asset is
    // a 404 rather than a redirect.
    expect(localiseHref("/brochures/marsa.pdf", "ar")).toBe(
      "/brochures/marsa.pdf",
    );
  });

  it("leaves anything that is not an internal path alone", () => {
    for (const href of [
      "https://bazar.ae/buy",
      "//cdn.example.com/x",
      "mailto:hello@bazar.ae",
      "tel:+97125550000",
      "#floor-plans",
      "buy/search",
    ]) {
      expect(localiseHref(href, "ar")).toBe(href);
    }
  });
});

describe("localeSwitchHref", () => {
  it("states the choice, so the proxy can make it stick", () => {
    expect(localeSwitchHref("/buy", "", "ar")).toBe(`/ar/buy?${SETLANG_PARAM}=ar`);
    expect(localeSwitchHref("/buy", "", "en")).toBe(`/buy?${SETLANG_PARAM}=en`);
  });

  it("keeps an in-progress search", () => {
    expect(localeSwitchHref("/buy/search", "?beds=3&type=villa", "ar")).toBe(
      `/ar/buy/search?beds=3&type=villa&${SETLANG_PARAM}=ar`,
    );
  });

  it("replaces a stale choice instead of appending a second one", () => {
    // `searchParams.get` returns the first match, so an appended param would
    // leave the proxy acting on the locale the visitor is leaving.
    expect(localeSwitchHref("/buy", `?${SETLANG_PARAM}=ar`, "en")).toBe(
      `/buy?${SETLANG_PARAM}=en`,
    );
  });
});
