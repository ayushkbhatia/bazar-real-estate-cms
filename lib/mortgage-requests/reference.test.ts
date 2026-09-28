import { describe, expect, it } from "vitest";
import {
  formatReference,
  isReference,
  normaliseReferenceQuery,
  parseReference,
  referenceYear,
} from "./reference";

describe("references (SPEC §2.6)", () => {
  it("formats BZM-YY-NNNN with four digits, growing past 9999", () => {
    expect(formatReference(26, 412)).toBe("BZM-26-0412");
    expect(formatReference(2026, 7)).toBe("BZM-26-0007");
    expect(formatReference(26, 12345)).toBe("BZM-26-12345");
  });

  it("parses what it formats, and nothing else", () => {
    expect(parseReference("BZM-26-0412")).toEqual({ yy: 26, n: 412 });
    expect(parseReference("BZM-26-412")).toBeNull();
    expect(parseReference("BAZ-AD-04891")).toBeNull();
    expect(isReference("BZM-26-0409")).toBe(true);
  });

  it("takes the year from Dubai time", () => {
    // 22:00 UTC on 31 Dec 2026 is 02:00 on 1 Jan 2027 in Dubai.
    expect(referenceYear(new Date("2026-12-31T22:00:00Z"))).toBe(27);
    expect(referenceYear(new Date("2026-12-31T19:00:00Z"))).toBe(26);
  });

  it("normalises what people type into C1's search", () => {
    expect(normaliseReferenceQuery("bzm-26-0412")).toBe("BZM-26-0412");
    expect(normaliseReferenceQuery(" BZM 26 0412 ")).toBe("BZM-26-0412");
    expect(normaliseReferenceQuery("26-0412")).toBe("BZM-26-0412");
    expect(normaliseReferenceQuery("BZM26-0412")).toBe("BZM-26-0412");
    expect(normaliseReferenceQuery("0412")).toBe("0412");
    expect(normaliseReferenceQuery("12")).toBeNull();
    expect(normaliseReferenceQuery("Priya")).toBeNull();
  });
});
