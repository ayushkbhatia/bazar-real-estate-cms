import { describe, expect, it } from "vitest";
import { communityCount, orderLaunches } from "./launch-order";

/** Newest first — the order `listPublishedDevelopments` hands over. */
const PROJECTS = ["e", "d", "c", "b", "a"].map((slug) => ({ slug }));
const slugs = (rows: { slug: string }[]) => rows.map((r) => r.slug);

describe("orderLaunches", () => {
  it("keeps the published order when nothing is picked", () => {
    expect(slugs(orderLaunches(PROJECTS, []))).toEqual(["e", "d", "c", "b", "a"]);
  });

  it("leads with the picks, in the order they were picked", () => {
    const picks = [{ slug: "b", enabled: true }, { slug: "d", enabled: true }];
    expect(slugs(orderLaunches(PROJECTS, picks))).toEqual(["b", "d", "e", "c", "a"]);
  });

  it("treats a pick with no switch as on, the way a freshly added row saves", () => {
    expect(slugs(orderLaunches(PROJECTS, [{ slug: "a" }]))).toEqual([
      "a",
      "e",
      "d",
      "c",
      "b",
    ]);
  });

  it("drops a project only when its row is switched off", () => {
    const picks = [{ slug: "c", enabled: false }];
    expect(slugs(orderLaunches(PROJECTS, picks))).toEqual(["e", "d", "b", "a"]);
  });

  it("lets the hide win over a duplicate row that pins the same project", () => {
    const picks = [
      { slug: "c", enabled: true },
      { slug: "c", enabled: false },
    ];
    expect(slugs(orderLaunches(PROJECTS, picks))).not.toContain("c");
  });

  it("keeps a project that is picked twice exactly once, at its first position", () => {
    const picks = [
      { slug: "a", enabled: true },
      { slug: "b", enabled: true },
      { slug: "a", enabled: true },
    ];
    expect(slugs(orderLaunches(PROJECTS, picks))).toEqual(["a", "b", "e", "d", "c"]);
  });

  it("skips a pick whose project is no longer published", () => {
    const picks = [{ slug: "gone", enabled: true }, { slug: "d", enabled: true }];
    expect(slugs(orderLaunches(PROJECTS, picks))).toEqual(["d", "e", "c", "b", "a"]);
  });

  it("ignores rows with no project chosen and values that are not slugs", () => {
    const picks = [
      { slug: "", enabled: true },
      { slug: null, enabled: true },
      { slug: 42, enabled: false },
      {},
    ];
    expect(slugs(orderLaunches(PROJECTS, picks))).toEqual(["e", "d", "c", "b", "a"]);
  });

  it("still shows a project published after the list was curated", () => {
    const picks = [{ slug: "b", enabled: true }];
    const later = [{ slug: "new" }, ...PROJECTS];
    expect(slugs(orderLaunches(later, picks))).toEqual([
      "b",
      "new",
      "e",
      "d",
      "c",
      "a",
    ]);
  });

  it("returns the caller's rows untouched rather than copies", () => {
    const [first] = orderLaunches(PROJECTS, []);
    expect(first).toBe(PROJECTS[0]);
  });
});

describe("communityCount", () => {
  it("counts each community once and leaves unplaced projects out", () => {
    expect(
      communityCount([
        { area: { slug: "yas-island" } },
        { area: { slug: "yas-island" } },
        { area: { slug: "saadiyat-island" } },
        { area: null },
      ]),
    ).toBe(2);
  });

  it("is zero for an empty catalogue", () => {
    expect(communityCount([])).toBe(0);
  });
});
