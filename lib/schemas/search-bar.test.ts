import { describe, expect, it } from "vitest";

import { defaultSearchBar } from "@/lib/search-bar";
import { blankTab, searchBarSaveSchema } from "./search-bar";

function payload(over: Partial<Parameters<typeof searchBarSaveSchema.parse>[0]> = {}) {
  const def = defaultSearchBar();
  return {
    key: def.key,
    copy: def.copy,
    tabs: def.tabs.map((tab) => ({
      key: tab.key,
      label: tab.label,
      label_ar: tab.label_ar,
      route: tab.route,
      placeholder: tab.placeholder,
      placeholder_ar: tab.placeholder_ar,
      types: tab.types,
      beds: tab.beds,
      size: tab.size,
      price: tab.price,
      enabled: tab.enabled,
    })),
    ...over,
  };
}

describe("searchBarSaveSchema", () => {
  it("accepts the registry unchanged — saving without editing is a no-op", () => {
    expect(searchBarSaveSchema.safeParse(payload()).success).toBe(true);
  });

  it("refuses a route that leaves the site", () => {
    const tabs = payload().tabs;
    tabs[0].route = "https://example.com/buy";
    const result = searchBarSaveSchema.safeParse(payload({ tabs }));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("path on this site");
  });

  it("refuses a property type the search cannot filter on", () => {
    const tabs = payload().tabs;
    // Not a PROPERTY_TYPES member: `parseFilters` would drop it, so the
    // dropdown entry would silently return the unfiltered list.
    tabs[0].types = [{ value: "chalet", label: "Chalet", label_ar: null }] as never;
    expect(searchBarSaveSchema.safeParse(payload({ tabs })).success).toBe(false);
  });

  it("refuses two tabs answering to the same key", () => {
    const tabs = payload().tabs;
    tabs[1].key = tabs[0].key;
    const result = searchBarSaveSchema.safeParse(payload({ tabs }));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("have to be unique");
  });

  it("refuses switching every tab off", () => {
    const tabs = payload().tabs.map((t) => ({ ...t, enabled: false }));
    const result = searchBarSaveSchema.safeParse(payload({ tabs }));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("At least one tab has to stay on");
  });

  it("refuses an empty tab list", () => {
    expect(searchBarSaveSchema.safeParse(payload({ tabs: [] })).success).toBe(
      false,
    );
  });

  it("takes an Arabic twin 1.5x longer than its English sibling", () => {
    const tabs = payload().tabs;
    tabs[0].label_ar = "ع".repeat(60);
    expect(searchBarSaveSchema.safeParse(payload({ tabs })).success).toBe(true);
    tabs[0].label_ar = "ع".repeat(61);
    expect(searchBarSaveSchema.safeParse(payload({ tabs })).success).toBe(false);
  });

  it("refuses a slider whose step is zero — it would never move", () => {
    const tabs = payload().tabs;
    tabs[0].price = { max: 1_000_000, step: 0 };
    expect(searchBarSaveSchema.safeParse(payload({ tabs })).success).toBe(false);
  });
});

describe("blankTab", () => {
  it("is a valid tab the moment it is named", () => {
    const tab = { ...blankTab(), key: "new-tab", label: "New" };
    expect(searchBarSaveSchema.safeParse(payload({ tabs: [tab] })).success).toBe(
      true,
    );
  });

  it("is refused while it is still unnamed", () => {
    expect(
      searchBarSaveSchema.safeParse(payload({ tabs: [blankTab()] })).success,
    ).toBe(false);
  });
});
