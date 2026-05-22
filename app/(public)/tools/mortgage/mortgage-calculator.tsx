"use client";

import { useMemo, useState, useTransition } from "react";
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
import { DbrGauge } from "./_components/dbr-gauge";
import {
  affordability,
  amortizationByYear,
  cashToClose,
  minDownPaymentPct,
  totals,
  type BuyerStatus,
  type MortgageType,
} from "@/lib/mortgage";

const PRICE_MIN = 500_000;
const PRICE_MAX = 50_000_000;
const DOWN_MIN_PCT = 0.15;
const DOWN_MAX_PCT = 0.8;

const MORTGAGE_TYPES: { value: MortgageType; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "variable", label: "Variable" },
  { value: "hybrid", label: "Hybrid" },
];

const BUYER_STATUSES: { value: BuyerStatus; label: string }[] = [
  { value: "uae_resident", label: "UAE resident" },
  { value: "non_resident", label: "Non-resident" },
  { value: "gcc_national", label: "GCC national" },
];

const TERM_OPTIONS = [25, 20, 15, 10] as const;

function formatAed(n: number): string {
  if (!Number.isFinite(n)) return "AED 0";
  return `AED ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatPct(p: number): string {
  if (!Number.isFinite(p)) return "0%";
  const v = p * 100;
  if (Math.abs(v - Math.round(v)) < 0.05) return `${Math.round(v)}%`;
  return `${v.toFixed(1)}%`;
}

function parseAedInput(s: string): number {
  const cleaned = s.replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function MortgageCalculator() {
  const [price, setPrice] = useState(4_200_000);
  const [downPct, setDownPct] = useState(0.25);
  const [annualRatePct, setAnnualRatePct] = useState(4.25);
  const [termYears, setTermYears] = useState<number>(25);
  const [mortgageType, setMortgageType] = useState<MortgageType>("fixed");
  const [buyerStatus, setBuyerStatus] = useState<BuyerStatus>("uae_resident");
  const [annualIncome, setAnnualIncome] = useState<number>(950_000);

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
  const closing = useMemo(() => cashToClose(inputs), [inputs]);
  const schedule = useMemo(() => amortizationByYear(inputs), [inputs]);
  const afford = useMemo(
    () => affordability(annualIncome, summary.monthlyPaymentAed),
    [annualIncome, summary.monthlyPaymentAed],
  );
  const minDown = minDownPaymentPct(buyerStatus, price);
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
        name: "Current",
        sub: `${termYears}y · ${formatPct(annualRatePct / 100)} · ${formatPct(downPct)} down`,
        monthly: summary.monthlyPaymentAed,
        total: summary.totalPaidAed,
        active: true,
      },
      {
        key: "more_upfront",
        name: "More upfront",
        sub: `${termYears}y · ${formatPct(annualRatePct / 100)} · ${formatPct(altDownPct)} down`,
        monthly: alt.monthlyPaymentAed,
        total: alt.totalPaidAed,
        active: false,
      },
      {
        key: "shorter_term",
        name: "Shorter term",
        sub: `${shorterTerm}y · ${formatPct(annualRatePct / 100)} · ${formatPct(downPct)} down`,
        monthly: short.monthlyPaymentAed,
        total: short.totalPaidAed,
        active: false,
      },
    ];
  }, [
    inputs,
    summary.monthlyPaymentAed,
    summary.totalPaidAed,
    annualRatePct,
    downPct,
    termYears,
  ]);

  // Pre-fill the WhatsApp handoff with the user's current scenario so the
  // mortgage team opens the chat already knowing what to quote.
  const waMessage = [
    `Hi Bazar — I'd like to start a mortgage pre-approval.`,
    ``,
    `Property price: ${formatAed(price)}`,
    `Down payment: ${formatPct(downPct)} (${formatAed(Math.round(price * downPct))})`,
    `Term: ${termYears} years`,
    `Rate target: ${annualRatePct}%`,
    `Monthly: ${formatAed(summary.monthlyPaymentAed)}`,
  ].join("\n");
  const waLink = buildMortgageWhatsAppLink(waMessage);

  return (
    <>
    <section className="px-12 pb-12 grid lg:grid-cols-[440px_1fr] gap-10 items-start">
      {/* ── LEFT: inputs ───────────────────────────────────────── */}
      <div className="border border-bz-border bg-bz-surface rounded-lg p-7 lg:sticky lg:top-6">
        <Eyebrow>Scenario</Eyebrow>

        <fieldset className="mt-5">
          <Label htmlFor="price">Property price · AED</Label>
          <Input
            id="price"
            inputMode="numeric"
            className="mt-1.5 mono text-[18px] h-12"
            value={price.toLocaleString()}
            onChange={(e) => {
              const next = parseAedInput(e.target.value);
              setPrice(Math.max(PRICE_MIN, Math.min(PRICE_MAX, next)));
            }}
            aria-label="Property price in AED"
          />
          <input
            type="range"
            min={PRICE_MIN}
            max={10_000_000}
            step={50_000}
            value={Math.min(price, 10_000_000)}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-full mt-3 accent-bz-accent"
            aria-label="Property price slider"
          />
          <div className="flex justify-between text-[11px] text-bz-muted mt-1">
            <span>500K</span>
            <span>10M</span>
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <Label htmlFor="down">Down payment · {formatPct(downPct)}</Label>
          <Input
            id="down"
            readOnly
            className="mt-1.5 mono text-[15px]"
            value={formatAed(Math.round(price * downPct))}
            aria-label="Down payment in AED"
          />
          <input
            type="range"
            min={DOWN_MIN_PCT * 100}
            max={DOWN_MAX_PCT * 100}
            step={1}
            value={Math.round(downPct * 100)}
            onChange={(e) => setDownPct(Number(e.target.value) / 100)}
            className="w-full mt-3 accent-bz-accent"
            aria-label="Down payment slider"
          />
          <div className="flex justify-between text-[11px] text-bz-muted mt-1">
            <span>15%</span>
            <span>80%</span>
          </div>
          {belowGuidance ? (
            <p className="text-[12px] text-bz-warning mt-1.5">
              Below the {formatPct(minDown)} minimum for{" "}
              {BUYER_STATUSES.find((b) => b.value === buyerStatus)?.label}
              {price >= 5_000_000 ? " on properties at or above AED 5M." : "."}
            </p>
          ) : null}
        </fieldset>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <fieldset>
            <Label htmlFor="rate">Interest rate</Label>
            <Input
              id="rate"
              className="mt-1.5"
              inputMode="decimal"
              value={annualRatePct}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setAnnualRatePct(Math.max(0, Math.min(20, n)));
              }}
              aria-label="Annual interest rate (%)"
            />
          </fieldset>
          <fieldset>
            <Label htmlFor="term">Term</Label>
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
                    {y} years
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>
        </div>

        <fieldset className="mt-5">
          <Label>Mortgage type</Label>
          <div className="flex gap-1 mt-1.5" role="radiogroup" aria-label="Mortgage type">
            {MORTGAGE_TYPES.map((t) => {
              const active = mortgageType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMortgageType(t.value)}
                  className={cn(
                    "flex-1 h-10 rounded text-[13px] border transition-colors",
                    active
                      ? "bg-bz-ink text-bz-bg border-bz-ink"
                      : "bg-bz-surface-2 text-bz-ink-2 border-transparent hover:border-bz-border-strong",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <Label>Buyer status</Label>
          <div
            className="flex gap-1 mt-1.5"
            role="radiogroup"
            aria-label="Buyer status"
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
                      ? "bg-bz-ink text-bz-bg border-bz-ink"
                      : "bg-bz-surface-2 text-bz-ink-2 border-transparent hover:border-bz-border-strong",
                  )}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="border-t border-bz-border my-6" />

        <Eyebrow>Optional</Eyebrow>
        <fieldset className="mt-3">
          <Label htmlFor="income">Annual income · AED</Label>
          <Input
            id="income"
            inputMode="numeric"
            className="mt-1.5"
            value={annualIncome.toLocaleString()}
            onChange={(e) =>
              setAnnualIncome(Math.max(0, parseAedInput(e.target.value)))
            }
            aria-label="Annual income in AED"
          />
          <p className="text-[11.5px] text-bz-muted mt-1">
            For affordability check · DBR &lt;50% guideline
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
            <span>{afford.label}</span>
          </div>
        ) : null}

        {annualIncome > 0 ? (
          <div className="mt-4">
            <DbrGauge
              monthlyPaymentAed={summary.monthlyPaymentAed}
              monthlyIncomeAed={annualIncome / 12}
            />
          </div>
        ) : null}
      </div>

      {/* ── RIGHT: results ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* Hero — monthly payment */}
        <div className="bg-bz-ink text-white rounded-xl p-9">
          <Eyebrow className="text-white/70">Monthly payment</Eyebrow>
          <div
            className="serif text-[88px] mt-1 leading-none"
            style={{ letterSpacing: "-0.03em" }}
            data-testid="monthly-payment"
          >
            {formatAed(summary.monthlyPaymentAed)}
          </div>
          <p className="text-[14px] text-white/75 mt-3">
            For {formatAed(summary.principalAed)} borrowed · {termYears} years
            at {annualRatePct}% {mortgageType}
          </p>
          <div className="grid grid-cols-3 gap-6 mt-9 pt-7 border-t border-white/15">
            <Metric label="Total to be paid" value={formatAed(summary.totalPaidAed)} />
            <Metric label="Total interest" value={formatAed(summary.totalInterestAed)} />
            <Metric label="Principal share" value={`${summary.principalSharePct}%`} />
          </div>
        </div>

        {/* Cash to close table */}
        <div className="border border-bz-border bg-bz-surface rounded-lg p-7">
          <div className="flex justify-between items-end mb-4">
            <div>
              <Eyebrow>True cash to close</Eyebrow>
              <h3
                className="serif text-[22px] mt-1"
                style={{ letterSpacing: "-0.01em" }}
              >
                What you actually wire
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
                  <td className="py-2.5 text-bz-ink">{line.label}</td>
                  <td className="py-2.5 text-right mono">{formatAed(line.amountAed)}</td>
                  <td className="py-2.5 text-right text-[11.5px] text-bz-muted">
                    {line.note}
                  </td>
                </tr>
              ))}
              <tr className="bg-bz-surface-2">
                <td className="py-3 px-2 text-[14px] font-medium">
                  Total cash needed at close
                </td>
                <td
                  className="py-3 px-2 text-right mono text-[16px] font-medium"
                  data-testid="cash-to-close-total"
                >
                  {formatAed(closing.totalAed)}
                </td>
                <td className="py-3 px-2 text-right text-[11px] text-bz-muted">
                  {formatPct(closing.pctOfPrice)} of price
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Amortization chart */}
        <div className="border border-bz-border bg-bz-surface rounded-lg p-7">
          <div className="flex justify-between items-center mb-5">
            <div>
              <Eyebrow>Amortization · {termYears} years</Eyebrow>
              <h3
                className="serif text-[22px] mt-1"
                style={{ letterSpacing: "-0.01em" }}
              >
                How interest tapers
              </h3>
            </div>
            <div className="flex gap-3 text-[12px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-bz-ink" />
                Principal
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-bz-accent" />
                Interest
              </span>
            </div>
          </div>
          <AmortChart schedule={schedule} termYears={termYears} />
        </div>

        {/* Scenario compare */}
        <div className="border border-bz-border bg-bz-surface rounded-lg p-7">
          <Eyebrow>Compare scenarios</Eyebrow>
          <h3
            className="serif text-[22px] mt-1"
            style={{ letterSpacing: "-0.01em" }}
          >
            What if you change one variable?
          </h3>
          <div className="grid sm:grid-cols-3 gap-3 mt-5" data-testid="scenarios">
            {scenarios.map((s) => (
              <div
                key={s.key}
                className={cn(
                  "rounded-lg p-5",
                  s.active
                    ? "bg-bz-ink text-white"
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
                  className="serif text-[24px] mt-3.5"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  {formatAed(s.monthly)}/mo
                </div>
                <div
                  className={cn(
                    "mono text-[11.5px] mt-1",
                    s.active ? "text-white/70" : "text-bz-muted",
                  )}
                >
                  {formatAed(s.total)} total
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* ── Pre-approval CTA — wa.me deep link with the current scenario ── */}
    <section className="px-12 pb-24">
      <div className="bg-bz-accent-soft rounded-xl p-8 flex flex-wrap items-center justify-between gap-6">
        <div>
          <Eyebrow className="text-bz-accent">Ready to make it real?</Eyebrow>
          <h2
            className="serif text-[26px] mt-1.5"
            style={{ letterSpacing: "-0.015em" }}
          >
            Get pre-approved with our preferred lenders.
          </h2>
          <p className="text-[13.5px] text-bz-ink-2 mt-1.5">
            Soft credit pull · 24-hour response · 5 partner banks
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/contact">
              <Calendar size={14} strokeWidth={1.6} />
              Talk to advisor
            </Link>
          </Button>
          {waLink ? (
            <Button asChild data-testid="pre-approval-cta">
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={14} strokeWidth={1.6} />
                Pre-approval via WhatsApp
                <ArrowRight size={14} strokeWidth={1.6} />
              </a>
            </Button>
          ) : (
            <Button asChild data-testid="pre-approval-cta">
              <Link href="/contact?source=mortgage">
                Start pre-approval
                <ArrowRight size={14} strokeWidth={1.6} />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
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
  if (schedule.length === 0) {
    return (
      <p className="text-[13px] text-bz-muted">
        Enter a loan amount and term to see the schedule.
      </p>
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
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} aria-label="Amortization chart">
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
          const x = padding + i * colW + (colW - innerW) / 2;
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
        <span>Y1</span>
        <span>Y{Math.round(termYears * 0.25) || 1}</span>
        <span>Y{Math.round(termYears * 0.5) || 1}</span>
        <span>Y{Math.round(termYears * 0.75) || 1}</span>
        <span>Y{termYears}</span>
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
        toast.success("Mortgage scenario PDF downloaded.");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not generate PDF.",
        );
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
      {pending ? "Generating…" : "PDF summary"}
    </Button>
  );
}
