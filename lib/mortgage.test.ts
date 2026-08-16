import { describe, it, expect } from "vitest";
import {
  affordability,
  amortizationByYear,
  cashToClose,
  minDownPaymentPct,
  monthlyPayment,
  totals,
  DEFAULT_MORTGAGE_ASSUMPTIONS,
} from "./mortgage";

/* monthlyPayment — verify against worked examples. The formula:
 *   P · r · (1+r)^n / ((1+r)^n − 1)
 * with r = APR/12 and n = months. */

describe("monthlyPayment", () => {
  it("matches the design's headline scenario (3.15M @ 4.25% × 25y ≈ 17K)", () => {
    // Design shows AED 17,082/mo for AED 3,150,000 borrowed @ 4.25% fixed × 25y.
    // Exact formula yields AED 17,065 — close enough that the design copy
    // is fine, but the test asserts the precise number we'd display.
    expect(monthlyPayment(3_150_000, 4.25, 25)).toBe(17_065);
  });

  it("handles 0% interest as a flat principal/n split", () => {
    expect(monthlyPayment(1_200_000, 0, 10)).toBe(10_000);
  });

  it("treats <=0 principal and <=0 term as 0", () => {
    expect(monthlyPayment(0, 4.25, 25)).toBe(0);
    expect(monthlyPayment(1_000_000, 4.25, 0)).toBe(0);
  });

  it("is monotonic — a longer term lowers the monthly payment", () => {
    const short = monthlyPayment(2_000_000, 5, 15);
    const long = monthlyPayment(2_000_000, 5, 30);
    expect(long).toBeLessThan(short);
  });

  it("is monotonic — a higher rate raises the monthly payment", () => {
    const cheap = monthlyPayment(2_000_000, 3, 25);
    const dear = monthlyPayment(2_000_000, 6, 25);
    expect(dear).toBeGreaterThan(cheap);
  });
});

/* totals — composition of monthlyPayment + simple sums. */

describe("totals", () => {
  it("computes principal, total paid, total interest from inputs", () => {
    const t = totals({
      pricePropertyAed: 4_200_000,
      downPaymentPct: 0.25,
      annualRatePct: 4.25,
      termYears: 25,
    });
    expect(t.principalAed).toBe(3_150_000);
    expect(t.monthlyPaymentAed).toBe(17_065);
    // total paid = monthly × 300; total interest = total paid − principal.
    expect(t.totalPaidAed).toBe(17_065 * 300);
    expect(t.totalInterestAed).toBe(t.totalPaidAed - t.principalAed);
    expect(t.principalSharePct).toBeGreaterThan(50);
    expect(t.principalSharePct).toBeLessThan(80);
  });

  it("returns zeros for a 100% down payment (no loan)", () => {
    const t = totals({
      pricePropertyAed: 1_000_000,
      downPaymentPct: 1,
      annualRatePct: 4.25,
      termYears: 25,
    });
    expect(t.principalAed).toBe(0);
    expect(t.monthlyPaymentAed).toBe(0);
    expect(t.totalInterestAed).toBe(0);
  });

  it("clamps the down-payment fraction into [0, 1]", () => {
    const tHigh = totals({
      pricePropertyAed: 1_000_000,
      downPaymentPct: 2,
      annualRatePct: 4.25,
      termYears: 25,
    });
    expect(tHigh.principalAed).toBe(0);

    const tLow = totals({
      pricePropertyAed: 1_000_000,
      downPaymentPct: -1,
      annualRatePct: 4.25,
      termYears: 25,
    });
    expect(tLow.principalAed).toBe(1_000_000);
  });
});

/* amortizationByYear — sanity checks rather than per-cell verification. */

describe("amortizationByYear", () => {
  const inputs = {
    pricePropertyAed: 4_200_000,
    downPaymentPct: 0.25,
    annualRatePct: 4.25,
    termYears: 25,
  };
  const rows = amortizationByYear(inputs);

  it("yields one row per loan year", () => {
    expect(rows).toHaveLength(25);
    expect(rows[0].year).toBe(1);
    expect(rows[24].year).toBe(25);
  });

  it("interest share tapers (year 1 > year 25)", () => {
    expect(rows[0].interestAed).toBeGreaterThan(rows[24].interestAed);
    expect(rows[0].principalAed).toBeLessThan(rows[24].principalAed);
  });

  it("ending balance reaches ~0 by the final year (±1 AED)", () => {
    expect(Math.abs(rows[24].endingBalanceAed)).toBeLessThanOrEqual(1);
  });

  it("sum of annual principal ≈ total principal (within rounding)", () => {
    const principal = rows.reduce((s, r) => s + r.principalAed, 0);
    expect(Math.abs(principal - 3_150_000)).toBeLessThanOrEqual(rows.length);
  });
});

/* cashToClose — table rows and totals match the design's worked example. */

describe("cashToClose", () => {
  const inputs = {
    pricePropertyAed: 4_200_000,
    downPaymentPct: 0.25,
    annualRatePct: 4.25,
    termYears: 25,
  };
  const result = cashToClose(inputs);

  it("emits every expected line in the design's table", () => {
    expect(result.lines.map((l) => l.key)).toEqual([
      "down_payment",
      "dld_transfer",
      "trustee_office",
      "mortgage_registration",
      "bank_arrangement",
      "property_valuation",
      "bazar_advisory",
      "noc_misc",
    ]);
  });

  it("hits the design's headline numbers", () => {
    // Spot-check the values shown in screens/mortgage.jsx.
    const byKey = Object.fromEntries(result.lines.map((l) => [l.key, l.amountAed]));
    expect(byKey.down_payment).toBe(1_050_000); // 25% of 4.2M
    expect(byKey.dld_transfer).toBe(168_000); // 4% of 4.2M
    expect(byKey.trustee_office).toBe(4_200);
    expect(byKey.mortgage_registration).toBe(7_875); // 0.25% × 3.15M
    expect(byKey.bank_arrangement).toBe(31_500); // 1% × 3.15M
    expect(byKey.bazar_advisory).toBe(63_000); // 1.5% × 4.2M
    expect(byKey.property_valuation).toBe(3_150);
    expect(byKey.noc_misc).toBe(5_800);
  });

  it("total = sum of all lines and is shown as % of price", () => {
    const sum = result.lines.reduce((s, l) => s + l.amountAed, 0);
    expect(result.totalAed).toBe(sum);
    expect(result.pctOfPrice).toBeCloseTo(sum / 4_200_000, 5);
  });

  it("respects a custom advisory percentage", () => {
    const r = cashToClose(inputs, { advisoryPct: 0 });
    const byKey = Object.fromEntries(r.lines.map((l) => [l.key, l.amountAed]));
    expect(byKey.bazar_advisory).toBe(0);
  });

  it("carries the rate behind each rate-derived line, and null otherwise", () => {
    // The percentages e2e/tools-mortgage.spec.ts:21-23 asserts on screen are
    // produced here, so the trailing-zero rule (1.50 -> "1.5%") is pinned in a
    // unit test rather than only by a browser.
    const byKey = Object.fromEntries(result.lines.map((l) => [l.key, l.pct]));
    expect(byKey.down_payment).toBe("25%");
    expect(byKey.dld_transfer).toBe("4%");
    expect(byKey.mortgage_registration).toBe("0.25%");
    expect(byKey.bank_arrangement).toBe("1%");
    expect(byKey.bazar_advisory).toBe("1.5%");
    // Flat statutory fees have no rate to show.
    expect(byKey.trustee_office).toBeNull();
    expect(byKey.property_valuation).toBeNull();
    expect(byKey.noc_misc).toBeNull();
  });
});

/* minDownPaymentPct — UAE Central Bank LTV mapping. */

describe("minDownPaymentPct", () => {
  it("returns 50% for non-residents regardless of price", () => {
    expect(minDownPaymentPct("non_resident", 1_000_000)).toBe(0.5);
    expect(minDownPaymentPct("non_resident", 10_000_000)).toBe(0.5);
  });

  it("uses 25% for UAE residents under AED 5M, 35% at or above", () => {
    expect(minDownPaymentPct("uae_resident", 4_999_999)).toBe(0.25);
    expect(minDownPaymentPct("uae_resident", 5_000_000)).toBe(0.35);
  });

  it("treats GCC nationals like UAE residents", () => {
    expect(minDownPaymentPct("gcc_national", 4_999_999)).toBe(0.25);
    expect(minDownPaymentPct("gcc_national", 7_000_000)).toBe(0.35);
  });
});

/* affordability — CB UAE 50% DBR. */

describe("affordability", () => {
  it("returns null when no income is provided", () => {
    expect(affordability(0, 5_000)).toBeNull();
  });

  it("flags ≤40% DBR as ok", () => {
    // 17,065/mo on a 1.2M/yr income → ~17% DBR.
    const a = affordability(1_200_000, 17_065)!;
    expect(a.status).toBe("ok");
    expect(a.dbr).toBeCloseTo(0.17, 2);
  });

  it("flags 40–50% DBR as stretched", () => {
    // 4500/mo on 120K/yr → 45% DBR.
    const a = affordability(120_000, 4_500)!;
    expect(a.status).toBe("stretched");
  });

  it("flags >50% DBR as over", () => {
    // 6,000/mo on 120K/yr → 60% DBR.
    const a = affordability(120_000, 6_000)!;
    expect(a.status).toBe("over");
    expect(a.dbr).toBeCloseTo(0.6, 2);
  });
});

/**
 * Everything below overrides the assumptions. The point of the suite above is
 * that the model computes what it always did when nothing is passed; the point
 * here is that Settings → Mortgage reaches every figure it claims to.
 */
describe("editable assumptions", () => {
  const bump = (patch: Partial<typeof DEFAULT_MORTGAGE_ASSUMPTIONS>) => ({
    ...DEFAULT_MORTGAGE_ASSUMPTIONS,
    ...patch,
  });
  const inputs = {
    pricePropertyAed: 4_000_000,
    downPaymentPct: 0.25,
    annualRatePct: 4.25,
    termYears: 25,
  };

  it("re-rates the DLD line and re-totals the table", () => {
    const base = cashToClose(inputs);
    const raised = cashToClose(inputs, {
      assumptions: bump({ dldTransferPct: 0.05 }),
    });
    const line = (c: typeof base) =>
      c.lines.find((l) => l.key === "dld_transfer")!;
    expect(line(base).amountAed).toBe(160_000);
    expect(line(raised).amountAed).toBe(200_000);
    expect(line(raised).pct).toBe("5%");
    // The total is derived, not stored — a fee change must move it.
    expect(raised.totalAed - base.totalAed).toBe(40_000);
  });

  it("re-rates the flat fees, which take no percentage", () => {
    const c = cashToClose(inputs, {
      assumptions: bump({ trusteeOfficeFeeAed: 4_400 }),
    });
    const line = c.lines.find((l) => l.key === "trustee_office")!;
    expect(line.amountAed).toBe(4_400);
    expect(line.pct).toBeNull();
  });

  it("keeps the explicit advisoryPct override winning over the assumptions", () => {
    // The PDF route and the compare tool pass a negotiated advisory rate per
    // scenario. That is a per-deal number, not a house default, so it must not
    // be overwritten by the settings value.
    const c = cashToClose(inputs, {
      advisoryPct: 0.01,
      assumptions: bump({ bazarAdvisoryPct: 0.02 }),
    });
    expect(c.lines.find((l) => l.key === "bazar_advisory")!.pct).toBe("1%");
  });

  it("moves the LTV tier threshold", () => {
    const a = bump({ ltvHighTierPriceAed: 3_000_000 });
    // 4M is below the built-in 5M threshold and above the edited 3M one.
    expect(minDownPaymentPct("uae_resident", 4_000_000)).toBe(0.25);
    expect(minDownPaymentPct("uae_resident", 4_000_000, a)).toBe(0.35);
  });

  it("moves each LTV tier's own figure", () => {
    const a = bump({ minDownNonResidentPct: 0.45 });
    expect(minDownPaymentPct("non_resident", 1_000_000, a)).toBe(0.45);
  });

  it("moves the DBR bands", () => {
    // 15,000/mo against 50,000/mo income is a DBR of 0.30 — comfortable by
    // default, over the limit once the cap is dragged below it.
    const income = 600_000;
    expect(affordability(income, 15_000)!.status).toBe("ok");
    expect(
      affordability(income, 15_000, bump({ dbrComfortablePct: 0.2, dbrMaxPct: 0.25 }))!
        .status,
    ).toBe("over");
    expect(
      affordability(income, 15_000, bump({ dbrComfortablePct: 0.2, dbrMaxPct: 0.35 }))!
        .status,
    ).toBe("stretched");
  });
});
