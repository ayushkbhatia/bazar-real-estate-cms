import { describe, it, expect } from "vitest";
import {
  canTrash,
  deriveMediaState,
  matchesStateFilter,
  sortUsages,
  summariseUsage,
  type MediaUsage,
} from "./media-usage";

function usage(over: Partial<MediaUsage> = {}): MediaUsage {
  return {
    kind: "property",
    id: "p-1",
    label: "Mamsha · 3-bed",
    role: "Hero",
    href: "/admin/properties/p-1",
    live: true,
    internal: false,
    ...over,
  };
}

describe("deriveMediaState", () => {
  it("is unused when nothing references the asset", () => {
    expect(deriveMediaState([])).toBe("unused");
  });

  it("is live when any usage is on a published surface", () => {
    expect(
      deriveMediaState([usage({ live: false }), usage({ live: true })]),
    ).toBe("live");
  });

  it("is attached when every usage is a draft / off-market record", () => {
    expect(
      deriveMediaState([
        usage({ live: false }),
        usage({ kind: "article", live: false }),
      ]),
    ).toBe("attached");
  });

  it("is internal only when every usage is internal", () => {
    const doc = usage({ kind: "document", live: false, internal: true });
    expect(deriveMediaState([doc])).toBe("internal");
    expect(deriveMediaState([doc, usage({ live: false })])).toBe("attached");
    expect(deriveMediaState([doc, usage({ live: true })])).toBe("live");
  });
});

describe("canTrash", () => {
  it("allows only unused assets", () => {
    expect(canTrash({ state: "unused", indexPartial: false }).allowed).toBe(
      true,
    );
    for (const state of ["live", "attached", "internal"] as const) {
      const res = canTrash({ state, indexPartial: false });
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/in use/i);
    }
  });

  it("blocks everything when the usage index is incomplete", () => {
    // The dangerous case: a source failed, so an asset that IS used looks
    // unused. Deleting on that reading punches a hole in a live page.
    const res = canTrash({ state: "unused", indexPartial: true });
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/couldn't be checked/i);
  });
});

describe("summariseUsage", () => {
  it("counts per kind and pluralises", () => {
    expect(summariseUsage([])).toBe("Not used anywhere");
    expect(summariseUsage([usage()])).toBe("1 listing");
    expect(
      summariseUsage([usage(), usage({ id: "p-2" }), usage({ kind: "page" })]),
    ).toBe("2 listings · 1 page");
    expect(summariseUsage([usage({ kind: "developer_profile" })])).toBe(
      "1 developer profile",
    );
  });
});

describe("sortUsages", () => {
  it("puts live usages first, then groups by kind", () => {
    const sorted = sortUsages([
      usage({ kind: "page", label: "About", live: false }),
      usage({ kind: "article", label: "Guide", live: true }),
      usage({ kind: "property", label: "Mamsha", live: true }),
    ]);
    expect(sorted.map((u) => u.label)).toEqual(["Mamsha", "Guide", "About"]);
  });
});

describe("matchesStateFilter", () => {
  it("passes everything through the all filter", () => {
    expect(matchesStateFilter("live", "all")).toBe(true);
    expect(matchesStateFilter("unused", "unused")).toBe(true);
    expect(matchesStateFilter("unused", "live")).toBe(false);
  });
});
