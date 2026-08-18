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
    expect(hrefs()).toEqual(["/p/marsa-villa-42", "/ar/p/marsa-villa-42"]);
  });

  it("keeps the querystring, so an in-progress search survives", () => {
    at("/buy/search", "beds=3&type=villa");
    renderWithIntl(<LanguageSwitch current="en" />);
    expect(hrefs()).toEqual([
      "/buy/search?beds=3&type=villa",
      "/ar/buy/search?beds=3&type=villa",
    ]);
  });

  it("appends no bare ? when there is no query", () => {
    at("/buy");
    renderWithIntl(<LocaleToggle current="en" />);
    expect(hrefs()).toEqual(["/buy", "/ar/buy"]);
  });

  it("strips the current prefix rather than compounding it", () => {
    // The /ar/ar/… shape: re-prefixing without stripping first.
    at("/ar/buy");
    renderWithIntl(<LocaleToggle current="ar" />);
    expect(hrefs()).toEqual(["/buy", "/ar/buy"]);
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
      "/areas/saadiyat-island?sort=price",
      "/ar/areas/saadiyat-island?sort=price",
    ]);
  });
});
