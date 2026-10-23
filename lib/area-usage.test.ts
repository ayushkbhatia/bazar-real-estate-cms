import { describe, expect, it } from "vitest";
import {
  EMPTY_AREA_USAGE,
  areaIsDeletable,
  describeAreaBlockers,
  describeUnpublished,
  type AreaUsage,
} from "./area-usage";

const usage = (p: number, d: number, c: number, menuLinks = 0): AreaUsage => ({
  properties: { count: p, sample: [] },
  developments: { count: d, sample: [] },
  children: { count: c, sample: [] },
  unpublished: EMPTY_AREA_USAGE.unpublished,
  menuLinks,
});

const drafts = (p: number, d: number): AreaUsage => ({
  ...EMPTY_AREA_USAGE,
  unpublished: {
    properties: { count: p, sample: [] },
    developments: { count: d, sample: [] },
  },
});

describe("areaIsDeletable", () => {
  it("allows an area nothing sits in", () => {
    expect(areaIsDeletable(EMPTY_AREA_USAGE)).toBe(true);
  });

  it("is blocked by any listing, project or child area", () => {
    expect(areaIsDeletable(usage(1, 0, 0))).toBe(false);
    expect(areaIsDeletable(usage(0, 1, 0))).toBe(false);
    expect(areaIsDeletable(usage(0, 0, 1))).toBe(false);
  });

  it("is not blocked by menu links — those only warn", () => {
    expect(areaIsDeletable(usage(0, 0, 0, 3))).toBe(true);
  });

  it("is not blocked by unpublished listings or projects", () => {
    expect(areaIsDeletable(drafts(4, 2))).toBe(true);
  });
});

describe("describeAreaBlockers", () => {
  it("says nothing when nothing blocks", () => {
    expect(describeAreaBlockers(EMPTY_AREA_USAGE)).toBeNull();
  });

  it("reads naturally for one, two and three kinds", () => {
    expect(describeAreaBlockers(usage(1, 0, 0))).toBe("1 published listing");
    expect(describeAreaBlockers(usage(4, 1, 0))).toBe(
      "4 published listings and 1 published project",
    );
    expect(describeAreaBlockers(usage(2, 3, 1))).toBe(
      "2 published listings, 3 published projects and 1 area inside it",
    );
    expect(describeAreaBlockers(usage(0, 0, 2))).toBe("2 areas inside it");
  });
});

describe("describeUnpublished", () => {
  it("says nothing when nothing unpublished sits in the area", () => {
    expect(describeUnpublished(EMPTY_AREA_USAGE)).toBeNull();
  });

  it("names the unpublished listings and projects", () => {
    expect(describeUnpublished(drafts(1, 0))).toBe("1 unpublished listing");
    expect(describeUnpublished(drafts(3, 2))).toBe(
      "3 unpublished listings and 2 unpublished projects",
    );
  });
});
