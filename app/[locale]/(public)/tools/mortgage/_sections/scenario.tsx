"use client";

import { useTranslations } from "next-intl";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { BuyerStatus, MortgageType } from "@/lib/mortgage";
import {
  currencySymbol,
  formatPrice,
  type Preferences,
} from "@/lib/preferences";
import { ToolSection, formatPct, money, type SectionCopy } from "./shared";

export const PRICE_MIN = 500_000;
export const PRICE_MAX = 50_000_000;
/** Where the slider stops. Above it the visitor types the figure. */
export const PRICE_SLIDER_MAX = 10_000_000;
export const DOWN_MIN_PCT = 0.15;
export const DOWN_MAX_PCT = 0.8;
export const TERM_OPTIONS = [25, 20, 15, 10] as const;

/**
 * Message keys, not labels.
 *
 * Two forms per mortgage type because the copy uses both: `typeFixed` is a
 * button ("Fixed"), `typeFixedInline` is the tail of a sentence ("…at 4.25%
 * fixed"). English gets there with `.toLowerCase()`; Arabic has no case, so a
 * lowercased label is not a form the language has. Two keys is the only
 * version of this that survives translation.
 */
export const MORTGAGE_TYPES: {
  value: MortgageType;
  key: string;
  inlineKey: string;
}[] = [
  { value: "fixed", key: "typeFixed", inlineKey: "typeFixedInline" },
  { value: "variable", key: "typeVariable", inlineKey: "typeVariableInline" },
  { value: "hybrid", key: "typeHybrid", inlineKey: "typeHybridInline" },
];

export const BUYER_STATUSES: { value: BuyerStatus; key: string }[] = [
  { value: "uae_resident", key: "statusUaeResident" },
  { value: "non_resident", key: "statusNonResident" },
  { value: "gcc_national", key: "statusGccNational" },
];

type Props = {
  copy: SectionCopy;
  prefs: Preferences;
  price: number;
  downPct: number;
  annualRatePct: number;
  termYears: number;
  mortgageType: MortgageType;
  buyerStatus: BuyerStatus;
  /** The Central Bank floor for the selected status and price, as a fraction. */
  minDown: number;
  /** The price at or above which the higher LTV tier applies. */
  ltvHighTierPriceAed: number;
  summary: {
    principalAed: number;
    monthlyPaymentAed: number;
    totalPaidAed: number;
    totalInterestAed: number;
    principalSharePct: number;
  };
  onPrice: (n: number) => void;
  onDownPct: (n: number) => void;
  onRate: (n: number) => void;
  onTerm: (n: number) => void;
  onType: (v: MortgageType) => void;
  onStatus: (v: BuyerStatus) => void;
  /** AED in, the visitor's currency out. */
  toInput: (n: number) => string;
  /** What they typed, back to AED. */
  fromInput: (raw: string) => number;
};

/**
 * The scenario: every input, and the one number they exist to produce.
 *
 * Inputs and the monthly payment stay in ONE section rather than two. They are
 * a single question and its answer — splitting them would let an editor switch
 * off the answer and leave a page of sliders that appear to do nothing, and
 * would put a section break in the middle of the only interaction on the page.
 */
export function ScenarioSection(props: Props) {
  const t = useTranslations("tools");
  const {
    copy,
    prefs,
    price,
    downPct,
    annualRatePct,
    termYears,
    mortgageType,
    buyerStatus,
    minDown,
    ltvHighTierPriceAed,
    summary,
    toInput,
    fromInput,
  } = props;

  const belowGuidance = downPct < minDown;
  const inlineType = (v: MortgageType) =>
    t(`mortgage.${MORTGAGE_TYPES.find((x) => x.value === v)!.inlineKey}`);

  return (
    <ToolSection copy={copy} testId="scenario-section">
      <div className="grid lg:grid-cols-[440px_1fr] gap-8 lg:gap-10 items-start [&>*]:min-w-0">
        {/* ── inputs ─────────────────────────────────────────────── */}
        <div className="border border-bz-border bg-bz-surface rounded-lg p-6 md:p-7">
          <fieldset>
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
                props.onPrice(Math.max(PRICE_MIN, Math.min(PRICE_MAX, next)));
              }}
              aria-label={t("mortgage.propertyPriceAria", {
                currency: prefs.currency,
              })}
            />
            <input
              type="range"
              min={PRICE_MIN}
              max={PRICE_SLIDER_MAX}
              step={50_000}
              value={Math.min(price, PRICE_SLIDER_MAX)}
              onChange={(e) => props.onPrice(Number(e.target.value))}
              className="w-full mt-3 accent-bz-accent"
              aria-label={t("mortgage.propertyPriceSlider")}
            />
            {/* Slider bounds and step stay AED; only the ticks convert. */}
            <div className="flex justify-between text-[11px] text-bz-muted mt-1">
              <span>{formatPrice(PRICE_MIN, prefs)}</span>
              <span>{formatPrice(PRICE_SLIDER_MAX, prefs)}</span>
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
              value={money(Math.round(price * downPct), prefs)}
              aria-label={t("mortgage.downPaymentAria", { currency: "AED" })}
            />
            <input
              type="range"
              min={DOWN_MIN_PCT * 100}
              max={DOWN_MAX_PCT * 100}
              step={1}
              value={Math.round(downPct * 100)}
              onChange={(e) => props.onDownPct(Number(e.target.value) / 100)}
              className="w-full mt-3 accent-bz-accent"
              aria-label={t("mortgage.downPaymentSlider")}
            />
            <div className="flex justify-between text-[11px] text-bz-muted mt-1">
              <span>{formatPct(DOWN_MIN_PCT)}</span>
              <span>{formatPct(DOWN_MAX_PCT)}</span>
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
                  price < ltvHighTierPriceAed
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
                    converted: formatPrice(ltvHighTierPriceAed, prefs),
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
                  if (Number.isFinite(n))
                    props.onRate(Math.max(0, Math.min(20, n)));
                }}
                aria-label={t("mortgage.interestRateAria")}
              />
            </fieldset>
            <fieldset>
              <Label htmlFor="term">{t("mortgage.term")}</Label>
              <Select
                value={String(termYears)}
                onValueChange={(v) => props.onTerm(Number(v))}
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
                    onClick={() => props.onType(type.value)}
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
                    onClick={() => props.onStatus(b.value)}
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
        </div>

        {/* ── the answer ─────────────────────────────────────────── */}
        <div className="bg-bz-ink text-white rounded-xl p-6 md:p-9 lg:sticky lg:top-6">
          <Eyebrow className="text-white/70">
            {t("mortgage.monthlyPayment")}
          </Eyebrow>
          <div
            className="serif text-[52px] md:text-[88px] mt-1 leading-none"
            style={{ letterSpacing: "-0.03em" }}
            data-testid="monthly-payment"
          >
            {money(summary.monthlyPaymentAed, prefs)}
          </div>
          <p className="text-[14px] text-white/75 mt-3">
            {t("mortgage.borrowedFor", {
              amount: money(summary.principalAed, prefs),
              years: termYears,
              rate: annualRatePct,
              type: inlineType(mortgageType),
            })}
          </p>
          <div className="grid grid-cols-3 gap-4 md:gap-6 mt-9 pt-7 border-t border-white/15">
            <Metric
              label={t("mortgage.totalToPay")}
              value={money(summary.totalPaidAed, prefs)}
            />
            <Metric
              label={t("mortgage.totalInterest")}
              value={money(summary.totalInterestAed, prefs)}
            />
            <Metric
              label={t("mortgage.principalShare")}
              value={`${summary.principalSharePct}%`}
            />
          </div>
        </div>
      </div>
    </ToolSection>
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
