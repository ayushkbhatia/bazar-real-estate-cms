import { describe, expect, it } from "vitest";

import { defaultSearchBar } from "./registry";
import {
  activeTabs,
  defaultResolvedSearchBar,
  mergeCopy,
  mergeTabs,
  resolveSearchBar,
} from "./resolve";
import type { StoredSearchBarTab } from "./types";

function storedTab(over: Partial<StoredSearchBarTab> = {}): StoredSearchBarTab {
  return {
    key: "buy",
    label: "Buy a home",
    label_ar: null,
    route: "/buy",
    placeholder: "Where?",
    placeholder_ar: null,
    types: [],
    beds: true,
    size: null,
    price: { max: 10_000_000, step: 100_000 },
    enabled: true,
    position: 10,
    ...over,
  };
}

describe("resolveSearchBar", () => {
  it("is the registry, verbatim, when nothing is stored", () => {
    const resolved = resolveSearchBar(null, null);
    expect(resolved.tabs).toEqual(defaultSearchBar().tabs);
    expect(resolved.usingDefaults).toBe(true);
  });

  it("counts stored tabs alone as no longer using defaults", () => {
    const resolved = resolveSearchBar(null, [storedTab()]);
    expect(resolved.usingDefaults).toBe(false);
  });
});

describe("mergeCopy", () => {
  const base = defaultSearchBar().copy;

  it("leaves a label alone when the editor typed nothing", () => {
    expect(mergeCopy(base, { submit_label: "   " }).submit_label).toBeNull();
  });

  it("takes the override, trimmed, when they did", () => {
    const merged = mergeCopy(base, {
      submit_label: "  Find homes  ",
      submit_label_ar: "ابحث",
    });
    expect(merged.submit_label).toBe("Find homes");
    expect(merged.submit_label_ar).toBe("ابحث");
  });

  it("never invents a key the registry does not declare", () => {
    const merged = mergeCopy(base, {
      // @ts-expect-error — a hand-written row, which is the case this guards.
      surprise: "hello",
    });
    expect(merged).not.toHaveProperty("surprise");
  });
});

describe("mergeTabs", () => {
  const def = defaultSearchBar();

  it("falls back to the registry when nothing is stored", () => {
    expect(mergeTabs(def, null)).toEqual(def.tabs);
    expect(mergeTabs(def, [])).toEqual(def.tabs);
  });

  it("lets storage win entirely — a deleted tab stays deleted", () => {
    const tabs = mergeTabs(def, [storedTab()]);
    expect(tabs.map((t) => t.key)).toEqual(["buy"]);
    expect(tabs[0].label).toBe("Buy a home");
  });

  it("orders by position, not by the order the rows arrived", () => {
    const tabs = mergeTabs(def, [
      storedTab({ key: "rent", position: 20 }),
      storedTab({ key: "buy", position: 10 }),
    ]);
    expect(tabs.map((t) => t.key)).toEqual(["buy", "rent"]);
  });

  it("strips `position` — it is storage, not something a renderer reads", () => {
    expect(mergeTabs(def, [storedTab()])[0]).not.toHaveProperty("position");
  });
});

describe("activeTabs", () => {
  it("drops the ones an editor switched off", () => {
    const bar = resolveSearchBar(null, [
      storedTab({ key: "buy", position: 10 }),
      storedTab({ key: "rent", position: 20, enabled: false }),
    ]);
    expect(activeTabs(bar).map((t) => t.key)).toEqual(["buy"]);
  });

  it("restores the registry rather than rendering an empty tablist", () => {
    // The schema refuses this on the way in; a hand-written row is the path
    // that gets here, and a search bar with no tabs is not a smaller search
    // bar — it is a broken one.
    const bar = resolveSearchBar(null, [storedTab({ enabled: false })]);
    expect(activeTabs(bar)).toEqual(defaultSearchBar().tabs);
  });
});

describe("defaultResolvedSearchBar", () => {
  it("is what every failure path falls back to", () => {
    const bar = defaultResolvedSearchBar();
    expect(bar.usingDefaults).toBe(true);
    expect(bar.tabs).toEqual(defaultSearchBar().tabs);
  });
});
