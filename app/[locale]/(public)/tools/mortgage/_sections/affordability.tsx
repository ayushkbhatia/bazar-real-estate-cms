"use client";

import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Affordability } from "@/lib/mortgage";
import { currencySymbol, type Preferences } from "@/lib/preferences";
import { DbrGauge } from "../_components/dbr-gauge";
import { ToolSection, type SectionCopy } from "./shared";

type Props = {
  copy: SectionCopy;
  prefs: Preferences;
  annualIncome: number;
  onIncome: (n: number) => void;
  monthlyPaymentAed: number;
  afford: Affordability | null;
  /** The Central Bank cap as a whole number, for the sentences that quote it. */
  dbrCapPct: number;
  /** The same cap as a fraction, for the gauge's band boundary. */
  maxDbr: number;
  toInput: (n: number) => string;
  fromInput: (raw: string) => number;
};

/**
 * Income in, debt-burden ratio out.
 *
 * This used to sit at the foot of the input rail, under a rule and an
 * "Optional" eyebrow — a second question inside the first question's box,
 * where a third of the visitors who would have answered it never saw it. As
 * its own section it gets a heading that says what it is for, and an editor
 * can switch it off for a market where quoting a DBR is not the done thing.
 *
 * The income field takes the visitor's selected currency and converts to AED,
 * because the ratio is against a payment the model computes in AED — someone
 * who set the page to USD and typed their salary would otherwise be told they
 * cannot afford a mortgage they comfortably can.
 */
export function AffordabilitySection({
  copy,
  prefs,
  annualIncome,
  onIncome,
  monthlyPaymentAed,
  afford,
  dbrCapPct,
  maxDbr,
  toInput,
  fromInput,
}: Props) {
  const t = useTranslations("tools");

  return (
    <ToolSection copy={copy} surface testId="affordability-section">
      <div className="grid lg:grid-cols-[440px_1fr] gap-8 lg:gap-10 items-start [&>*]:min-w-0">
        <div className="border border-bz-border bg-bz-bg rounded-lg p-6 md:p-7">
          <fieldset>
            <Label htmlFor="income">
              {t("mortgage.annualIncome", {
                symbol: currencySymbol(prefs.currency),
              })}
            </Label>
            <Input
              id="income"
              inputMode="numeric"
              className="mt-1.5 mono text-[18px] h-12"
              value={toInput(annualIncome)}
              onChange={(e) => onIncome(Math.max(0, fromInput(e.target.value)))}
              aria-label={t("mortgage.annualIncomeAria", {
                currency: prefs.currency,
              })}
            />
            <p className="text-[11.5px] text-bz-muted mt-1.5">
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
                "mt-4 p-2.5 rounded text-[12px] flex gap-2 items-center",
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
        </div>

        {annualIncome > 0 ? (
          <DbrGauge
            monthlyPaymentAed={monthlyPaymentAed}
            monthlyIncomeAed={annualIncome / 12}
            maxDbr={maxDbr}
          />
        ) : (
          // A held place rather than a collapse: the gauge appearing on the
          // first keystroke would reflow the section under the cursor.
          <div className="rounded-lg border border-dashed border-bz-border p-6 text-[13px] text-bz-muted">
            {t("mortgage.dbrEmpty")}
          </div>
        )}
      </div>
    </ToolSection>
  );
}
