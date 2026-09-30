import { describe, expect, it } from "vitest";
import { monthlyPayment as calculatorPayment } from "@/lib/mortgage";
import { OFFER_TERM_YEARS, monthlyPayment, offerMonthlyPayment } from "./payments";

describe("offer payments", () => {
  it("prices AED 2,150,000 at 3.99% over 25 years at AED 11,337 a month (SPEC §3, C5)", () => {
    expect(offerMonthlyPayment(2_150_000, 3.99)).toBe(11_337);
  });

  it("prices C5's ADCB offer, AED 2,000,000 at 4.15%, at AED 10,723", () => {
    expect(offerMonthlyPayment(2_000_000, 4.15)).toBe(10_723);
  });

  it("uses the calculator's own formula over 25 years", () => {
    expect(monthlyPayment).toBe(calculatorPayment);
    expect(OFFER_TERM_YEARS).toBe(25);
  });
});
