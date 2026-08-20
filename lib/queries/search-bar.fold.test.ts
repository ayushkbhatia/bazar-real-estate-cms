/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import type { Locale } from "@/lib/i18n/locales";
import { expectFolds, expectNoTwinsLeak } from "@/lib/i18n/fold-harness";
import {
  activeTabs,
  defaultSearchBar,
  localiseSearchBar,
  resolveSearchBar,
} from "@/lib/search-bar";
import type { StoredSearchBarTab } from "@/lib/search-bar";

/**
 * Proof that `search_bar_tabs.label` and `.placeholder` fold.
 *
 * `localiseSearchBar` is the choke point — `getSearchBar` is a database read
 * and this one call — so the proof runs the real fold rather than a stand-in.
 * Both halves matter and fail in opposite directions: a fold that never fires
 * returns English on /ar, and one applied unconditionally returns Arabic on
 * the live English site.
 */

const STORED: StoredSearchBarTab = {
  key: "buy",
  label: "Buy",
  label_ar: "شراء عقار",
  route: "/buy",
  placeholder: "Where are you looking?",
  placeholder_ar: "أين تبحث؟",
  types: [{ value: "villa", label: "Villa", label_ar: "فيلا فاخرة" }],
  beds: true,
  size: null,
  price: { max: 10_000_000, step: 100_000 },
  enabled: true,
  position: 10,
};

const read = (locale: Locale) =>
  localiseSearchBar(resolveSearchBar(null, [STORED]), locale).tabs[0];

describe("search_bar_tabs on the home hero", () => {
  it("folds the tab label", async () => {
    await expectFolds({
      read,
      pick: (tab) => tab.label,
      english: "Buy",
      arabic: "شراء عقار",
      what: "search_bar_tabs.label",
    });
  });

  it("folds the search box placeholder", async () => {
    await expectFolds({
      read,
      pick: (tab) => tab.placeholder,
      english: "Where are you looking?",
      arabic: "أين تبحث؟",
      what: "search_bar_tabs.placeholder",
    });
  });

  it("folds the type labels inside the jsonb bag", async () => {
    await expectFolds({
      read,
      pick: (tab) => tab.types[0].label,
      english: "Villa",
      arabic: "فيلا فاخرة",
      what: "search_bar_tabs.types[].label",
    });
  });

  it("never folds the route or the type value — those are identity", () => {
    const ar = read("ar" as Locale);
    expect(ar.route).toBe("/buy");
    expect(ar.types[0].value).toBe("villa");
  });
});

/**
 * The bug this section was opened to fix: /ar rendered an English search bar.
 *
 * Nothing is stored, so the registry defaults are what render — and their
 * twins are all null. A fold that only consulted the stored value would leave
 * every one of them in English with the Arabic sitting in the shared store,
 * unread. This is the assertion that would have caught it.
 */
describe("the untouched registry still folds", () => {
  const untouched = (locale: Locale) =>
    activeTabs(localiseSearchBar(resolveSearchBar(null, null), locale));

  it("renders Arabic tab labels with nothing stored", () => {
    const ar = untouched("ar" as Locale);
    expect(ar.map((t) => t.label)).toEqual([
      "على الخارطة",
      "شراء",
      "الإيجار",
      "تجاري",
    ]);
  });

  it("renders Arabic placeholders and property types with nothing stored", () => {
    const ar = untouched("ar" as Locale);
    expect(ar[0].placeholder).toBe("المنطقة أو المبنى أو المجمع أو الإمارة");
    expect(ar[3].placeholder).toBe("المنطقة أو الإمارة");
    expect(ar[0].types.map((t) => t.label)).toEqual([
      "شقة",
      "تاون هاوس",
      "فيلا",
      "بنتهاوس",
    ]);
  });

  it("leaves English untouched", () => {
    const en = untouched("en" as Locale);
    expect(en.map((t) => t.label)).toEqual(
      defaultSearchBar().tabs.map((t) => t.label),
    );
  });

  it("never leaks a twin key to a renderer, in either locale", () => {
    expectNoTwinsLeak(untouched("en" as Locale), "search bar (en)");
    expectNoTwinsLeak(untouched("ar" as Locale), "search bar (ar)");
  });
});

/**
 * The eight shared labels are absent by default, and absence is the point: the
 * component asks the message catalogue instead, which is already translated.
 * The fold must not turn a null into an English string on the way past.
 */
describe("the copy bag", () => {
  it("keeps an un-overridden label null in both locales", () => {
    for (const locale of ["en", "ar"] as Locale[]) {
      const copy = localiseSearchBar(resolveSearchBar(null, null), locale).copy;
      expect(copy.submit_label).toBeNull();
      expect(copy).not.toHaveProperty("submit_label_ar");
    }
  });

  it("folds an override the editor did type", () => {
    const bar = resolveSearchBar(
      {
        key: "home_hero",
        copy: { submit_label: "Find homes", submit_label_ar: "ابحث عن منزل" },
      },
      null,
    );
    expect(localiseSearchBar(bar, "en" as Locale).copy.submit_label).toBe(
      "Find homes",
    );
    expect(localiseSearchBar(bar, "ar" as Locale).copy.submit_label).toBe(
      "ابحث عن منزل",
    );
  });
});
