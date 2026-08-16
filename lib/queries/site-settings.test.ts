import { describe, expect, it } from "vitest";
import { resolveSearchIcon } from "./site-settings";

const SITE = "https://www.bazarrealestate.ae";

/**
 * The chain feeding both the sized `<link rel="icon">` and the Organization
 * JSON-LD `logo`. Worth its own spec because the two surfaces must not
 * disagree — a crawler that reads one mark from the head and another from the
 * structured data is the case that produces a blank result row.
 */
describe("resolveSearchIcon", () => {
  it("prefers the dedicated search logo", () => {
    expect(
      resolveSearchIcon(
        {
          search_logo_url: "https://cdn.example.com/search.png",
          favicon_url: "https://cdn.example.com/favicon.png",
          logo_url: "https://cdn.example.com/logo.png",
        },
        SITE,
      ),
    ).toBe("https://cdn.example.com/search.png");
  });

  it("falls back favicon, then logo", () => {
    expect(
      resolveSearchIcon(
        {
          search_logo_url: null,
          favicon_url: "https://cdn.example.com/favicon.png",
          logo_url: "https://cdn.example.com/logo.png",
        },
        SITE,
      ),
    ).toBe("https://cdn.example.com/favicon.png");

    expect(
      resolveSearchIcon(
        {
          search_logo_url: null,
          favicon_url: null,
          logo_url: "https://cdn.example.com/logo.png",
        },
        SITE,
      ),
    ).toBe("https://cdn.example.com/logo.png");
  });

  it("absolutises a site-relative path", () => {
    // schema.org `logo` is only useful to a crawler as an absolute URL, and
    // /brand/logo.png is a legitimate stored value.
    expect(
      resolveSearchIcon(
        {
          search_logo_url: "/brand/bazar-logo.png",
          favicon_url: null,
          logo_url: null,
        },
        `${SITE}/`,
      ),
    ).toBe(`${SITE}/brand/bazar-logo.png`);
  });

  it("returns null when the CMS has nothing set", () => {
    expect(
      resolveSearchIcon(
        { search_logo_url: null, favicon_url: null, logo_url: null },
        SITE,
      ),
    ).toBeNull();
  });
});
