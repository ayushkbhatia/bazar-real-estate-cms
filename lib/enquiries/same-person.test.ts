import { describe, it, expect } from "vitest";
import {
  phoneDigits,
  phonePattern,
  phoneTail,
  sameEmail,
  samePhone,
} from "./same-person";

/** How intake has stored one UAE mobile across its paths. */
const SPELLINGS = [
  "+971 50 123 4567", // typed into the generic tel field
  "+971501234567", // normaliseUaeMobile — service leads, the owner wizard
  "050 123 4567", // trunk zero
  "00971-50-1234567", // international prefix, dashes
  "+971 501234567", // dial code + national number
];

describe("phoneDigits", () => {
  it("refuses too few digits to identify anyone", () => {
    expect(phoneDigits("12345")).toBeNull();
    expect(phoneDigits("")).toBeNull();
    expect(phoneDigits(null)).toBeNull();
  });
});

describe("samePhone", () => {
  it("treats every spelling of one number as one number", () => {
    for (const a of SPELLINGS) {
      for (const b of SPELLINGS) {
        expect(samePhone(a, b), `${a} vs ${b}`).toBe(true);
      }
    }
  });

  it("tells two different numbers apart", () => {
    expect(samePhone("+971 50 123 4567", "+971 55 123 4567")).toBe(false);
  });
});

describe("phonePattern", () => {
  // The database runs this with `~`. Digits, `\D*` and `$` mean the same
  // thing in POSIX EREs as in JavaScript, which is what makes this test the
  // test of the query.
  const pattern = new RegExp(
    phonePattern(phoneTail(phoneDigits("+971 50 123 4567")!)),
  );

  it("finds every stored spelling of the number", () => {
    for (const stored of SPELLINGS) expect(pattern.test(stored), stored).toBe(true);
  });

  it("does not find a different number", () => {
    expect(pattern.test("+971 55 123 4567")).toBe(false);
    expect(pattern.test("+971 50 123 4568")).toBe(false);
  });

  it("is anchored to the end — the digits must be the number's last", () => {
    expect(pattern.test("+971 50 123 4567 9")).toBe(false);
  });

  it("is built from digits alone, so a lead's input can't inject syntax", () => {
    expect(phonePattern("501234567")).toMatch(/^[0-9\\D*$]+$/);
  });
});

describe("sameEmail", () => {
  it("ignores case and surrounding space", () => {
    expect(sameEmail("Amira@Example.com ", "amira@example.com")).toBe(true);
    expect(sameEmail("a@example.com", "b@example.com")).toBe(false);
    expect(sameEmail(null, null)).toBe(false);
  });
});
