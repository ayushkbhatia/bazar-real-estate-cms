/**
 * The three locale controls build the same href, and all carry the querystring.
 *
 * Three, since the QR contact card's EN/AR pill stopped being a private
 * `useState` and became the third presentation of this one decision. All of
 * them go through `useLocaleHrefs`, which is the only place the href is built.
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

import { CardLocaleToggle } from "../contact-qr/_components/card-locale-toggle";
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

  it("gives all three controls identical targets", () => {
    // Three presentations of one decision, so a divergence here means one of
    // them was edited alone. The QR card's pill joined this list when it
    // stopped holding its own `useState` language: it had drifted into a
    // control that flipped `dir` and the font while the copy stayed in
    // whatever language the server folded to, which on /ar/contact-qr meant
    // pressing EN produced Arabic text laid out left-to-right.
    at("/areas/saadiyat-island", "sort=price");
    const expected = [
      "/areas/saadiyat-island?sort=price&setlang=en",
      "/ar/areas/saadiyat-island?sort=price&setlang=ar",
    ];

    const list = renderWithIntl(<LanguageSwitch current="en" />);
    const fromList = hrefs();
    list.unmount();

    const pill = renderWithIntl(<LocaleToggle current="en" />);
    expect(hrefs()).toEqual(fromList);
    pill.unmount();

    renderWithIntl(<CardLocaleToggle current="en" />);
    expect(hrefs()).toEqual(fromList);
    expect(fromList).toEqual(expected);
  });

  it.each([
    ["header pill", LocaleToggle],
    ["QR card pill", CardLocaleToggle],
  ])("pins %s to one order, so a tap means the same thing twice", (_n, Pill) => {
    /*
     * The regression this exists for is not a wrong href — every href was
     * right. The two pills inherited `<html dir>`, so `EN | AR` under LTR
     * rendered `AR | EN` under RTL and the control's two halves traded places
     * every time it was used.
     *
     * On /contact-qr you tap the right half for Arabic. On /ar/contact-qr the
     * half you did not tap last time is now the option ALREADY active, so the
     * tap navigates to the page you are on, the proxy redirects to the page
     * you are on, and nothing moves. Reported as "the toggle does not
     * respond", with correct hrefs throughout.
     *
     * Asserted on the group rather than on measured geometry because jsdom
     * does no layout. The e2e spec measures the real x positions.
     */
    at("/ar/contact-qr");
    const rtl = renderWithIntl(<Pill current="ar" />);
    expect(screen.getByRole("group").getAttribute("dir")).toBe("ltr");
    rtl.unmount();

    at("/contact-qr");
    renderWithIntl(<Pill current="en" />);
    expect(screen.getByRole("group").getAttribute("dir")).toBe("ltr");
  });

  it("keeps each option labelled in its own direction", () => {
    // Pinning the GROUP must not pin the options: `ع` still needs its own
    // `dir`/`lang` to render and announce correctly inside an LTR row.
    at("/ar/buy");
    renderWithIntl(<LocaleToggle current="ar" />);
    const arabic = screen.getByRole("link", { name: "العربية" });
    expect(arabic.getAttribute("dir")).toBe("rtl");
    expect(arabic.getAttribute("lang")).toBe("ar");
  });

  it("marks the QR card's active language without a pressed state", () => {
    // It is a link to the other language now, not a button holding a value —
    // `aria-pressed` on an anchor is a lie to assistive tech.
    at("/ar/contact-qr");
    renderWithIntl(<CardLocaleToggle current="ar" />);

    const arabic = screen.getByRole("link", { name: "العربية" });
    expect(arabic.getAttribute("aria-current")).toBe("true");
    expect(arabic.getAttribute("aria-pressed")).toBeNull();
    expect(arabic.getAttribute("href")).toBe("/ar/contact-qr?setlang=ar");
    expect(
      screen.getByRole("link", { name: "English" }).getAttribute("href"),
    ).toBe("/contact-qr?setlang=en");
  });
});
