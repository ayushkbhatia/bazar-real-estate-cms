"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { KeyValueList } from "@/components/brand/mobile";
import { cn } from "@/lib/utils";
import type { PaymentPlan } from "@/lib/schemas/development";
import {
  computePaymentBreakdown,
  splitPaymentPlan,
} from "@/lib/schemas/development";

export type CalculatorUnit = {
  id: string;
  label: string;
  price_aed: number;
};

function formatAed(n: number): string {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${Math.round(n).toLocaleString()}`;
}

/**
 * The payment-plan section of a project page — header, cash-flow timeline and
 * the plan calculator, per the off-plan design handoff.
 *
 * The timeline is one schedule rendered two ways: a horizontal run of columns
 * from `xl` up, and the vertical spine below it. The handoff is explicit that
 * the horizontal form must flip rather than compress ("unreadable much below
 * 1100px"), and a plan may carry up to twelve milestones, so the wide form
 * also scrolls sideways past the point where columns would start to crush.
 */
export function PaymentPlanSection({
  id,
  plan,
  heading,
  developmentName,
  units,
}: {
  id: string;
  plan: PaymentPlan;
  heading: string;
  developmentName: string;
  units: CalculatorUnit[];
}) {
  const [selectedId, setSelectedId] = useState(units[0]?.id ?? "");
  const [downloading, setDownloading] = useState(false);

  const selected = useMemo(
    () => units.find((u) => u.id === selectedId) ?? units[0] ?? null,
    [units, selectedId],
  );
  // A project with no unit inventory and no starting price can still show the
  // schedule — the percentages are the point. Only the money goes missing.
  const price = selected?.price_aed ?? 0;
  const split = useMemo(() => splitPaymentPlan(plan), [plan]);
  const breakdown = useMemo(
    () => (price > 0 ? computePaymentBreakdown(plan, price) : null),
    [plan, price],
  );

  function amountFor(percent: number): string | null {
    if (price <= 0) return null;
    return formatAed(price * (percent / 100));
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch("/api/pdf/payment-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developmentName,
          unitLabel: selected?.label ?? null,
          priceAed: price,
          plan,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bazar-payment-plan-${developmentName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("That didn't download — please try again in a moment.");
    } finally {
      setDownloading(false);
    }
  }

  // Captions read off the plan itself rather than being written per project,
  // so a 50/50 plan doesn't inherit a 60/40 plan's wording.
  const constructionNote = [
    `${split.constructionPct}%`,
    split.constructionCount > 0
      ? `${split.constructionCount} instalment${split.constructionCount === 1 ? "" : "s"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const handoverNote = [
    `${split.handoverPct}% on key-handover`,
    split.handoverTiming,
  ]
    .filter(Boolean)
    .join(" · ");

  const postNote = plan.post_handover_months
    ? `${split.postHandoverPct}% over ${plan.post_handover_months} months`
    : split.postHandoverCount > 0
      ? `${split.postHandoverPct}% over ${split.postHandoverCount} instalment${
          split.postHandoverCount === 1 ? "" : "s"
        }`
      : `${split.postHandoverPct}% after handover`;

  // `note` is the full caption under the wide layout's figure; `pct` is what
  // the narrow key/value list uses instead, because the full caption wraps to
  // three lines in a 393px row and pushes the amount off its own line.
  const slices: {
    eyebrow: string;
    amount: string;
    note: string;
    pct: number;
  }[] = [
    {
      eyebrow: "During construction",
      amount: breakdown ? formatAed(breakdown.construction) : "—",
      note: constructionNote,
      pct: split.constructionPct,
    },
    {
      eyebrow: "At handover",
      amount: breakdown ? formatAed(breakdown.handover) : "—",
      note: handoverNote,
      pct: split.handoverPct,
    },
  ];
  // Only projects with a post-handover tail get the fourth column; a straight
  // 50/50 plan would otherwise show a confident "AED 0".
  if (split.postHandoverPct > 0) {
    slices.push({
      eyebrow: "Post-handover",
      amount: breakdown ? formatAed(breakdown.postHandover) : "—",
      note: postNote,
      pct: split.postHandoverPct,
    });
  }

  return (
    <section
      id={id}
      className="px-4 md:px-12 py-16 bg-bz-surface-2 scroll-mt-16"
    >
      <div className="flex justify-between items-end flex-wrap gap-4 mb-6 md:mb-8">
        <div>
          <Eyebrow>Payment plan · {plan.name}</Eyebrow>
          <h2
            className="serif text-[28px] md:text-[40px] mt-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            {heading}
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={downloadPdf}
          disabled={downloading}
        >
          <Download size={14} strokeWidth={1.6} />
          {downloading ? "Preparing…" : "Custom plan as PDF"}
        </Button>
      </div>

      {/* ── Timeline, wide: a column per milestone above a baseline rule ──
          The track is `w-max min-w-full` so it stretches to fill the section
          at seven milestones or fewer and grows past it at twelve, taking the
          rule with it — anchoring the rule to the viewport-width scroll port
          instead left it stopping short of the last few columns. */}
      <div className="hidden xl:block overflow-x-auto pt-10 pb-4">
        <div className="relative w-max min-w-full">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-6 h-0.5 bg-bz-border-strong"
          />
          <ol className="grid grid-flow-col auto-cols-[minmax(150px,1fr)] w-full list-none">
            {plan.milestones.map((m, i) => {
              const amount = amountFor(m.percent);
              return (
                <li
                  key={`${m.label}-${i}`}
                  className="flex flex-col items-center text-center px-1"
                >
                  <span
                    className={cn(
                      "w-[18px] h-[18px] rounded-full border-2 border-bz-ink z-[1] mb-7",
                      i === 0 ? "bg-bz-ink" : "bg-bz-surface",
                    )}
                  />
                  <span
                    className="serif text-[32px] leading-none"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {m.percent}%
                  </span>
                  <span className="text-[12.5px] text-bz-ink-2 mt-1 leading-tight">
                    {m.label}
                  </span>
                  {m.timing ? (
                    <span className="text-[11px] text-bz-muted mt-0.5">
                      {m.timing}
                    </span>
                  ) : null}
                  {amount ? (
                    <span className="mono text-[11.5px] text-bz-ink mt-2 px-2 py-[3px] bg-bz-surface rounded-[3px]">
                      {amount}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* ── Timeline, narrow: the same schedule down a vertical spine ── */}
      <ol className="xl:hidden mt-5 ml-2 pb-1 border-l-2 border-bz-border-strong flex flex-col gap-[18px] list-none">
        {plan.milestones.map((m, i) => {
          const amount = amountFor(m.percent);
          return (
            <li
              key={`${m.label}-${i}`}
              className="relative pl-[18px] flex gap-3.5 items-start"
            >
              <span
                className={cn(
                  "absolute -left-2 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-bz-ink",
                  i === 0 ? "bg-bz-ink" : "bg-bz-surface",
                )}
              />
              <span
                className="serif text-[24px] w-14 shrink-0 leading-tight"
                style={{ letterSpacing: "-0.02em" }}
              >
                {m.percent}%
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] text-bz-ink">
                  {m.label}
                </span>
                {m.timing ? (
                  <span className="block text-[11.5px] text-bz-muted mt-0.5">
                    {m.timing}
                  </span>
                ) : null}
              </span>
              {amount ? (
                <span className="mono text-[12px] self-center whitespace-nowrap px-2 py-[3px] bg-bz-surface rounded-[3px]">
                  {amount}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* ── Calculator ─────────────────────────────────────────────── */}
      <div className="mt-6 md:mt-8 rounded-xl border border-bz-border bg-bz-surface p-[18px] md:p-6">
        <div
          className={cn(
            "grid gap-5 md:gap-6 grid-cols-1 sm:grid-cols-2",
            slices.length === 3 ? "lg:grid-cols-4" : "lg:grid-cols-3",
          )}
        >
          <div>
            <Eyebrow>Pricing for</Eyebrow>
            <select
              className="mt-2 w-full h-12 lg:h-9 border border-bz-border rounded text-[13px] px-2 bg-bz-bg"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={units.length === 0}
              aria-label="Pick a unit type to price"
            >
              {units.length === 0 ? (
                <option>No pricing published yet</option>
              ) : (
                units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))
              )}
            </select>
            {/* The stacked figures below duplicate this on narrow screens, so
                the headline price only shows once the columns exist. */}
            <div
              className="serif text-[28px] mt-3.5 hidden lg:block"
              style={{ letterSpacing: "-0.02em" }}
            >
              {price > 0 ? formatAed(price) : "—"}
            </div>
          </div>

          {/* Wide: a column per bucket. */}
          {slices.map((s) => (
            <div key={s.eyebrow} className="hidden lg:block">
              <Eyebrow>{s.eyebrow}</Eyebrow>
              <div
                className="serif text-[28px] mt-3.5"
                style={{ letterSpacing: "-0.02em" }}
              >
                {s.amount}
              </div>
              <div className="text-[11.5px] text-bz-muted mt-1">{s.note}</div>
            </div>
          ))}
        </div>

        {/* Narrow: the same figures as a key/value list. */}
        <KeyValueList
          className="lg:hidden mt-2"
          items={[
            {
              key: "Price",
              value: (
                <span className="serif text-[16px] whitespace-nowrap">
                  {price > 0 ? formatAed(price) : "—"}
                </span>
              ),
            },
            ...slices.map((s) => ({
              key: `${s.eyebrow} · ${s.pct}%`,
              value: (
                <span className="serif text-[16px] whitespace-nowrap">
                  {s.amount}
                </span>
              ),
            })),
          ]}
        />
      </div>
    </section>
  );
}
