import { describe, expect, it } from "vitest";
import { splitPhone } from "./phone";

describe("splitPhone", () => {
  it("splits an international UAE number", () => {
    expect(splitPhone("+971501234567")).toEqual({
      countryCode: "+971",
      national: "501234567",
    });
  });

  it("ignores the punctuation a visitor actually types", () => {
    expect(splitPhone("+971 (50) 123-4567")).toEqual({
      countryCode: "+971",
      national: "501234567",
    });
  });

  it("treats the 00 access prefix as a plus", () => {
    expect(splitPhone("00971501234567")).toEqual({
      countryCode: "+971",
      national: "501234567",
    });
  });

  it("prefers the longest matching calling code", () => {
    // +97 is not a country; +971 and +974 both start with it, so a greedy
    // two-digit match would strand a digit at the front of the subscriber
    // number and produce a number that does not dial.
    expect(splitPhone("+97455512345")).toEqual({
      countryCode: "+974",
      national: "55512345",
    });
  });

  it("assumes the UAE for a local number and drops the trunk zero", () => {
    expect(splitPhone("0501234567")).toEqual({
      countryCode: "+971",
      national: "501234567",
    });
  });

  it("handles a country code typed without a plus", () => {
    expect(splitPhone("971501234567")).toEqual({
      countryCode: "+971",
      national: "501234567",
    });
  });

  it("honours a non-UAE default", () => {
    expect(splitPhone("7811976554", "91")).toEqual({
      countryCode: "+91",
      national: "7811976554",
    });
  });

  it("splits the doc's own example", () => {
    expect(splitPhone("+9178119765543")).toEqual({
      countryCode: "+91",
      national: "78119765543",
    });
  });

  it("returns null rather than a fragment", () => {
    expect(splitPhone(null)).toBeNull();
    expect(splitPhone("")).toBeNull();
    expect(splitPhone("   ")).toBeNull();
    expect(splitPhone("1234")).toBeNull();
    expect(splitPhone("n/a")).toBeNull();
  });

  it("keeps every digit of an unrecognised international number", () => {
    const out = splitPhone("+9995551234567");
    expect(out).not.toBeNull();
    expect(`${out!.countryCode}${out!.national}`.replace("+", "")).toBe(
      "9995551234567",
    );
  });
});
