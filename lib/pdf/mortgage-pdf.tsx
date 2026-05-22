/**
 * Sprint 12 — mortgage scenario PDF.
 *
 * Caller posts the calculator input + computed schedule to
 * /api/pdf/mortgage; the route renders this component and returns a
 * Bazar-branded PDF stream.
 */

import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { Shell, styles, palette } from "./_shared";

export type MortgageScenarioInput = {
  property_price_aed: number;
  down_payment_pct: number;
  rate_pct: number;
  term_years: number;
  loan_type: "fixed" | "variable" | "hybrid";
  buyer_status: "uae_resident" | "non_resident" | "gcc_national";
};

export type MortgageScenarioResult = {
  loan_amount_aed: number;
  monthly_payment_aed: number;
  total_interest_aed: number;
  total_cost_aed: number;
  dbr_pct: number | null;
};

function formatAED(n: number): string {
  return `AED ${Math.round(n).toLocaleString()}`;
}

const LOAN_TYPE_LABEL: Record<MortgageScenarioInput["loan_type"], string> = {
  fixed: "Fixed rate",
  variable: "Variable rate",
  hybrid: "Hybrid",
};

const BUYER_STATUS_LABEL: Record<
  MortgageScenarioInput["buyer_status"],
  string
> = {
  uae_resident: "UAE resident",
  non_resident: "Non-resident",
  gcc_national: "GCC national",
};

export function MortgageScenarioPdf({
  input,
  result,
  scenarioName,
}: {
  input: MortgageScenarioInput;
  result: MortgageScenarioResult;
  scenarioName?: string;
}): React.ReactElement {
  return (
    <Shell
      title="Mortgage scenario"
      subtitle={
        scenarioName
          ? scenarioName
          : "Indicative figures only — final rates set by the lender after pre-approval."
      }
    >
      <View>
        <Text style={styles.eyebrow}>Inputs</Text>
        <View>
          <KV label="Property price" value={formatAED(input.property_price_aed)} />
          <KV
            label="Down payment"
            value={`${input.down_payment_pct}% (${formatAED(
              (input.property_price_aed * input.down_payment_pct) / 100,
            )})`}
          />
          <KV label="Interest rate" value={`${input.rate_pct.toFixed(2)}%`} />
          <KV label="Term" value={`${input.term_years} years`} />
          <KV label="Loan type" value={LOAN_TYPE_LABEL[input.loan_type]} />
          <KV label="Buyer status" value={BUYER_STATUS_LABEL[input.buyer_status]} />
        </View>

        <Text style={[styles.eyebrow, { marginTop: 24 }]}>Result</Text>
        <View>
          <KV label="Loan amount" value={formatAED(result.loan_amount_aed)} />
          <KV
            label="Monthly payment"
            value={formatAED(result.monthly_payment_aed)}
          />
          <KV
            label="Total interest"
            value={formatAED(result.total_interest_aed)}
          />
          <KV label="Total cost" value={formatAED(result.total_cost_aed)} />
          {result.dbr_pct !== null ? (
            <KV
              label="DBR (estimated)"
              value={`${result.dbr_pct.toFixed(1)}%`}
            />
          ) : null}
        </View>

        <Text style={[styles.eyebrow, { marginTop: 28 }]}>Notes</Text>
        <View
          style={{
            paddingLeft: 10,
            borderLeftWidth: 2,
            borderLeftColor: palette.accent,
          }}
        >
          <Text style={{ color: palette.ink2, fontSize: 10, marginBottom: 6 }}>
            UAE Central Bank caps total DBR at 50% of monthly income.
            Pre-approval typically takes 3-5 working days.
          </Text>
          <Text style={{ color: palette.ink2, fontSize: 10, marginBottom: 6 }}>
            Non-resident buyers face a 50% LTV cap; resident buyers benefit
            from up to 75% for first homes (Central Bank Regulation 31).
          </Text>
          <Text style={{ color: palette.ink2, fontSize: 10 }}>
            DLD transfer fee (4%) and trustee fee are payable separately at
            transfer. Bazar advisory fee 1.5% applies on engagement close.
          </Text>
        </View>

        <Text style={[styles.eyebrow, { marginTop: 28 }]}>Next step</Text>
        <Text style={{ color: palette.ink, fontSize: 11 }}>
          Speak to a Bazar mortgage advisor — we work with HSBC, Emirates
          NBD, FAB, ADCB, RAKBank, and a handful of private-bank desks for
          higher-LTV resident profiles.
        </Text>
      </View>
    </Shell>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}
