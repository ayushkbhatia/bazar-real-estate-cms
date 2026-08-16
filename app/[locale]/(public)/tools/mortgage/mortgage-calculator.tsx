"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useIsRtl } from "@/lib/dom/use-is-rtl";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Download,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildMortgageWhatsAppLink } from "@/lib/whatsapp";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ResolvedForm } from "@/lib/forms/types";
import { FormRenderer } from "@/app/[locale]/(public)/_components/forms/form-renderer";
import { DbrGauge } from "./_components/dbr-gauge";
import { pdfLabel } from "@/lib/pdf/language-note";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/locales";
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
  currencySymbol,
  DEFAULT_PREFERENCES,
  formatMoneyValue,
  formatPrice,
  toAed,
  usePreferences,
  type Preferences,
} from "@/lib/preferences";

const PRICE_MIN = 500_000;
const PRICE_MAX = 50_000_000;
const DOWN_MIN_PCT = 0.15;
const DOWN_MAX_PCT = 0.8;

/**
 * Message keys, not labels.
 *
 * Two forms per mortgage type because the copy uses both: `typeFixed` is a
 * button ("Fixed"), `typeFixedInline` is the tail of a sentence ("…at 4.25%
 * fixed"). English gets there with `.toLowerCase()`; Arabic has no case, so a
 * lowercased label is not a form the language has. Two keys is the only
 * version of this that survives translation — and it also fixes the sentence,
 * which until now interpolated the raw enum and rendered "fixed" by accident
 * rather than by choice.
 */
const MORTGAGE_TYPES: {
  value: MortgageType;
  key: string;
  inlineKey: string;
}[] = [
  { value: "fixed", key: "typeFixed", inlineKey: "typeFixedInline" },
  { value: "variable", key: "typeVariable", inlineKey: "typeVariableInline" },
  { value: "hybrid", key: "typeHybrid", inlineKey: "typeHybridInline" },
];

const BUYER_STATUSES: { value: BuyerStatus; key: string }[] = [
  { value: "uae_resident", key: "statusUaeResident" },
  { value: "non_resident", key: "statusNonResident" },
  { value: "gcc_national", key: "statusGccNational" },
];

/**
 * The note beside each closing line. `noc_misc` has none — the em-dash the
 * table renders in its place is typography, not copy, so it never reaches the
 * catalogue where it would fail the "Arabic differs from English" rule for a
 * character that is the same in both.
 */
const CASH_NOTE_KEYS = new Set([
  "down_payment",
  "dld_transfer",
  "trustee_office",
  "mortgage_registration",
  "bank_arrangement",
  "property_valuation",
  "bazar_advisory",
]);

const TERM_OPTIONS = [25, 20, 15, 10] as const;

/**
 * Money in the visitor's currency.
 *
 * All state in this component stays AED, because `lib/mortgage.ts` is
 * AED-denominated rather than merely AED-scaled: `minDownPaymentPct` turns on
 * the CBUAE LTV tier at a dirham price, and `MortgageAssumptions` carries flat
 * dirham fee schedules (trustee office, NOC, valuation). Converting the
 * model's inputs would move a statutory threshold. Only what reaches the
 * screen converts.
 */

function formatPct(p: number): string {
  if (!Number.isFinite(p)) return "0%";
  const v = p * 100;
  if (Math.abs(v - Math.round(v)) < 0.05) return `${Math.round(v)}%`;
  return `${v.toFixed(1)}%`;
}

/** Strip grouping and currency glyphs from a typed figure. */
function parseMoneyInput(s: string): number {
  const cleaned = s.replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * The pre-approval band's words, resolved from Pages & blocks by the page.
 *
 * Every entry is nullable because a master-page field is nullable: an editor
 * who clears the eyebrow means "no eyebrow", not "fall back to the one I just
 * deleted". The band renders around whatever survives.
 */
export type PreApprovalBandCopy = {
  enabled: boolean;
  eyebrow: string | null;
  title: string | null;
  sub: string | null;
  scenarioLabel: string | null;
  scenarioNote: string | null;
  talkLabel: string | null;
  advisorCtaLabel: string | null;
  advisorCtaHref: string;
  whatsappCtaLabel: string | null;
  fallbackCtaLabel: string | null;
};

/** The four figures the calculator opens on, from Settings → Mortgage. */
export type MortgageOpeningValues = {
  priceAed: number;
  downPaymentPct: number;
  ratePct: number;
  termYears: number;
  annualIncomeAed: number;
};

export function MortgageCalculator({
  preApprovalForm,
  band,
  assumptions,
  opening,
}: {
  preApprovalForm: ResolvedForm;
  band: PreApprovalBandCopy;
  assumptions: MortgageAssumptions;
  opening: MortgageOpeningValues;
}) {
  const t = useTranslations("tools");
  const { prefs } = usePreferences();
  /** An AED figure, rendered in the visitor's currency. */
  const formatAed = (n: number) =>
    Number.isFinite(n) ? formatMoneyValue(n, prefs) : formatMoneyValue(0, prefs);
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
  const belowGuidance = downPct < minDown;

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
   */
  /**
   * How the two composite rows are worded. Everything else in the table is a
   * bare figure, so this is the whole surface where the visitor's copy and the
   * advisor's brief have to diverge — see `advisorLines`.
   */
  type ScenarioWording = {
    deposit(pct: string, amount: string): string;
    term(years: number, rate: number, type: MortgageType): string;
  };

  const buildScenarioLines = useCallback(
    (p: Preferences, w: ScenarioWording): { key: string; value: string }[] => {
      const money = (n: number) => formatMoneyValue(n, p);
      return [
        { key: "linePropertyPrice", value: money(price) },
        {
          key: "lineDeposit",
          value: w.deposit(
            formatPct(downPct),
            money(Math.round(price * downPct)),
          ),
        },
        { key: "lineLoanAmount", value: money(summary.principalAed) },
        {
          key: "lineTerm",
          value: w.term(termYears, annualRatePct, mortgageType),
        },
        { key: "lineMonthlyPayment", value: money(summary.monthlyPaymentAed) },
        { key: "lineCashToClose", value: money(closing.totalAed) },
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
      deposit: (pct, amount) =>
        t("mortgage.lineDepositValue", { pct, amount }),
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
   * The same scenario pinned to AED, for everything that leaves the browser.
   * A Bazar mortgage advisor reads these and quotes in dirhams; a brief saying
   * "$1.14M" makes the desk convert back, and an error in that direction is a
   * commercial one.
   */
  /**
   * The same six rows, in English, deliberately — labels as well as figures.
   *
   * Everything built from this leaves the browser for the Bazar mortgage desk,
   * which is already why it is pinned to AED rather than the visitor's
   * currency. The wording follows the same rule for the same reason: an
   * Arabic-reading buyer still produces a brief the desk can act on, and the
   * desk works in English. It reuses the one builder rather than a second copy
   * of the six numbers, which is what that builder is for.
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

  // Pre-fill the WhatsApp handoff with the user's current scenario so the
  // mortgage team opens the chat already knowing what to quote.
  const aed = (n: number) => formatMoneyValue(n, DEFAULT_PREFERENCES);
  const waMessage = [
    `Hi Bazar — I'd like to start a mortgage pre-approval.`,
    ``,
    `Property price: ${aed(price)}`,
    `Down payment: ${formatPct(downPct)} (${aed(Math.round(price * downPct))})`,
    `Term: ${termYears} years`,
    `Rate target: ${annualRatePct}%`,
    `Monthly: ${aed(summary.monthlyPaymentAed)}`,
  ].join("\n");
  const waLink = buildMortgageWhatsAppLink(waMessage);

  // Switched off in /admin/forms ⇒ the band falls back to the WhatsApp-and-
  // advisor row it was before the form existed, rather than to an empty column.
  const showPreApprovalForm = preApprovalForm.enabled;

  return (
    <>
    <section className="px-4 md:px-12 pb-12 grid lg:grid-cols-[440px_1fr] gap-10 items-start [&>*]:min-w-0">
      {/* ── LEFT: inputs ───────────────────────────────────────── */}
      <div className="border border-bz-border bg-bz-surface rounded-lg p-6 md:p-7 lg:sticky lg:top-6">
        <Eyebrow>{t("mortgage.scenario")}</Eyebrow>

        <fieldset className="mt-5">
          <Label htmlFor="price">
            {t("mortgage.propertyPrice", {
              symbol: currencySymbol(prefs.currency),
            })}
          </Label>
          <Input
            id="price"
            inputMode="numeric"
            className="mt-1.5 mono text-[18px] h-12"
            value={toInput(price)}
            onChange={(e) => {
              const next = fromInput(e.target.value);
              setPrice(Math.max(PRICE_MIN, Math.min(PRICE_MAX, next)));
            }}
            aria-label={t("mortgage.propertyPriceAria", {
              currency: prefs.currency,
            })}
          />
          <input
            type="range"
            min={PRICE_MIN}
            max={10_000_000}
            step={50_000}
            value={Math.min(price, 10_000_000)}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-full mt-3 accent-bz-accent"
            aria-label={t("mortgage.propertyPriceSlider")}
          />
          {/* Slider bounds and step stay AED; only the ticks convert. */}
          <div className="flex justify-between text-[11px] text-bz-muted mt-1">
            <span>{formatPrice(PRICE_MIN, prefs)}</span>
            <span>{formatPrice(10_000_000, prefs)}</span>
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <Label htmlFor="down">
            {t("mortgage.downPayment", { pct: formatPct(downPct) })}
          </Label>
          <Input
            id="down"
            readOnly
            className="mt-1.5 mono text-[15px]"
            value={formatAed(Math.round(price * downPct))}
            aria-label={t("mortgage.downPaymentAria", { currency: "AED" })}
          />
          <input
            type="range"
            min={DOWN_MIN_PCT * 100}
            max={DOWN_MAX_PCT * 100}
            step={1}
            value={Math.round(downPct * 100)}
            onChange={(e) => setDownPct(Number(e.target.value) / 100)}
            className="w-full mt-3 accent-bz-accent"
            aria-label={t("mortgage.downPaymentSlider")}
          />
          <div className="flex justify-between text-[11px] text-bz-muted mt-1">
            <span>15%</span>
            <span>80%</span>
          </div>
          {belowGuidance ? (
            <p className="text-[12px] text-bz-warning mt-1.5">
              {/*
                Three whole sentences rather than one glued to two conditional
                tails. The tails carried the full stop, so translating the stem
                alone would leave the punctuation stranded on the English side
                of the join — and Arabic cannot necessarily put the qualifying
                clause where English puts it anyway.
              */}
              {t(
                price < 5_000_000
                  ? "mortgage.belowGuidance"
                  : prefs.currency === "AED"
                    ? "mortgage.belowGuidanceHighTier"
                    : "mortgage.belowGuidanceHighTierConverted",
                {
                  pct: formatPct(minDown),
                  status: t(
                    `mortgage.${
                      BUYER_STATUSES.find((b) => b.value === buyerStatus)!.key
                    }`,
                  ),
                  converted: formatPrice(5_000_000, prefs),
                },
              )}
            </p>
          ) : null}
        </fieldset>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <fieldset>
            <Label htmlFor="rate">{t("mortgage.interestRate")}</Label>
            <Input
              id="rate"
              className="mt-1.5"
              inputMode="decimal"
              value={annualRatePct}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setAnnualRatePct(Math.max(0, Math.min(20, n)));
              }}
              aria-label={t("mortgage.interestRateAria")}
            />
          </fieldset>
          <fieldset>
            <Label htmlFor="term">{t("mortgage.term")}</Label>
            <Select
              value={String(termYears)}
              onValueChange={(v) => setTermYears(Number(v))}
            >
              <SelectTrigger id="term" className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERM_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {t("mortgage.termYears", { years: y })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>
        </div>

        <fieldset className="mt-5">
          <Label>{t("mortgage.mortgageType")}</Label>
          <div
            className="flex gap-1 mt-1.5"
            role="radiogroup"
            aria-label={t("mortgage.mortgageType")}
          >
            {MORTGAGE_TYPES.map((type) => {
              const active = mortgageType === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMortgageType(type.value)}
                  className={cn(
                    "flex-1 h-10 rounded text-[13px] border transition-colors",
                    active
                      ? "bg-bz-navy text-bz-bg border-bz-navy"
                      : "bg-bz-surface-2 text-bz-ink-2 border-transparent hover:border-bz-border-strong",
                  )}
                >
                  {t(`mortgage.${type.key}`)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <Label>{t("mortgage.buyerStatus")}</Label>
          <div
            className="flex gap-1 mt-1.5"
            role="radiogroup"
            aria-label={t("mortgage.buyerStatus")}
          >
            {BUYER_STATUSES.map((b) => {
              const active = buyerStatus === b.value;
              return (
                <button
                  key={b.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setBuyerStatus(b.value)}
                  className={cn(
                    "flex-1 h-10 rounded text-[11.5px] border transition-colors px-1",
                    active
                      ? "bg-bz-navy text-bz-bg border-bz-navy"
                      : "bg-bz-surface-2 text-bz-ink-2 border-transparent hover:border-bz-border-strong",
                  )}
                >
                  {t(`mortgage.${b.key}`)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="border-t border-bz-border my-6" />

        <Eyebrow>{t("mortgage.optional")}</Eyebrow>
        <fieldset className="mt-3">
          <Label htmlFor="income">
            {t("mortgage.annualIncome", {
              symbol: currencySymbol(prefs.currency),
            })}
          </Label>
          <Input
            id="income"
            inputMode="numeric"
            className="mt-1.5"
            value={toInput(annualIncome)}
            onChange={(e) => setAnnualIncome(Math.max(0, fromInput(e.target.value)))}
            aria-label={t("mortgage.annualIncomeAria", {
              currency: prefs.currency,
            })}
          />
          <p className="text-[11.5px] text-bz-muted mt-1">
            {/*
              The cap is interpolated rather than written into the sentence:
              it is editable under Settings → Mortgage, and a status that flips
              at 45% above a line that still reads "50%" is worse than either
              number on its own.
            */}
            {t("mortgage.affordabilityHelp", { cap: dbrCapPct })}
          </p>
        </fieldset>

        {afford ? (
          <div
            role="status"
            className={cn(
              "mt-3 p-2.5 rounded text-[12px] flex gap-2 items-center",
              afford.status === "ok" && "bg-bz-accent-soft text-bz-accent",
              afford.status === "stretched" &&
                "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
              afford.status === "over" &&
                "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
            )}
            data-testid="affordability"
          >
            <CheckCircle2 size={14} strokeWidth={1.8} />
            {/*
              The headline used to be built inside `affordability()`, which put
              the only three English sentences in an otherwise pure AED model.
              The status comes from the model; the sentence comes from here.
            */}
            <span>
              {t(
                afford.status === "ok"
                  ? "mortgage.affordabilityOk"
                  : afford.status === "stretched"
                    ? "mortgage.affordabilityStretched"
                    : "mortgage.affordabilityOver",
                { pct: Math.round(afford.dbr * 100), cap: dbrCapPct },
              )}
            </span>
          </div>
        ) : null}

        {annualIncome > 0 ? (
          <div className="mt-4">
            <DbrGauge
              monthlyPaymentAed={summary.monthlyPaymentAed}
              monthlyIncomeAed={annualIncome / 12}
              maxDbr={assumptions.dbrMaxPct}
            />
          </div>
        ) : null}
      </div>

      {/* ── RIGHT: results ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* Hero — monthly payment */}
        <div className="bg-bz-ink text-white rounded-xl p-6 md:p-9">
          <Eyebrow className="text-white/70">
            {t("mortgage.monthlyPayment")}
          </Eyebrow>
          <div
            className="serif text-[52px] md:text-[88px] mt-1 leading-none"
            style={{ letterSpacing: "-0.03em" }}
            data-testid="monthly-payment"
          >
            {formatAed(summary.monthlyPaymentAed)}
          </div>
          <p className="text-[14px] text-white/75 mt-3">
            {t("mortgage.borrowedFor", {
              amount: formatAed(summary.principalAed),
              years: termYears,
              rate: annualRatePct,
              type: inlineType(mortgageType),
            })}
          </p>
          <div className="grid grid-cols-3 gap-4 md:gap-6 mt-9 pt-7 border-t border-white/15">
            <Metric
              label={t("mortgage.totalToPay")}
              value={formatAed(summary.totalPaidAed)}
            />
            <Metric
              label={t("mortgage.totalInterest")}
              value={formatAed(summary.totalInterestAed)}
            />
            <Metric
              label={t("mortgage.principalShare")}
              value={`${summary.principalSharePct}%`}
            />
          </div>
        </div>

        {/* Cash to close table */}
        <div className="border border-bz-border bg-bz-surface rounded-lg p-6 md:p-7">
          <div className="flex justify-between items-end mb-4">
            <div>
              <Eyebrow>{t("mortgage.cashEyebrow")}</Eyebrow>
              <h3
                className="serif text-[22px] mt-1"
                style={{ letterSpacing: "-0.01em" }}
              >
                {t("mortgage.cashHeading")}
              </h3>
            </div>
            <MortgagePdfDownload
              input={{
                property_price_aed: price,
                down_payment_pct: Math.round(downPct * 100),
                rate_pct: annualRatePct,
                term_years: termYears,
                loan_type: mortgageType,
                buyer_status: buyerStatus,
              }}
              result={{
                loan_amount_aed: summary.principalAed,
                monthly_payment_aed: summary.monthlyPaymentAed,
                total_interest_aed: summary.totalInterestAed,
                total_cost_aed: summary.totalPaidAed,
                dbr_pct: afford ? Math.round(afford.dbr * 100) : null,
              }}
            />
          </div>
          <table className="w-full text-[13.5px]" data-testid="cash-to-close-table">
            <tbody>
              {closing.lines.map((line) => (
                <tr key={line.key} className="border-b border-bz-border">
                  {/*
                    `pct` is passed to every row, including the flat fees whose
                    message has no placeholder for it. next-intl ignores an
                    unused argument, and the alternative — a conditional call —
                    would make the message key depend on the data rather than
                    on the row, which is what makes a key unfindable by grep.
                  */}
                  <td className="py-2.5 text-bz-ink">
                    {t(`mortgage.cashLine.${line.key}`, {
                      pct: line.pct ?? "",
                    })}
                  </td>
                  <td className="py-2.5 text-end mono">{formatAed(line.amountAed)}</td>
                  <td className="py-2.5 text-end text-[11.5px] text-bz-muted">
                    {CASH_NOTE_KEYS.has(line.key)
                      ? t(`mortgage.cashNote.${line.key}`)
                      : "—"}
                  </td>
                </tr>
              ))}
              <tr className="bg-bz-surface-2">
                <td className="py-3 px-2 text-[14px] font-medium">
                  {t("mortgage.cashTotal")}
                </td>
                <td
                  className="py-3 px-2 text-end mono text-[16px] font-medium text-bz-navy"
                  data-testid="cash-to-close-total"
                >
                  {formatAed(closing.totalAed)}
                </td>
                <td className="py-3 px-2 text-end text-[11px] text-bz-muted">
                  {t("mortgage.cashPctOfPrice", {
                    pct: formatPct(closing.pctOfPrice),
                  })}
                </td>
              </tr>
            </tbody>
          </table>
          {prefs.currency !== "AED" ? (
            <p className="mt-3 text-[11.5px] text-bz-muted leading-relaxed">
              {t("mortgage.cashPegNote")}
            </p>
          ) : null}
        </div>

        {/* Amortization chart */}
        <div className="border border-bz-border bg-bz-surface rounded-lg p-6 md:p-7">
          <div className="flex justify-between items-center mb-5">
            <div>
              <Eyebrow>
                {t("mortgage.amortEyebrow", { years: termYears })}
              </Eyebrow>
              <h3
                className="serif text-[22px] mt-1"
                style={{ letterSpacing: "-0.01em" }}
              >
                {t("mortgage.amortHeading")}
              </h3>
            </div>
            <div className="flex gap-3 text-[12px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-bz-ink" />
                {t("mortgage.amortPrincipal")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-bz-accent" />
                {t("mortgage.amortInterest")}
              </span>
            </div>
          </div>
          <AmortChart schedule={schedule} termYears={termYears} />
        </div>

        {/* Scenario compare */}
        <div className="border border-bz-border bg-bz-surface rounded-lg p-6 md:p-7">
          <Eyebrow>{t("mortgage.compareEyebrow")}</Eyebrow>
          <h3
            className="serif text-[22px] mt-1"
            style={{ letterSpacing: "-0.01em" }}
          >
            {t("mortgage.compareHeading")}
          </h3>
          <div className="grid sm:grid-cols-3 gap-3 mt-5" data-testid="scenarios">
            {scenarios.map((s) => (
              <div
                key={s.key}
                className={cn(
                  "rounded-lg p-5",
                  s.active
                    ? "bg-bz-navy text-white"
                    : "bg-bz-surface border border-bz-border text-bz-ink",
                )}
              >
                <div className="flex justify-between items-center">
                  <Eyebrow className={s.active ? "text-white/70" : undefined}>
                    {s.name}
                  </Eyebrow>
                  {s.active ? (
                    <span className="w-2 h-2 rounded-full bg-bz-success" />
                  ) : null}
                </div>
                <p className={cn("text-[11px] mt-1", s.active ? "text-white/65" : "text-bz-muted")}>
                  {s.sub}
                </p>
                <div
                  className={cn("serif text-[24px] mt-3.5", !s.active && "text-bz-navy")}
                  style={{ letterSpacing: "-0.015em" }}
                >
                  {t("mortgage.scenarioMonthly", {
                    amount: formatAed(s.monthly),
                  })}
                </div>
                <div
                  className={cn(
                    "mono text-[11.5px] mt-1",
                    s.active ? "text-white/70" : "text-bz-muted",
                  )}
                >
                  {t("mortgage.scenarioTotal", { amount: formatAed(s.total) })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/*
      ── Pre-approval — the lead form, with wa.me and the desk beside it ──

      Two switches, deliberately separate. Switching the SECTION off in Pages &
      blocks removes the band; switching the FORM off in Forms keeps the band
      and falls it back to the WhatsApp-and-advisor row it was before the form
      existed. An editor who wanted the second should not get the first.
    */}
    {band.enabled ? (
    <section className="px-4 md:px-12 pb-12 md:pb-24">
      <div
        className={cn(
          "bg-bz-accent-soft rounded-xl p-6 md:p-8 gap-6",
          showPreApprovalForm
            ? "grid items-start gap-8 lg:grid-cols-[1fr_minmax(0,430px)] lg:gap-12 [&>*]:min-w-0"
            : "flex flex-wrap items-center justify-between",
        )}
      >
        <div>
          {band.eyebrow ? (
            <Eyebrow className="text-bz-accent">{band.eyebrow}</Eyebrow>
          ) : null}
          <h2
            className={cn(
              "serif mt-1.5",
              showPreApprovalForm ? "text-[26px] md:text-[32px] leading-[1.1]" : "text-[26px]",
            )}
            style={{ letterSpacing: "-0.015em" }}
          >
            {band.title}
          </h2>
          {band.sub ? (
            <p className="text-[13.5px] text-bz-ink-2 mt-1.5">{band.sub}</p>
          ) : null}

          {showPreApprovalForm ? (
            <>
              {/* The visitor should be able to see what they're sending. */}
              <div
                className="mt-6 rounded-lg border border-bz-border bg-bz-surface p-5"
                data-testid="pre-approval-scenario"
              >
                {band.scenarioLabel ? (
                  <Eyebrow>{band.scenarioLabel}</Eyebrow>
                ) : null}
                <dl className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                  {scenarioLines.map(({ key, value }) => (
                    <div key={key}>
                      <dt className="text-[11.5px] text-bz-muted">
                        {t(`mortgage.${key}`)}
                      </dt>
                      <dd className="mono text-[13.5px] text-bz-ink mt-0.5">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {band.scenarioNote ? (
                  <p className="text-[11.5px] text-bz-muted mt-4 pt-3.5 border-t border-bz-border">
                    {band.scenarioNote}
                  </p>
                ) : null}
              </div>

              {band.talkLabel ? (
                <p className="text-[13px] text-bz-ink-2 mt-6">
                  {band.talkLabel}
                </p>
              ) : null}
            </>
          ) : null}

          <div
            className={cn(
              "flex flex-wrap gap-2",
              showPreApprovalForm && "mt-2.5",
            )}
          >
            {band.advisorCtaLabel ? (
              <Button asChild variant="outline">
                <Link href={band.advisorCtaHref}>
                  <Calendar size={14} strokeWidth={1.6} />
                  {band.advisorCtaLabel}
                </Link>
              </Button>
            ) : null}
            {waLink ? (
              <Button
                asChild
                variant={showPreApprovalForm ? "outline" : "default"}
                data-testid="pre-approval-cta"
              >
                <a href={waLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={14} strokeWidth={1.6} />
                  {band.whatsappCtaLabel}
                  <ArrowRight size={14} strokeWidth={1.6} />
                </a>
              </Button>
            ) : (
              <Button
                asChild
                variant={showPreApprovalForm ? "outline" : "default"}
                data-testid="pre-approval-cta"
              >
                <Link href="/contact?source=mortgage">
                  {band.fallbackCtaLabel}
                  <ArrowRight size={14} strokeWidth={1.6} />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {showPreApprovalForm ? (
          <div
            className="rounded-lg border border-bz-border bg-bz-surface p-6 md:p-7"
            data-testid="pre-approval-form"
          >
            <FormRenderer
              form={preApprovalForm}
              context={{ scenario: scenarioBrief }}
              successStyle="serif"
            />
          </div>
        ) : null}
      </div>
    </section>
    ) : null}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="serif text-[24px] text-white"
        style={{ letterSpacing: "-0.015em" }}
      >
        {value}
      </div>
      <div className="text-[12px] text-white/65 mt-1">{label}</div>
    </div>
  );
}

function AmortChart({
  schedule,
  termYears,
}: {
  schedule: ReturnType<typeof amortizationByYear>;
  termYears: number;
}) {
  const t = useTranslations("tools");
  const rtl = useIsRtl();
  if (schedule.length === 0) {
    return (
      <p className="text-[13px] text-bz-muted">{t("mortgage.amortEmpty")}</p>
    );
  }
  const maxTotal = Math.max(
    ...schedule.map((r) => r.principalAed + r.interestAed),
  );
  const W = 800;
  const H = 220;
  const padding = 4;
  const colW = (W - padding * 2) / schedule.length;
  const innerW = colW * 0.82;

  return (
    <>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        aria-label={t("mortgage.amortAria")}
      >
        {[40, 80, 120, 160, 200].map((y) => (
          <line
            key={y}
            x1={0}
            x2={W}
            y1={y}
            y2={y}
            stroke="var(--bz-border)"
            strokeDasharray="2 4"
          />
        ))}
        {schedule.map((row, i) => {
          const total = row.principalAed + row.interestAed;
          const h = (total / maxTotal) * 160; // bar fits into 160px tall area
          const pH = total === 0 ? 0 : h * (row.principalAed / total);
          const iH = h - pH;
          // Mirror the time axis in RTL so the series runs right-to-left,
          // the way a chronology reads in Arabic.
          //
          // This is a correctness fix, not a stylistic one. The label row
          // below is HTML flex and reverses with `dir`; the SVG does not.
          // Left alone the two disagree, and "Y25" ends up sitting over Y1's
          // interest-heavy bar — the chart states the opposite of the truth.
          const x = rtl
            ? W - padding - (i + 1) * colW + (colW - innerW) / 2
            : padding + i * colW + (colW - innerW) / 2;
          const baseY = 200;
          return (
            <g key={i}>
              <rect
                x={x}
                y={baseY - h}
                width={innerW}
                height={iH}
                fill="var(--bz-accent)"
              />
              <rect
                x={x}
                y={baseY - pH}
                width={innerW}
                height={pH}
                fill="var(--bz-ink)"
              />
            </g>
          );
        })}
        <line x1={0} x2={W} y1={200} y2={200} stroke="var(--bz-ink)" />
      </svg>
      <div className="flex justify-between text-[11px] text-bz-muted mt-1">
        {[
          1,
          Math.round(termYears * 0.25) || 1,
          Math.round(termYears * 0.5) || 1,
          Math.round(termYears * 0.75) || 1,
          termYears,
        ].map((year, i) => (
          <span key={i}>{t("mortgage.amortYear", { year })}</span>
        ))}
      </div>
    </>
  );
}

/** Sprint 12: PDF download for the mortgage scenario. POSTs the
 *  computed inputs+result to /api/pdf/mortgage and saves the stream. */
function MortgagePdfDownload({
  input,
  result,
}: {
  input: {
    property_price_aed: number;
    down_payment_pct: number;
    rate_pct: number;
    term_years: number;
    loan_type: "fixed" | "variable" | "hybrid";
    buyer_status: "uae_resident" | "non_resident" | "gcc_national";
  };
  result: {
    loan_amount_aed: number;
    monthly_payment_aed: number;
    total_interest_aed: number;
    total_cost_aed: number;
    dbr_pct: number | null;
  };
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("tools");
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/pdf/mortgage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input, result }),
        });
        if (!res.ok) throw new Error(`PDF render failed (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "bazar-mortgage-scenario.pdf";
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t("mortgage.pdfDownloaded"));
      } catch {
        // The thrown message is `PDF render failed (500)` — a status code the
        // visitor cannot act on, and the one string here that was never worth
        // translating. One sentence for every failure, in their language.
        toast.error(t("mortgage.pdfFailed"));
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handle}
      disabled={pending}
    >
      <Download size={14} strokeWidth={1.6} />
      {pending
        ? t("mortgage.pdfGenerating")
        : pdfLabel(t("mortgage.pdfSummary"), locale)}
    </Button>
  );
}
