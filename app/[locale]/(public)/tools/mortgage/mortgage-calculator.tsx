"use client";

import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { buildMortgageWhatsAppLink } from "@/lib/whatsapp";
import type { ResolvedForm } from "@/lib/forms/types";
import {
  affordability,
  amortizationByYear,
  cashToClose,
  minDownPaymentPct,
  totals,
  type BuyerStatus,
  type MortgageAssumptions,
  type MortgageType,
} from "@/lib/mortgage";
import {
  convertFromAed,
  DEFAULT_PREFERENCES,
  formatMoneyValue,
  toAed,
  usePreferences,
  type Preferences,
} from "@/lib/preferences";
import { ServiceHero } from "../../services/_components/service-hero";
import { MORTGAGE_FORM_ANCHOR } from "@/lib/master-pages/sections/mortgage";
import {
  formatPct,
  parseMoneyInput,
  type SectionCopy,
} from "./_sections/shared";
import {
  ScenarioSection,
  DOWN_MAX_PCT,
  MORTGAGE_TYPES,
} from "./_sections/scenario";
import { AffordabilitySection } from "./_sections/affordability";
import { CompareSection } from "./_sections/compare";
import { AmortizationSection } from "./_sections/amortization";
import { CashToCloseSection } from "./_sections/cash-to-close";
import {
  PreApprovalFormCard,
  PreApprovalSection,
  type PreApprovalCopy,
} from "./_sections/pre-approval";

export type MortgageHeroCopy = {
  eyebrow: string | null;
  title: string | null;
  titleEmphasis: string | null;
  sub: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  /** Draw the pre-approval form in the hero rather than in the closing band. */
  showForm: boolean;
};

/** The four figures the calculator opens on, from Settings → Mortgage. */
export type MortgageOpeningValues = {
  priceAed: number;
  downPaymentPct: number;
  ratePct: number;
  termYears: number;
  annualIncomeAed: number;
};

type Props = {
  /** Enabled section keys, in the order Pages & blocks puts them. */
  order: string[];
  hero: MortgageHeroCopy;
  scenario: SectionCopy;
  affordabilityCopy: SectionCopy;
  compare: SectionCopy;
  amortization: SectionCopy;
  cashToCloseCopy: SectionCopy;
  preApproval: PreApprovalCopy;
  preApprovalForm: ResolvedForm;
  assumptions: MortgageAssumptions;
  opening: MortgageOpeningValues;
};

/**
 * The mortgage tool: one owner of the scenario, many sections drawing it.
 *
 * The page used to be a masthead over a single slab — every input on a sticky
 * rail, four unrelated outputs stacked beside it. It is now six sections an
 * editor can reorder, rename or switch off, and this component is what makes
 * that safe: the scenario lives HERE, above all of them, so switching off
 * Amortization cannot take the term away from Compare, and reordering cannot
 * put an output before the input it reads.
 *
 * `order` is the arrangement from Pages & blocks, already filtered to the
 * enabled sections. A key with no node — one an editor arranged before it was
 * renamed in code — renders nothing rather than throwing.
 *
 * All state stays in AED, because `lib/mortgage.ts` is AED-denominated rather
 * than merely AED-scaled: `minDownPaymentPct` turns on a dirham LTV threshold
 * and the assumptions carry flat dirham fee schedules. Converting the model's
 * inputs would move a statutory threshold. Only what reaches the screen
 * converts.
 */
export function MortgageCalculator({
  order,
  hero,
  scenario,
  affordabilityCopy,
  compare,
  amortization,
  cashToCloseCopy,
  preApproval,
  preApprovalForm,
  assumptions,
  opening,
}: Props) {
  const t = useTranslations("tools");
  const { prefs } = usePreferences();

  /** An AED figure as bare digits, for an input the visitor types into. */
  const toInput = (n: number) =>
    Math.round(convertFromAed(n, prefs.currency)).toLocaleString("en-US");
  /** What they typed, back to AED for the model. */
  const fromInput = (raw: string) =>
    Math.round(toAed(parseMoneyInput(raw), prefs.currency));

  // Opening values, not defaults-for-ever: `useState` reads them once, so an
  // admin changing the house rate moves where the page starts without
  // resetting a visitor mid-session.
  const [price, setPrice] = useState(opening.priceAed);
  const [downPct, setDownPct] = useState(opening.downPaymentPct);
  const [annualRatePct, setAnnualRatePct] = useState(opening.ratePct);
  const [termYears, setTermYears] = useState<number>(opening.termYears);
  const [mortgageType, setMortgageType] = useState<MortgageType>("fixed");
  const [buyerStatus, setBuyerStatus] = useState<BuyerStatus>("uae_resident");
  const [annualIncome, setAnnualIncome] = useState<number>(
    opening.annualIncomeAed,
  );

  const inputs = useMemo(
    () => ({
      pricePropertyAed: price,
      downPaymentPct: downPct,
      annualRatePct,
      termYears,
    }),
    [price, downPct, annualRatePct, termYears],
  );

  const summary = useMemo(() => totals(inputs), [inputs]);
  const closing = useMemo(
    () => cashToClose(inputs, { assumptions }),
    [inputs, assumptions],
  );
  const schedule = useMemo(() => amortizationByYear(inputs), [inputs]);
  const afford = useMemo(
    () => affordability(annualIncome, summary.monthlyPaymentAed, assumptions),
    [annualIncome, summary.monthlyPaymentAed, assumptions],
  );
  const minDown = minDownPaymentPct(buyerStatus, price, assumptions);
  /** The DBR cap as a whole number, for the sentences that quote it. */
  const dbrCapPct = Math.round(assumptions.dbrMaxPct * 100);

  // Three preset scenarios: "current", "more upfront", "shorter term".
  const scenarios = useMemo(() => {
    const altDownPct = Math.min(DOWN_MAX_PCT, Math.max(downPct + 0.15, 0.4));
    const shorterTerm = Math.max(5, Math.min(termYears - 10, 15));
    const alt = totals({ ...inputs, downPaymentPct: altDownPct });
    const short = totals({ ...inputs, termYears: shorterTerm });
    return [
      {
        key: "current",
        name: t("mortgage.scenarioCurrent"),
        sub: t("mortgage.scenarioSub", {
          years: termYears,
          rate: formatPct(annualRatePct / 100),
          down: formatPct(downPct),
        }),
        monthly: summary.monthlyPaymentAed,
        total: summary.totalPaidAed,
        active: true,
      },
      {
        key: "more_upfront",
        name: t("mortgage.scenarioMoreUpfront"),
        sub: t("mortgage.scenarioSub", {
          years: termYears,
          rate: formatPct(annualRatePct / 100),
          down: formatPct(altDownPct),
        }),
        monthly: alt.monthlyPaymentAed,
        total: alt.totalPaidAed,
        active: false,
      },
      {
        key: "shorter_term",
        name: t("mortgage.scenarioShorterTerm"),
        sub: t("mortgage.scenarioSub", {
          years: shorterTerm,
          rate: formatPct(annualRatePct / 100),
          down: formatPct(downPct),
        }),
        monthly: short.monthlyPaymentAed,
        total: short.totalPaidAed,
        active: false,
      },
    ];
  }, [
    t,
    inputs,
    summary.monthlyPaymentAed,
    summary.totalPaidAed,
    annualRatePct,
    downPct,
    termYears,
  ]);

  /**
   * The scenario, once, as label/value pairs — built for a given currency.
   *
   * The recap the visitor reads and the block the advisor reads come from this
   * one builder on purpose: two hand-written copies of the same six numbers
   * would drift the first time anyone adds a line to one of them. They differ
   * only in what they are rendered *in* — the visitor sees their own currency,
   * the advisor always sees AED (see `advisorLines` below).
   *
   * `ScenarioWording` is the whole surface where the two diverge: everything
   * else in the table is a bare figure.
   */
  type ScenarioWording = {
    deposit(pct: string, amount: string): string;
    term(years: number, rate: number, type: MortgageType): string;
  };

  const buildScenarioLines = useCallback(
    (p: Preferences, w: ScenarioWording): { key: string; value: string }[] => {
      const m = (n: number) => formatMoneyValue(n, p);
      return [
        { key: "linePropertyPrice", value: m(price) },
        {
          key: "lineDeposit",
          value: w.deposit(formatPct(downPct), m(Math.round(price * downPct))),
        },
        { key: "lineLoanAmount", value: m(summary.principalAed) },
        {
          key: "lineTerm",
          value: w.term(termYears, annualRatePct, mortgageType),
        },
        { key: "lineMonthlyPayment", value: m(summary.monthlyPaymentAed) },
        { key: "lineCashToClose", value: m(closing.totalAed) },
      ];
    },
    [
      price,
      downPct,
      summary.principalAed,
      summary.monthlyPaymentAed,
      termYears,
      annualRatePct,
      mortgageType,
      closing.totalAed,
    ],
  );

  /** The loan type as it reads mid-sentence: "…at 4.25% fixed". */
  const inlineType = useCallback(
    (v: MortgageType) =>
      t(`mortgage.${MORTGAGE_TYPES.find((x) => x.value === v)!.inlineKey}`),
    [t],
  );

  const visitorWording: ScenarioWording = useMemo(
    () => ({
      deposit: (pct, amount) => t("mortgage.lineDepositValue", { pct, amount }),
      term: (years, rate, type) =>
        t("mortgage.lineTermValue", { years, rate, type: inlineType(type) }),
    }),
    [t, inlineType],
  );

  const scenarioLines = useMemo(
    () => buildScenarioLines(prefs, visitorWording),
    [buildScenarioLines, prefs, visitorWording],
  );

  /**
   * The same six rows, pinned to AED and to English, deliberately.
   *
   * Everything built from this leaves the browser for the Bazar mortgage desk.
   * A brief saying "$1.14M" makes the desk convert back, and an error in that
   * direction is a commercial one; the wording follows the same rule for the
   * same reason, so an Arabic-reading buyer still produces a brief the desk
   * can act on.
   */
  const advisorLines = useMemo(
    () =>
      buildScenarioLines(DEFAULT_PREFERENCES, {
        deposit: (pct, amount) => `${pct} · ${amount}`,
        term: (years, rate, type) => `${years} years at ${rate}% ${type}`,
      }),
    [buildScenarioLines],
  );

  const ADVISOR_LABELS: Record<string, string> = {
    linePropertyPrice: "Property price",
    lineDeposit: "Deposit",
    lineLoanAmount: "Loan amount",
    lineTerm: "Term",
    lineMonthlyPayment: "Monthly payment",
    lineCashToClose: "Cash to close",
  };

  // Read at submit time, not at mount time — see `scenario` on
  // `FormSubmitContext`. Nudging the price slider after typing an email must
  // update the brief without resetting the form.
  const scenarioBrief = advisorLines
    .map(({ key, value }) => `${ADVISOR_LABELS[key]}: ${value}`)
    .join("\n");

  // Pre-fill the WhatsApp handoff with the current scenario so the mortgage
  // team opens the chat already knowing what to quote.
  const aed = (n: number) => formatMoneyValue(n, DEFAULT_PREFERENCES);
  const waLink = buildMortgageWhatsAppLink(
    [
      `Hi Bazar — I'd like to start a mortgage pre-approval.`,
      ``,
      `Property price: ${aed(price)}`,
      `Down payment: ${formatPct(downPct)} (${aed(Math.round(price * downPct))})`,
      `Term: ${termYears} years`,
      `Rate target: ${annualRatePct}%`,
      `Monthly: ${aed(summary.monthlyPaymentAed)}`,
    ].join("\n"),
  );

  // Switched off in /admin/forms ⇒ the hero is copy alone and the closing band
  // falls back to the WhatsApp-and-advisor row it was before the form existed.
  const formInHero = hero.showForm && preApprovalForm.enabled;

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <ServiceHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        titleEmphasis={hero.titleEmphasis}
        sub={hero.sub}
        imageUrl={hero.imageUrl}
        imageAlt={hero.imageAlt}
        formAnchor={MORTGAGE_FORM_ANCHOR}
        form={
          formInHero ? (
            <PreApprovalFormCard
              form={preApprovalForm}
              scenarioBrief={scenarioBrief}
            />
          ) : null
        }
      />
    ),

    scenario: (
      <ScenarioSection
        copy={scenario}
        prefs={prefs}
        price={price}
        downPct={downPct}
        annualRatePct={annualRatePct}
        termYears={termYears}
        mortgageType={mortgageType}
        buyerStatus={buyerStatus}
        minDown={minDown}
        ltvHighTierPriceAed={assumptions.ltvHighTierPriceAed}
        summary={summary}
        onPrice={setPrice}
        onDownPct={setDownPct}
        onRate={setAnnualRatePct}
        onTerm={setTermYears}
        onType={setMortgageType}
        onStatus={setBuyerStatus}
        toInput={toInput}
        fromInput={fromInput}
      />
    ),

    affordability: (
      <AffordabilitySection
        copy={affordabilityCopy}
        prefs={prefs}
        annualIncome={annualIncome}
        onIncome={setAnnualIncome}
        monthlyPaymentAed={summary.monthlyPaymentAed}
        afford={afford}
        dbrCapPct={dbrCapPct}
        maxDbr={assumptions.dbrMaxPct}
        toInput={toInput}
        fromInput={fromInput}
      />
    ),

    compare: (
      <CompareSection copy={compare} prefs={prefs} scenarios={scenarios} />
    ),

    amortization: (
      <AmortizationSection
        copy={amortization}
        schedule={schedule}
        termYears={termYears}
      />
    ),

    cash_to_close: (
      <CashToCloseSection
        copy={cashToCloseCopy}
        prefs={prefs}
        closing={closing}
        pdf={{
          input: {
            property_price_aed: price,
            down_payment_pct: Math.round(downPct * 100),
            rate_pct: annualRatePct,
            term_years: termYears,
            loan_type: mortgageType,
            buyer_status: buyerStatus,
          },
          result: {
            loan_amount_aed: summary.principalAed,
            monthly_payment_aed: summary.monthlyPaymentAed,
            total_interest_aed: summary.totalInterestAed,
            total_cost_aed: summary.totalPaidAed,
            dbr_pct: afford ? Math.round(afford.dbr * 100) : null,
          },
        }}
      />
    ),

    pre_approval: (
      <PreApprovalSection
        copy={preApproval}
        form={preApprovalForm}
        scenarioLines={scenarioLines}
        scenarioBrief={scenarioBrief}
        waLink={waLink}
        formInHero={formInHero}
      />
    ),
  };

  return (
    <>
      {order.map((key) => (
        <React.Fragment key={key}>{nodes[key] ?? null}</React.Fragment>
      ))}
    </>
  );
}
