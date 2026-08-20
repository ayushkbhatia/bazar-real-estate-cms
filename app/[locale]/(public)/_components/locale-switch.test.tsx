/**
 * The two locale controls build the same href, and both carry the querystring.
 *
 * The querystring half is the regression this file exists for.
 * `LanguageSwitch`'s docblock promised "the querystring rides along too, so an
 * in-progress search survives" from the day it was written, and the href was
 * built from `usePathname()` alone — so switching locale on a filtered search
 * dropped every filter and landed on an unfiltered listing page. Nothing
 * caught it because the claim lived in prose.
 *
 * The `?setlang=` on every href is the second thing pinned here. It is what
 * makes a locale choice outlive the click — the proxy reads it, writes the
 * preference cookie, and strips it — so an href that lost it would silently
 * restore the bug this whole change exists to fix: Arabic chrome, then the
 * next link drops you back into English.
 *
 * The suffix is read off `window.location.search` in an effect rather than
 * from `useSearchParams`, so these tests drive jsdom's real history rather
 * than a mocked hook. Mocking the hook would keep passing after the hook was
 * removed, which is exactly the change that had to be made: `useSearchParams`
 * opts its subtree out of static rendering, and this control renders in the
 * (public) layout, so it took every route with it.
 */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import { LanguageSwitch } from "./language-switch";
import { LocaleToggle } from "./locale-toggle";
import { renderWithIntl } from "@/lib/i18n/test-utils";

const mocks = vi.hoisted(() => ({ path: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.path,
}));

/** Put jsdom and `usePathname` on the same URL before rendering. */
function at(path: string, query = "") {
  mocks.path = path;
  window.history.replaceState({}, "", path + (query ? `?${query}` : ""));
}

const hrefs = () =>
  screen.getAllByRole("link").map((a) => a.getAttribute("href"));

describe("locale controls", () => {
  it("keeps the path, so a visitor stays on the page they were reading", () => {
    at("/p/marsa-villa-42");
    renderWithIntl(<LanguageSwitch current="en" />);
    expect(hrefs()).toEqual([
      "/p/marsa-villa-42?setlang=en",
      "/ar/p/marsa-villa-42?setlang=ar",
    ]);
  });

  it("keeps the querystring, so an in-progress search survives", () => {
    at("/buy/search", "beds=3&type=villa");
    renderWithIntl(<LanguageSwitch current="en" />);
    expect(hrefs()).toEqual([
      "/buy/search?beds=3&type=villa&setlang=en",
      "/ar/buy/search?beds=3&type=villa&setlang=ar",
    ]);
  });

  it("states the choice, so it outlives the click", () => {
    at("/buy");
    renderWithIntl(<LocaleToggle current="en" />);
    expect(hrefs()).toEqual(["/buy?setlang=en", "/ar/buy?setlang=ar"]);
  });

  it("replaces a stale setlang rather than appending a second one", () => {
    // A URL copied mid-switch. `searchParams.get` returns the FIRST match, so
    // an appended param would leave the proxy reading the old choice.
    at("/buy", "setlang=ar&beds=2");
    renderWithIntl(<LocaleToggle current="ar" />);
    expect(hrefs()).toEqual([
      "/buy?setlang=en&beds=2",
      "/ar/buy?setlang=ar&beds=2",
    ]);
  });

  it("strips the current prefix rather than compounding it", () => {
    // The /ar/ar/… shape: re-prefixing without stripping first.
    at("/ar/buy");
    renderWithIntl(<LocaleToggle current="ar" />);
    expect(hrefs()).toEqual(["/buy?setlang=en", "/ar/buy?setlang=ar"]);
  });

  it("labels each option in its own language", () => {
    at("/");
    renderWithIntl(<LocaleToggle current="en" />);
    // The visible label is an abbreviation; the accessible name is the full
    // name of that language, written in it.
    expect(screen.getByRole("link", { name: "العربية" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "English" })).toBeTruthy();
  });

  it("marks the active locale for assistive tech", () => {
    at("/ar/about");
    renderWithIntl(<LocaleToggle current="ar" />);
    const arabic = screen.getByRole("link", { name: "العربية" });
    expect(arabic.getAttribute("aria-current")).toBe("true");
    expect(
      screen.getByRole("link", { name: "English" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("gives both controls identical targets", () => {
    // Two presentations of one decision, so a divergence here means one of
    // them was edited alone.
    at("/areas/saadiyat-island", "sort=price");

    const list = renderWithIntl(<LanguageSwitch current="en" />);
    const fromList = hrefs();
    list.unmount();

    renderWithIntl(<LocaleToggle current="en" />);
    expect(hrefs()).toEqual(fromList);
    expect(fromList).toEqual([
      "/areas/saadiyat-island?sort=price&setlang=en",
      "/ar/areas/saadiyat-island?sort=price&setlang=ar",
    ]);
  });
});
