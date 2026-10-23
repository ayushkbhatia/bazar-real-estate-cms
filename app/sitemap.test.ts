import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

/**
 * The Arabic tree is advertised alongside the English one.
 *
 * Until the Arabic launch the sitemap listed no `/ar` URL at all, by design.
 * Now every English entry must have its Arabic twin, and both must name each
 * other through hreflang — otherwise Google sees two URLs with the same layout
 * and no statement that they are translations.
 */
describe("sitemap", () => {
  it("lists every URL in both locales, each with hreflang alternates", async () => {
    const entries = await sitemap();
    const urls = new Set(entries.map((e) => new URL(e.url).pathname));

    const english = [...urls].filter(
      (p) => p !== "/ar" && !p.startsWith("/ar/"),
    );
    expect(english.length).toBeGreaterThan(50);
    for (const p of english) {
      const twin = p === "/" ? "/ar" : `/ar${p}`;
      expect(urls.has(twin), `${p} has no Arabic twin`).toBe(true);
    }

    for (const entry of entries) {
      const languages = entry.alternates?.languages ?? {};
      expect(Object.values(languages)).toContain(entry.url);
      expect(Object.keys(languages).sort()).toEqual(["ar-AE", "en-AE"]);
    }
  });
});
