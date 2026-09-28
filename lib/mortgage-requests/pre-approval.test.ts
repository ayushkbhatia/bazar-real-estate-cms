import { describe, expect, it } from "vitest";
import { offerMonthlyPayment } from "./payments";
import { daysUntil, formatAed, formatLongDateWords, formatRate, preApprovalMessage, type OfferForMessage } from "./pre-approval";

const FAB: OfferForMessage = {
  bankName: "First Abu Dhabi Bank",
  bankLabel: "FAB",
  amountAed: 2_150_000,
  ratePct: 3.99,
  rateType: "fixed",
  fixedYears: 3,
  validUntil: "2026-11-21",
};
const ADCB: OfferForMessage = { ...FAB, bankName: "Abu Dhabi Commercial Bank", bankLabel: "ADCB", amountAed: 2_000_000, ratePct: 4.15 };
const names = { applicantFirstName: "Priya", adviserFirstName: "Yasmin" };

describe("the pre-approval message (C5)", () => {
  it("reads as the design's sample, word for word", () => {
    expect(preApprovalMessage(FAB, [ADCB], names)).toBe(
      "Good news, Priya: you're pre-approved. First Abu Dhabi Bank has pre-approved you for up to AED 2,150,000 at 3.99% fixed for 3 years, valid until 21 November 2026. ADCB has also pre-approved you for up to AED 2,000,000.\n\nI'll call you tomorrow morning to talk through both. Yasmin",
    );
  });

  it("mentions no other bank when only one pre-approved, and counts them when more did", () => {
    const one = preApprovalMessage(FAB, [], names);
    expect(one).not.toMatch(/also/);
    expect(one.endsWith("I'll call you tomorrow morning to talk it through. Yasmin")).toBe(true);
    const three = preApprovalMessage(FAB, [ADCB, { ...ADCB, bankName: "Mashreq", bankLabel: "Mashreq", amountAed: 1_900_000 }], names);
    expect(three).toMatch(/Mashreq has also pre-approved you for up to AED 1,900,000\./);
    expect(three).toMatch(/talk through them all\. Yasmin$/);
  });

  it("says a variable rate plainly", () => {
    const text = preApprovalMessage({ ...FAB, rateType: "variable", fixedYears: null, ratePct: 4.2 }, [], names);
    expect(text).toMatch(/at 4\.2% variable, valid until 21 November 2026\./);
  });
});

describe("offer arithmetic and formats", () => {
  it("prices the design's offers over 25 years (payments.ts)", () => {
    expect(offerMonthlyPayment(2_150_000, 3.99)).toBe(11_337);
    expect(offerMonthlyPayment(2_000_000, 4.15)).toBe(10_723);
  });

  it("formats money, rates, dates and days as C5 shows them", () => {
    expect(formatAed(2_150_000)).toBe("AED 2,150,000");
    expect([formatRate(3.99), formatRate(4.2), formatRate(4)]).toEqual(["3.99", "4.2", "4"]);
    expect(formatLongDateWords("2026-11-21")).toBe("21 November 2026");
    expect(daysUntil("2026-11-21", "2026-09-22")).toBe(60);
  });
});
