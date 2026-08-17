"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Home, Check } from "lucide-react";
import { totals } from "@/lib/mortgage";
import { formatMoneyValue, usePreferences } from "@/lib/preferences";
import type { SectionCopy } from "./section-copy";

/**
 * Home "Mortgage calculator" (handoff §5). Always-dark section with four
 * live sliders driving the amortization math in lib/mortgage.ts (`totals`).
 * Recomputes on every change — the calc is cheap, no debounce needed.
 *
 * Slider state stays in AED because `lib/mortgage.ts` is AED-denominated, not
 * merely AED-scaled — it carries flat statutory fees and a CBUAE LTV tier that
 * turns at AED 5M. Only the display converts.
 */
export function MortgageCalculatorSection({
  eyebrow = "Mortgage calculator",
  heading = "Estimate your monthly payments before making your move",
}: SectionCopy = {}) {
  // `common`, not `tools`: `tools` is route-scoped to /tools and /concierge
  // (see ROUTE_NAMESPACES) and this teaser renders on the home page, where
  // that bag is never mounted. Seven keys on an already-global namespace is
  // the cheaper of the two honest options.
  const t = useTranslations("common.mortgageTeaser");
  const { prefs } = usePreferences();
  const money = (n: number) => formatMoneyValue(n, prefs);
  const [price, setPrice] = useState(2_500_000);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(4.25);
  const [years, setYears] = useState(25);

  const summary = useMemo(
    () =>
      totals({
        pricePropertyAed: price,
        downPaymentPct: downPct / 100,
        annualRatePct: rate,
        termYears: years,
      }),
    [price, downPct, rate, years],
  );
  const down = Math.round(price * (downPct / 100));

  return (
    <section className="bg-bz-ink px-4 md:px-12 py-14 md:py-20 text-bz-bg">
      <div
        className="text-[11px] font-medium uppercase text-[oklch(0.72_0.005_80)]"
        style={{ letterSpacing: "0.12em" }}
      >
        {eyebrow}
      </div>
      <h2 className="serif mt-2 max-w-[20ch] text-[28px] md:text-[40px] font-normal leading-[1.1] tracking-tight text-white">
        {heading}
      </h2>

      <div className="mt-9 grid gap-4 md:grid-cols-[1.3fr_1fr] md:gap-0 md:overflow-hidden md:rounded-2xl md:border md:border-[oklch(0.3_0_0)]">
        {/* Inputs */}
        <div className="flex flex-col gap-6 rounded-2xl bg-[oklch(0.22_0.005_80)] p-6 md:rounded-none md:p-11">
          <Slider
            label={t("propertyPrice")}
            display={money(price)}
            value={price}
            min={500_000}
            max={30_000_000}
            step={50_000}
            onChange={setPrice}
          />
          <Slider
            label={t("downPayment")}
            display={`${downPct}%  ·  ${money(down)}`}
            value={downPct}
            min={5}
            max={80}
            step={1}
            onChange={setDownPct}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <Slider
              label={t("interestRate")}
              display={`${rate.toFixed(2)}%`}
              value={rate}
              min={1.5}
              max={9}
              step={0.05}
              onChange={setRate}
            />
            <Slider
              label={t("loanTerm")}
              display={`${years} years`}
              value={years}
              min={5}
              max={30}
              step={1}
              onChange={setYears}
            />
          </div>
        </div>

        {/* Result */}
        <div className="flex flex-col rounded-2xl bg-bz-accent p-6 text-white md:rounded-none md:p-11">
          <div
            className="text-[11px] font-medium uppercase text-white/75"
            style={{ letterSpacing: "0.12em" }}
          >
            {t("estimatedMonthly")}
          </div>
          <div className="serif mt-3 text-[40px] md:text-[52px] leading-none tracking-tight">
            {money(summary.monthlyPaymentAed)}
          </div>
          <div className="mt-7 flex flex-col gap-3.5">
            {[
              ["Loan amount", money(summary.principalAed)],
              [t("downPayment"), money(down)],
              ["Total interest", money(summary.totalInterestAed)],
            ].map(([l, v]) => (
              <div
                key={l}
                className="flex justify-between border-b border-white/20 pb-3 text-[13px]"
              >
                <span className="text-white/80">{l}</span>
                <span className="mono">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-2.5 pt-7">
            <Link
              href="/buy"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-[13.5px] font-medium text-bz-ink transition-colors hover:bg-white/90"
            >
              <Home size={16} /> {t("viewProperties")}
            </Link>
            <Link
              href="/tools/mortgage"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/40 px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-white/10"
            >
              <Check size={16} /> {t("getPreApproval")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Slider({
  label,
  display,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <label className="text-[12.5px] font-medium text-[oklch(0.86_0.006_80)]">
          {label}
        </label>
        <div className="mono text-[14px] text-white">{display}</div>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer accent-bz-accent"
      />
    </div>
  );
}
