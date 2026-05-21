/**
 * Pure mortgage math — no React, no DOM. Lives outside the (public) route
 * group so the same helpers power /tools/mortgage today and a pre-approval
 * server action later.
 *
 * Conventions
 *   · all monetary values are AED unless noted
 *   · `annualRatePct` is a percentage (4.25 means 4.25%, not 0.0425)
 *   · `termYears` is a whole number of years
 *   · results round to whole AED — the UI never displays fills smaller
 *     than a dirham, and downstream sums stay associative under rounding
 *
 * The amortization schedule and totals are derived analytically from the
 * standard mortgage formula. We intentionally avoid month-by-month
 * recursion for `totals()` so the tests don't need to tolerate ±1 AED
 * drift from compounded rounding.
 */

export type MortgageType = "fixed" | "variable" | "hybrid";
export type BuyerStatus = "uae_resident" | "non_resident" | "gcc_national";

export type MortgageInputs = {
  /** Property price in AED. */
  pricePropertyAed: number;
  /** Down payment as a fraction of the price (0.25 = 25%). */
  downPaymentPct: number;
  /** Annual interest rate as a percentage (4.25 means 4.25%). */
  annualRatePct: number;
  /** Loan term in whole years. */
  termYears: number;
};

export type CashToCloseLine = {
  /** Stable key — used as the React list key and by tests. */
  key: string;
  /** Display label, free-form. */
  label: string;
  /** Note in the right-hand column. */
  note: string;
  amountAed: number;
};

export type CashToClose = {
  lines: CashToCloseLine[];
  totalAed: number;
  /** Share of property price the buyer needs at closing, 0..1. */
  pctOfPrice: number;
};

/* ────────────────────────────────────────────────────────────────
 * Core formula
 * ───────────────────────────────────────────────────────────────*/

/** Monthly payment on a fully-amortising loan. Returns 0 for zero-principal. */
export function monthlyPayment(
  principalAed: number,
  annualRatePct: number,
  termYears: number,
): number {
  if (principalAed <= 0) return 0;
  if (termYears <= 0) return 0;

  const n = termYears * 12;
  const r = annualRatePct / 100 / 12;

  // 0% interest is just principal / months — guard against div-by-zero.
  if (r === 0) return round(principalAed / n);

  const factor = Math.pow(1 + r, n);
  const payment = (principalAed * r * factor) / (factor - 1);
  return round(payment);
}

/** Loan summary: monthly payment, total interest, total paid, principal share. */
export function totals(inputs: MortgageInputs) {
  const principal = round(
    inputs.pricePropertyAed * (1 - clampPct(inputs.downPaymentPct)),
  );
  const monthly = monthlyPayment(
    principal,
    inputs.annualRatePct,
    inputs.termYears,
  );
  const totalPaid = round(monthly * inputs.termYears * 12);
  const totalInterest = Math.max(0, totalPaid - principal);
  const principalSharePct =
    totalPaid === 0 ? 0 : round1((principal / totalPaid) * 100);
  return {
    principalAed: principal,
    monthlyPaymentAed: monthly,
    totalPaidAed: totalPaid,
    totalInterestAed: totalInterest,
    principalSharePct,
  };
}

/* ────────────────────────────────────────────────────────────────
 * Amortization schedule (annual buckets — what the chart renders)
 * ───────────────────────────────────────────────────────────────*/

export type AmortYear = {
  year: number;
  principalAed: number;
  interestAed: number;
  endingBalanceAed: number;
};

/**
 * Year-by-year split of principal vs interest payments. Computed by walking
 * the schedule month by month, then aggregating into annual buckets. The
 * stacked bar chart maps year → (principal, interest) heights.
 */
export function amortizationByYear(inputs: MortgageInputs): AmortYear[] {
  const principal = inputs.pricePropertyAed * (1 - clampPct(inputs.downPaymentPct));
  const r = inputs.annualRatePct / 100 / 12;
  const n = inputs.termYears * 12;
  const monthly = monthlyPayment(
    principal,
    inputs.annualRatePct,
    inputs.termYears,
  );

  const out: AmortYear[] = [];
  let balance = principal;
  let yearPrincipal = 0;
  let yearInterest = 0;

  for (let month = 1; month <= n; month++) {
    const interest = r === 0 ? 0 : balance * r;
    const principalPaid = Math.min(balance, monthly - interest);
    balance -= principalPaid;
    yearPrincipal += principalPaid;
    yearInterest += interest;

    if (month % 12 === 0) {
      out.push({
        year: month / 12,
        principalAed: round(yearPrincipal),
        interestAed: round(yearInterest),
        endingBalanceAed: round(Math.max(0, balance)),
      });
      yearPrincipal = 0;
      yearInterest = 0;
    }
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────
 * Cash to close
 * ───────────────────────────────────────────────────────────────*/

const STATUTORY = {
  /** Trustee office fee — flat in AED, sometimes 4,000 in Dubai but the
   *  4,200 figure matches what Abu Dhabi DARI/DMT charges in practice. */
  trusteeOfficeFeeAed: 4_200,
  /** NOC and misc disbursements, rough flat estimate. */
  nocMiscAed: 5_800,
  /** Property valuation fee, bank-selected. */
  propertyValuationAed: 3_150,
  /** DLD transfer fee as a fraction of price. */
  dldTransferPct: 0.04,
  /** DLD mortgage registration as a fraction of loan principal. */
  mortgageRegistrationPct: 0.0025,
  /** Bank arrangement fee — negotiable; show the headline 1%. */
  bankArrangementPct: 0.01,
  /** Bazar advisory — capped 1.5%. */
  bazarAdvisoryPct: 0.015,
} as const;

/** Buyer-status-aware down payment guidance (UAE Central Bank LTV rules). */
export function minDownPaymentPct(
  status: BuyerStatus,
  priceAed: number,
): number {
  // CB UAE rules (paraphrased):
  //   · UAE national, first property < 5M:   20%
  //   · UAE national, first property ≥ 5M:   30%
  //   · UAE expat (resident), first < 5M:    25%
  //   · UAE expat (resident), first ≥ 5M:    35%
  //   · Non-resident:                        50% (per most lenders)
  //   · GCC national: same as UAE resident expat.
  const highTier = priceAed >= 5_000_000;
  switch (status) {
    case "non_resident":
      return 0.5;
    case "uae_resident":
    case "gcc_national":
      return highTier ? 0.35 : 0.25;
  }
}

export function cashToClose(
  inputs: MortgageInputs,
  opts?: { advisoryPct?: number },
): CashToClose {
  const downPct = clampPct(inputs.downPaymentPct);
  const downPayment = round(inputs.pricePropertyAed * downPct);
  const principal = round(inputs.pricePropertyAed - downPayment);
  const advisoryPct = opts?.advisoryPct ?? STATUTORY.bazarAdvisoryPct;

  const lines: CashToCloseLine[] = [
    {
      key: "down_payment",
      label: `Down payment · ${pct(downPct)}`,
      note: "Lender requirement",
      amountAed: downPayment,
    },
    {
      key: "dld_transfer",
      label: `DLD transfer fee · ${pct(STATUTORY.dldTransferPct)}`,
      note: "Statutory",
      amountAed: round(inputs.pricePropertyAed * STATUTORY.dldTransferPct),
    },
    {
      key: "trustee_office",
      label: "Trustee office fee",
      note: "Statutory",
      amountAed: STATUTORY.trusteeOfficeFeeAed,
    },
    {
      key: "mortgage_registration",
      label: `Mortgage registration · ${pct(STATUTORY.mortgageRegistrationPct)}`,
      note: "DLD",
      amountAed: round(principal * STATUTORY.mortgageRegistrationPct),
    },
    {
      key: "bank_arrangement",
      label: `Bank arrangement fee · ${pct(STATUTORY.bankArrangementPct)}`,
      note: "Negotiable",
      amountAed: round(principal * STATUTORY.bankArrangementPct),
    },
    {
      key: "property_valuation",
      label: "Property valuation",
      note: "Bank-selected",
      amountAed: STATUTORY.propertyValuationAed,
    },
    {
      key: "bazar_advisory",
      label: `Bazar advisory · ${pct(advisoryPct)}`,
      note: "Capped",
      amountAed: round(inputs.pricePropertyAed * advisoryPct),
    },
    {
      key: "noc_misc",
      label: "NOC & misc.",
      note: "—",
      amountAed: STATUTORY.nocMiscAed,
    },
  ];

  const totalAed = lines.reduce((sum, l) => sum + l.amountAed, 0);
  const pctOfPrice =
    inputs.pricePropertyAed === 0 ? 0 : totalAed / inputs.pricePropertyAed;
  return { lines, totalAed, pctOfPrice };
}

/* ────────────────────────────────────────────────────────────────
 * Affordability (CB UAE 50% DBR guideline)
 * ───────────────────────────────────────────────────────────────*/

export type Affordability = {
  /** Monthly income (AED). */
  monthlyIncomeAed: number;
  /** Debt-burden ratio: monthly payment ÷ monthly income, as a fraction. */
  dbr: number;
  status: "ok" | "stretched" | "over";
  /** Headline copy the result card can render. */
  label: string;
};

/**
 * Central Bank UAE caps total monthly debt servicing at 50% of monthly
 * income. We treat mortgage-alone-above-50% as "over", 40–50% as
 * "stretched", below 40% as "ok".
 */
export function affordability(
  annualIncomeAed: number,
  monthlyPaymentAed: number,
): Affordability | null {
  if (annualIncomeAed <= 0) return null;
  const monthlyIncome = annualIncomeAed / 12;
  const dbr = monthlyPaymentAed / monthlyIncome;
  let status: Affordability["status"];
  if (dbr <= 0.4) status = "ok";
  else if (dbr <= 0.5) status = "stretched";
  else status = "over";

  const dbrPct = Math.round(dbr * 100);
  const label =
    status === "ok"
      ? `Comfortably within affordability · ${dbrPct}% DBR`
      : status === "stretched"
        ? `Within the 50% DBR cap, but stretched · ${dbrPct}% DBR`
        : `Above the 50% DBR cap · ${dbrPct}% DBR`;
  return { monthlyIncomeAed: round(monthlyIncome), dbr, status, label };
}

/* ────────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────────*/

function round(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampPct(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(1, p));
}

function pct(p: number): string {
  const v = p * 100;
  if (Math.abs(v - Math.round(v)) < 0.005) return `${Math.round(v)}%`;
  // Trim trailing zeros so 1.50% renders as 1.5% and 0.250% as 0.25%.
  const fixed = v.toFixed(2).replace(/\.?0+$/, "");
  return `${fixed}%`;
}
