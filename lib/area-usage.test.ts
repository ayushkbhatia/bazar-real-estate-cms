import { describe, expect, it } from "vitest";
import {
  EMPTY_AREA_USAGE,
  areaIsDeletable,
  describeAreaBlockers,
  type AreaUsage,
} from "./area-usage";

const usage = (p: number, d: number, c: number, menuLinks = 0): AreaUsage => ({
  properties: { count: p, sample: [] },
  developments: { count: d, sample: [] },
  children: { count: c, sample: [] },
  menuLinks,
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
});

describe("describeAreaBlockers", () => {
  it("says nothing when nothing blocks", () => {
    expect(describeAreaBlockers(EMPTY_AREA_USAGE)).toBeNull();
  });

  it("reads naturally for one, two and three kinds", () => {
    expect(describeAreaBlockers(usage(1, 0, 0))).toBe("1 listing");
    expect(describeAreaBlockers(usage(4, 1, 0))).toBe("4 listings and 1 project");
    expect(describeAreaBlockers(usage(2, 3, 1))).toBe(
      "2 listings, 3 projects and 1 area inside it",
    );
    expect(describeAreaBlockers(usage(0, 0, 2))).toBe("2 areas inside it");
  });
});
