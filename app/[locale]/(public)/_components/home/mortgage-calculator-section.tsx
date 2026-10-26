"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import Link from "@/components/i18n/link";
import { Check } from "lucide-react";
import { totals } from "@/lib/mortgage";
import { formatMoneyValue, usePreferences } from "@/lib/preferences";
import type { SectionCopy } from "./section-copy";
import {
  MORTGAGE_TEASER_DEFAULTS,
  type MortgageTeaserControls,
} from "@/lib/master-pages/mortgage-teaser";

/**
 * The band's words as edited in Pages & blocks → Home → Mortgage calculator.
 * Each is blank (null) unless an editor wrote one; blank reads the catalogue.
 */
export type MortgageTeaserCopy = Partial<
  Record<
    | "label_price"
    | "label_down"
    | "label_rate"
    | "label_term"
    | "label_monthly"
    | "label_loan"
    | "label_interest"
    | "cta_label"
    | "term_value"
    | "cta_href",
    string | null
  >
>;

/**
 * Home "Mortgage calculator" (handoff §5). Always-dark section with four
 * live sliders driving the amortization math in lib/mortgage.ts (`totals`).
 * Recomputes on every change — the calc is cheap, no debounce needed.
 *
 * Slider state stays in AED because `lib/mortgage.ts` is AED-denominated, not
 * merely AED-scaled — it carries flat statutory fees and a CBUAE LTV tier that
 * turns at AED 5M. Only the display converts.
 *
 * ON A PHONE
 *
 * This measured 955px at 375px wide (1039px on /ar, where the heading wraps),
 * so the two cards could not be seen together and moving a slider pushed the
 * figure it changes off-screen. It is now ~784px, from three things:
 *
 *   - Interest rate and loan term share a row. They already did from `sm` up;
 *     their values are four and eight characters, and a full row each was the
 *     single biggest waste of height in the section.
 *   - Padding and gaps step down one notch below `md`, `py-10 md:py-20`
 *     matching list-your-property.tsx.
 *   - Nothing was removed. Every figure and all four sliders are
 *     still here; a teaser that drops a number to fit is not a smaller teaser,
 *     it is a different one.
 *
 * The slider height went UP (see `Slider`) and cost nothing, which is the part
 * worth knowing if you touch this again.
 */
export function MortgageCalculatorSection({
  eyebrow = "Mortgage calculator",
  heading = "Estimate your monthly payments before making your move",
  preApprovalHref,
  copy = {},
  controls = MORTGAGE_TEASER_DEFAULTS,
}: SectionCopy & {
  /** Labels and button, from the home master page. */
  copy?: MortgageTeaserCopy;
  /** Each slider's starting value and range, from the home master page. */
  controls?: MortgageTeaserControls;
  /**
   * The mortgage application flow's entry link, when the flow is open to the
   * public (docs/mortgage, SPEC §4.1: "Home · Get pre-approval today").
   * Without it the button goes to the full calculator, as it always has.
   */
  preApprovalHref?: string;
} = {}) {
  // `common`, not `tools`: `tools` is route-scoped to /tools and /concierge
  // (see ROUTE_NAMESPACES) and this teaser renders on the home page, where
  // that bag is never mounted. Seven keys on an already-global namespace is
  // the cheaper of the two honest options.
  const t = useTranslations("common.mortgageTeaser");
  const { prefs } = usePreferences();
  const money = (n: number) => formatMoneyValue(n, prefs);
  // An editor's words where written, else the catalogue's.
  const label = (
    key: Exclude<keyof MortgageTeaserCopy, "term_value" | "cta_href">,
    fallback: string,
  ) => copy[key]?.trim() || fallback;
  const termValue = (count: number) =>
    copy.term_value?.includes("{years}")
      ? copy.term_value.replaceAll("{years}", String(count))
      : t("loanTermYears", { count });
  const [price, setPrice] = useState(controls.price.value);
  const [downPct, setDownPct] = useState(controls.down.value);
  const [rate, setRate] = useState(controls.rate.value);
  const [years, setYears] = useState(controls.term.value);

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
    <section className="bg-bz-ink px-4 md:px-12 py-10 md:py-20 text-bz-bg">
      <div
        className="text-[11px] font-medium uppercase text-[oklch(0.72_0.005_80)]"
        style={{ letterSpacing: "0.12em" }}
      >
        {eyebrow}
      </div>
      <h2 className="serif mt-2 max-w-[20ch] text-[28px] md:text-[40px] font-normal leading-[1.1] tracking-tight text-white">
        {heading}
      </h2>

      <div className="mt-6 grid gap-4 md:mt-9 md:grid-cols-[1.3fr_1fr] md:gap-0 md:overflow-hidden md:rounded-2xl md:border md:border-[oklch(0.3_0_0)]">
        {/* Inputs */}
        <div className="flex flex-col gap-5 rounded-2xl bg-[oklch(0.22_0.005_80)] p-5 md:gap-6 md:rounded-none md:p-11">
          <Slider
            label={label("label_price", t("propertyPrice"))}
            display={money(price)}
            value={price}
            {...range(controls.price)}
            onChange={setPrice}
          />
          <Slider
            label={label("label_down", t("downPayment"))}
            display={`${downPct}%  ·  ${money(down)}`}
            value={downPct}
            {...range(controls.down)}
            onChange={setDownPct}
          />
          <div className="grid grid-cols-2 gap-5 sm:gap-6">
            <Slider
              label={label("label_rate", t("interestRate"))}
              display={`${rate.toFixed(2)}%`}
              value={rate}
              {...range(controls.rate)}
              onChange={setRate}
            />
            <Slider
              label={label("label_term", t("loanTerm"))}
              display={termValue(years)}
              value={years}
              {...range(controls.term)}
              onChange={setYears}
            />
          </div>
        </div>

        {/* Result */}
        <div className="flex flex-col rounded-2xl bg-bz-accent p-5 text-white md:rounded-none md:p-11">
          <div
            className="text-[11px] font-medium uppercase text-white/75"
            style={{ letterSpacing: "0.12em" }}
          >
            {label("label_monthly", t("estimatedMonthly"))}
          </div>
          <div className="serif mt-3 text-[40px] md:text-[52px] leading-none tracking-tight">
            {money(summary.monthlyPaymentAed)}
          </div>
          <div className="mt-6 flex flex-col gap-3 md:mt-7 md:gap-3.5">
            {[
              [label("label_loan", t("loanAmount")), money(summary.principalAed)],
              [label("label_down", t("downPayment")), money(down)],
              [
                label("label_interest", t("totalInterest")),
                money(summary.totalInterestAed),
              ],
            ].map(([l, v]) => (
              <div
                key={l}
                className="flex justify-between border-b border-white/20 pb-2.5 text-[13px] md:pb-3"
              >
                <span className="text-white/80">{l}</span>
                <span className="mono-en">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-2.5 pt-6 md:pt-7">
            <Link
              href={preApprovalHref ?? (copy.cta_href?.trim() || "/tools/mortgage")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-[13.5px] font-medium text-bz-ink transition-colors hover:bg-white/90"
            >
              <Check size={16} /> {label("cta_label", t("getPreApproval"))}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A slider's range props from its settings. */
const range = ({ min, max, step }: { min: number; max: number; step: number }) => ({
  min,
  max,
  step,
});

/**
 * A label/value row over a native range input.
 *
 * The input is `block h-6` rather than the `h-1` it used to be, and that is a
 * touch-target fix that happens to be free. The old 4px track was also all the
 * height a thumb had to land on. But an `<input>` is inline by default, so it
 * already sat in a 24px line box and paid for 24px of layout — the other 20px
 * were simply empty. `block` drops the line box; `h-6` fills the same 24px
 * with hittable input. Same pitch, same position, six times the target.
 *
 * Deliberately NOT `appearance: none`: Chrome and Firefox both centre the
 * native track inside a taller box, and `accent-color` keeps painting the
 * filled portion for free. Redrawing the track by hand would mean a
 * JS-computed gradient to reproduce a fill the platform already gives us.
 *
 * The label row wraps because the two-up column is ~143px at 375px wide, and a
 * long label beside its value can outgrow that. Wrapping drops the value to
 * its own line; the alternative is two strings colliding.
 */
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
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-2">
        <label className="text-[12.5px] font-medium text-[oklch(0.86_0.006_80)]">
          {label}
        </label>
        {/* `mono-en`: the mono face in English; on /ar the site's Arabic
            face in the page's direction, as the map card's prices are —
            `.mono` drew "2.5 مليون درهم" in a face with no Arabic and forced
            it left to right (client, Oct 2026). */}
        <div className="mono-en text-[14px] text-white">{display}</div>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="block h-6 w-full cursor-pointer accent-bz-accent"
      />
    </div>
  );
}
