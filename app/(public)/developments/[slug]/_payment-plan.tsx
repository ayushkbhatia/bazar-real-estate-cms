"use client";

import { useMemo, useState } from "react";
import type {
  PaymentPlan,
  PaymentPlanMilestone,
} from "@/lib/schemas/development";
import { computePaymentBreakdown } from "@/lib/schemas/development";

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

function milestoneAmount(
  ms: PaymentPlanMilestone,
  price: number,
): string {
  if (!price) return "—";
  return formatAed(price * (ms.percent / 100));
}

export function PaymentPlanCalculator({
  plan,
  units,
}: {
  plan: PaymentPlan;
  units: CalculatorUnit[];
}) {
  const [selectedId, setSelectedId] = useState(units[0]?.id ?? "");
  const selected = useMemo(
    () => units.find((u) => u.id === selectedId) ?? units[0] ?? null,
    [units, selectedId],
  );
  const breakdown = useMemo(
    () => (selected ? computePaymentBreakdown(plan, selected.price_aed) : null),
    [plan, selected],
  );

  return (
    <>
      {/* Timeline */}
      <div className="relative px-2 pt-10 pb-4">
        <div className="absolute top-[64px] left-2 right-2 h-px bg-bz-border-strong" />
        <div
          className="grid gap-0"
          style={{
            gridTemplateColumns: `repeat(${plan.milestones.length}, minmax(0, 1fr))`,
          }}
        >
          {plan.milestones.map((m, i) => (
            <div
              key={`${m.label}-${i}`}
              className="flex flex-col items-center text-center px-1"
            >
              <div
                className={`w-[18px] h-[18px] rounded-full border-2 border-bz-ink z-[1] mb-7 ${
                  i === 0 ? "bg-bz-ink" : "bg-bz-surface"
                }`}
              />
              <div
                className="serif text-[32px] leading-none"
                style={{ letterSpacing: "-0.02em" }}
              >
                {m.percent}%
              </div>
              <div className="text-[12.5px] text-bz-ink-2 mt-1 leading-tight">
                {m.label}
              </div>
              {m.timing ? (
                <div className="text-[11px] text-bz-muted mt-0.5">
                  {m.timing}
                </div>
              ) : null}
              <div className="mono text-[11.5px] text-bz-ink mt-2 px-2 py-0.5 bg-bz-surface rounded">
                {selected ? milestoneAmount(m, selected.price_aed) : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calculator card */}
      <div className="mt-8 rounded-xl border border-bz-border bg-bz-surface p-6 grid grid-cols-4 gap-6">
        <div>
          <div className="eyebrow">Pricing for</div>
          <select
            className="mt-2 w-full h-9 border border-bz-border rounded text-[13px] px-2 bg-bz-bg"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={units.length === 0}
            aria-label="Pick a unit type to price"
          >
            {units.length === 0 ? (
              <option>No units listed yet</option>
            ) : (
              units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))
            )}
          </select>
          <div
            className="serif text-[28px] mt-3.5"
            style={{ letterSpacing: "-0.02em" }}
          >
            {selected ? formatAed(selected.price_aed) : "—"}
          </div>
        </div>
        <Slice
          eyebrow="During construction"
          amount={breakdown ? formatAed(breakdown.construction) : "—"}
          note="Pre-handover instalments"
        />
        <Slice
          eyebrow="At handover"
          amount={breakdown ? formatAed(breakdown.handover) : "—"}
          note="Key-handover payment"
        />
        <Slice
          eyebrow="Post-handover"
          amount={breakdown ? formatAed(breakdown.postHandover) : "—"}
          note={
            plan.post_handover_months
              ? `Over ${plan.post_handover_months} months`
              : "After handover"
          }
        />
      </div>
    </>
  );
}

function Slice({
  eyebrow,
  amount,
  note,
}: {
  eyebrow: string;
  amount: string;
  note: string;
}) {
  return (
    <div>
      <div className="eyebrow">{eyebrow}</div>
      <div
        className="serif text-[28px] mt-3.5"
        style={{ letterSpacing: "-0.02em" }}
      >
        {amount}
      </div>
      <div className="text-[11.5px] text-bz-muted mt-1">{note}</div>
    </div>
  );
}
