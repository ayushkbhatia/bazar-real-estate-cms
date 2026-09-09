import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { LOCALES, DEFAULT_LOCALE } from "./locales";
import { localiseDestination, withLocaleRedirects } from "./locale-redirects";

/**
 * The guard on the bug this module was written for.
 *
 * `/communities/yas-island` redirected to `/areas/yas-island` and
 * `/ar/communities/yas-island` returned 404 — for eight months, on a link the
 * Arabic footer renders on every page. The rule existed; it just had no idea
 * the site had grown a locale segment.
 *
 * The interesting assertion is the last one, which reads the REAL config: a
 * unit test of the helper alone would still pass on the day someone adds a
 * rule to `redirects()` outside the wrapper.
 */

const NON_DEFAULT = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

describe("localiseDestination", () => {
  it("prefixes a page path", () => {
    expect(localiseDestination("/areas", "ar")).toBe("/ar/areas");
    expect(localiseDestination("/areas/:slug*", "ar")).toBe("/ar/areas/:slug*");
  });

  it("leaves /admin alone — the CMS is English-only and the proxy bounces /ar/admin", () => {
    expect(localiseDestination("/admin/login", "ar")).toBe("/admin/login");
    expect(localiseDestination("/admin", "ar")).toBe("/admin");
  });

  it("leaves non-localised routes alone", () => {
    expect(localiseDestination("/api/health", "ar")).toBe("/api/health");
    expect(localiseDestination("/sold/BZ-1042", "ar")).toBe("/sold/BZ-1042");
    expect(localiseDestination("/contact-qr/vcard", "ar")).toBe(
      "/contact-qr/vcard",
    );
  });

  it("leaves another origin alone", () => {
    expect(localiseDestination("https://example.com/x", "ar")).toBe(
      "https://example.com/x",
    );
  });
});

describe("withLocaleRedirects", () => {
  const rules = [
    { source: "/communities/:slug*", destination: "/areas/:slug*", permanent: true },
    { source: "/sign-in", destination: "/admin/login", permanent: true },
  ];

  it("keeps the given rules, in order, ahead of the twins", () => {
    const out = withLocaleRedirects(rules);
    expect(out.slice(0, rules.length)).toEqual(rules);
  });

  it("adds one twin per non-default locale", () => {
    const out = withLocaleRedirects(rules);
    expect(out).toHaveLength(rules.length * (1 + NON_DEFAULT.length));
    for (const locale of NON_DEFAULT) {
      expect(out).toContainEqual({
        source: `/${locale}/communities/:slug*`,
        destination: `/${locale}/areas/:slug*`,
        permanent: true,
      });
      // The destination stays unprefixed: /ar/admin is bounced by the proxy.
      expect(out).toContainEqual({
        source: `/${locale}/sign-in`,
        destination: "/admin/login",
        permanent: true,
      });
    }
  });

  it("carries every other field through untouched", () => {
    const [, twin] = withLocaleRedirects([
      { source: "/x", destination: "/y", permanent: false },
    ]);
    expect(twin!.permanent).toBe(false);
  });
});

describe("next.config redirects()", () => {
  it("gives every rule a twin under each served locale", async () => {
    const all = await nextConfig.redirects!();
    const bare = all.filter(
      (r) => !NON_DEFAULT.some((l) => r.source.startsWith(`/${l}/`)),
    );
    expect(bare.length).toBeGreaterThan(20); // the WordPress map alone is ~90

    for (const locale of NON_DEFAULT) {
      const sources = new Set(all.map((r) => r.source));
      for (const rule of bare) {
        expect(sources).toContain(`/${locale}${rule.source}`);
      }
    }
  });

  it("never sends a localised source at a locale-prefixed /admin or /api", async () => {
    const all = await nextConfig.redirects!();
    for (const rule of all) {
      for (const locale of NON_DEFAULT) {
        expect(rule.destination).not.toMatch(
          new RegExp(`^/${locale}/(admin|api)(/|$)`),
        );
      }
    }
  });

  it("still redirects the path that was 404ing in Arabic", async () => {
    const all = await nextConfig.redirects!();
    const hit = all.find((r) => r.source === "/ar/communities/:slug*");
    expect(hit?.destination).toBe("/ar/areas/:slug*");
  });
});
