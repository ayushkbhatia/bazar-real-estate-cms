import { describe, expect, it } from "vitest";
import {
  currentReportQuarter,
  priorQuarter,
  quarterBoundaries,
  quarterFromSlug,
  quarterToSlug,
  reportPath,
} from "./market-reports";

describe("market-reports/quarters", () => {
  it("quarter slug round-trips", () => {
    const q = { year: 2026, q: 2 } as const;
    expect(quarterToSlug(q)).toBe("2026-q2");
    expect(quarterFromSlug("2026-q2")).toEqual(q);
  });

  it("rejects malformed quarter slugs", () => {
    expect(quarterFromSlug("2026-q5")).toBeNull();
    expect(quarterFromSlug("2026/q1")).toBeNull();
    expect(quarterFromSlug("garbage")).toBeNull();
  });

  it("priorQuarter wraps year boundaries", () => {
    expect(priorQuarter({ year: 2026, q: 1 }, 1)).toEqual({ year: 2025, q: 4 });
    expect(priorQuarter({ year: 2026, q: 2 }, 4)).toEqual({ year: 2025, q: 2 });
    expect(priorQuarter({ year: 2026, q: 3 }, 7)).toEqual({ year: 2024, q: 4 });
  });

  it("quarterBoundaries returns [start, end) of UTC quarter", () => {
    expect(quarterBoundaries({ year: 2026, q: 1 })).toEqual({
      start: "2026-01-01",
      end: "2026-04-01",
    });
    expect(quarterBoundaries({ year: 2026, q: 4 })).toEqual({
      start: "2026-10-01",
      end: "2027-01-01",
    });
  });

  it("currentReportQuarter lags by one quarter (closed-book)", () => {
    // Q2 2026 (May) → reportable Q1 2026
    expect(currentReportQuarter(new Date("2026-05-15"))).toEqual({
      year: 2026,
      q: 1,
    });
    // Q1 2026 (Feb) → reportable Q4 2025
    expect(currentReportQuarter(new Date("2026-02-15"))).toEqual({
      year: 2025,
      q: 4,
    });
  });

  it("reportPath builds the canonical URL", () => {
    expect(
      reportPath({
        area_slug: "saadiyat-island",
        property_type: "villa",
        quarter: { year: 2026, q: 1 },
      }),
    ).toBe("/market-reports/saadiyat-island/villa/2026-q1");
  });
});
