import { describe, it, expect } from "vitest";
import {
  ANALYTICS_RANGES,
  aggregateBySource,
  aggregateFunnel,
  aggregateViewingsByStatus,
  bucketByDay,
  parseAnalyticsRange,
} from "./analytics-utils";

describe("parseAnalyticsRange", () => {
  it("returns the input when it's an allowed value", () => {
    for (const r of ANALYTICS_RANGES) {
      expect(parseAnalyticsRange(String(r))).toBe(r);
    }
  });

  it("defaults to 30 for unknown / missing values", () => {
    expect(parseAnalyticsRange(undefined)).toBe(30);
    expect(parseAnalyticsRange("180")).toBe(30);
    expect(parseAnalyticsRange("garbage")).toBe(30);
    expect(parseAnalyticsRange(null)).toBe(30);
  });
});

describe("bucketByDay", () => {
  const now = new Date("2026-05-21T12:00:00Z");

  it("pre-fills empty days with zero counts", () => {
    const buckets = bucketByDay([], 7, now);
    expect(buckets).toHaveLength(7);
    for (const b of buckets) expect(b.count).toBe(0);
  });

  it("counts timestamps into their iso-date bucket", () => {
    const buckets = bucketByDay(
      [
        "2026-05-21T08:30:00Z",
        "2026-05-21T10:30:00Z",
        "2026-05-20T01:00:00Z",
      ],
      7,
      now,
    );
    const today = buckets.find((b) => b.date === "2026-05-21");
    const yesterday = buckets.find((b) => b.date === "2026-05-20");
    expect(today?.count).toBe(2);
    expect(yesterday?.count).toBe(1);
  });

  it("ignores timestamps outside the range window", () => {
    const buckets = bucketByDay(
      ["2024-01-01T00:00:00Z", "2026-05-20T00:00:00Z"],
      7,
      now,
    );
    const totalInRange = buckets.reduce((s, b) => s + b.count, 0);
    expect(totalInRange).toBe(1);
  });

  it("ignores null / invalid entries", () => {
    const buckets = bucketByDay(
      [null, undefined, "not-a-date", "2026-05-21T00:00:00Z"],
      7,
      now,
    );
    const total = buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(1);
  });

  it("buckets are returned in ascending date order", () => {
    const buckets = bucketByDay([], 5, now);
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i - 1].date <= buckets[i].date).toBe(true);
    }
  });
});

describe("aggregateBySource", () => {
  it("groups by source, descending by count", () => {
    const r = aggregateBySource([
      "property_page",
      "contact_page",
      "property_page",
      "property_page",
    ]);
    expect(r[0]).toEqual({ source: "property_page", count: 3 });
    expect(r[1]).toEqual({ source: "contact_page", count: 1 });
  });

  it("collapses empty / null sources into 'unknown'", () => {
    const r = aggregateBySource([null, "", "  ", "newsletter"]);
    expect(r.find((s) => s.source === "unknown")?.count).toBe(3);
    expect(r.find((s) => s.source === "newsletter")?.count).toBe(1);
  });
});

describe("aggregateFunnel", () => {
  it("returns the five canonical stages in order", () => {
    const r = aggregateFunnel([]);
    expect(r.map((s) => s.status)).toEqual([
      "new",
      "in_progress",
      "viewing_scheduled",
      "offer",
      "closed_won",
    ]);
  });

  it("counts each stage, ignoring unknown statuses", () => {
    const r = aggregateFunnel([
      "new",
      "new",
      "in_progress",
      "offer",
      "junk",
      "closed_won",
      "closed_won",
      "closed_won",
    ]);
    expect(r.find((s) => s.status === "new")?.count).toBe(2);
    expect(r.find((s) => s.status === "in_progress")?.count).toBe(1);
    expect(r.find((s) => s.status === "viewing_scheduled")?.count).toBe(0);
    expect(r.find((s) => s.status === "offer")?.count).toBe(1);
    expect(r.find((s) => s.status === "closed_won")?.count).toBe(3);
  });
});

describe("aggregateViewingsByStatus", () => {
  it("collapses nulls into 'unknown'", () => {
    const r = aggregateViewingsByStatus([null, "scheduled", "scheduled"]);
    expect(r.find((s) => s.status === "scheduled")?.count).toBe(2);
    expect(r.find((s) => s.status === "unknown")?.count).toBe(1);
  });
});
