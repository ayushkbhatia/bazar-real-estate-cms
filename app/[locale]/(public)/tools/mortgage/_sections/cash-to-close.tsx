"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pdfLabel } from "@/lib/pdf/language-note";
import type { Locale } from "@/lib/i18n/locales";
import type { BuyerStatus, CashToClose, MortgageType } from "@/lib/mortgage";
import type { Preferences } from "@/lib/preferences";
import { ToolSection, formatPct, money, type SectionCopy } from "./shared";

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

type Props = {
  copy: SectionCopy;
  prefs: Preferences;
  closing: CashToClose;
  pdf: {
    input: {
      property_price_aed: number;
      down_payment_pct: number;
      rate_pct: number;
      term_years: number;
      loan_type: MortgageType;
      buyer_status: BuyerStatus;
    };
    result: {
      loan_amount_aed: number;
      monthly_payment_aed: number;
      total_interest_aed: number;
      total_cost_aed: number;
      dbr_pct: number | null;
    };
  };
};

/**
 * Every fee between the offer and the keys.
 *
 * Not in the client's section list, and kept anyway: it is the answer to the
 * question the hero asks ("what will this property actually cost you?"), the
 * PDF hangs off it, and the pre-approval brief quotes its total. It sits last
 * of the outputs and carries its own switch, so removing it is one click in
 * Pages & blocks rather than a decision made here on the client's behalf.
 */
export function CashToCloseSection({ copy, prefs, closing, pdf }: Props) {
  const t = useTranslations("tools");

  return (
    <ToolSection copy={copy} surface testId="cash-to-close-section">
      <div className="border border-bz-border bg-bz-bg rounded-lg p-6 md:p-7">
        <div className="flex justify-end mb-2">
          <MortgagePdfDownload input={pdf.input} result={pdf.result} />
        </div>
        <table
          className="w-full text-[13.5px]"
          data-testid="cash-to-close-table"
        >
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
                  {t(`mortgage.cashLine.${line.key}`, { pct: line.pct ?? "" })}
                </td>
                <td className="py-2.5 text-end mono">
                  {money(line.amountAed, prefs)}
                </td>
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
                {money(closing.totalAed, prefs)}
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
    </ToolSection>
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
