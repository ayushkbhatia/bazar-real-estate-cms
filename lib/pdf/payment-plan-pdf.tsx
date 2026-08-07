/**
 * Cash-flow timeline PDF — the "Custom plan as PDF" button on a project page.
 *
 * Takes the project's payment plan and the price of the unit the visitor has
 * selected, and prints the milestone schedule with the money filled in. Same
 * `Shell` chrome as the mortgage and valuation documents.
 */

import React from "react";
import {
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { Shell, palette, styles as base } from "./_shared";
import {
  computePaymentBreakdown,
  splitPaymentPlan,
  type PaymentPlan,
} from "@/lib/schemas/development";

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.border,
  },
  headRow: {
    flexDirection: "row",
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.border,
  },
  headCell: {
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.muted,
  },
  pct: { width: 52, fontFamily: "Times-Roman", fontSize: 15 },
  stage: { flex: 1, fontSize: 11, color: palette.ink },
  when: { width: 90, fontSize: 10, color: palette.muted },
  amount: {
    width: 90,
    fontFamily: "Courier",
    fontSize: 10,
    textAlign: "right",
    color: palette.ink,
  },
  buckets: { flexDirection: "row", marginTop: 20, gap: 16 },
  bucket: {
    flex: 1,
    padding: 12,
    backgroundColor: palette.surface,
    borderWidth: 0.5,
    borderColor: palette.border,
    borderRadius: 3,
  },
  // The shared eyebrow's 1.6 tracking wraps "During construction" onto two
  // lines in a third-of-a-page box, which knocks the three cards out of
  // alignment with each other. Tighter tracking keeps each on one line.
  bucketLabel: {
    fontSize: 7.5,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: palette.muted,
    marginBottom: 6,
  },
  bucketFig: {
    fontFamily: "Times-Roman",
    fontSize: 17,
    marginTop: 6,
    color: palette.ink,
  },
  bucketNote: { fontSize: 8.5, color: palette.muted, marginTop: 4 },
  note: {
    fontSize: 8.5,
    color: palette.muted,
    marginTop: 24,
    lineHeight: 1.5,
  },
});

function formatAed(n: number): string {
  return `AED ${Math.round(n).toLocaleString("en-AE")}`;
}

export type PaymentPlanPdfProps = {
  developmentName: string;
  unitLabel?: string | null;
  priceAed: number;
  plan: PaymentPlan;
};

export function PaymentPlanPdf({
  developmentName,
  unitLabel,
  priceAed,
  plan,
}: PaymentPlanPdfProps): React.ReactElement {
  const split = splitPaymentPlan(plan);
  const breakdown = computePaymentBreakdown(plan, priceAed);
  const hasPrice = priceAed > 0;

  const buckets: { label: string; value: number; note: string }[] = [
    {
      label: "During construction",
      value: breakdown.construction,
      note: `${split.constructionPct}%${
        split.constructionCount > 0
          ? ` · ${split.constructionCount} instalment${split.constructionCount === 1 ? "" : "s"}`
          : ""
      }`,
    },
    {
      label: "At handover",
      value: breakdown.handover,
      note: [`${split.handoverPct}% on key-handover`, split.handoverTiming]
        .filter(Boolean)
        .join(" · "),
    },
  ];
  if (split.postHandoverPct > 0) {
    buckets.push({
      label: "Post-handover",
      value: breakdown.postHandover,
      note: plan.post_handover_months
        ? `${split.postHandoverPct}% over ${plan.post_handover_months} months`
        : `${split.postHandoverPct}% after handover`,
    });
  }

  return (
    <Shell
      title="Cash flow timeline"
      subtitle={`${developmentName} · ${plan.name}${
        unitLabel ? ` · ${unitLabel}` : ""
      }`}
    >
      {hasPrice ? (
        <View style={base.kv}>
          <Text style={base.kvLabel}>Price</Text>
          <Text style={base.kvValue}>{formatAed(priceAed)}</Text>
        </View>
      ) : null}

      <Text style={base.sectionH}>Schedule</Text>
      <View style={s.headRow}>
        <Text style={[s.headCell, { width: 52 }]}>%</Text>
        <Text style={[s.headCell, { flex: 1 }]}>Stage</Text>
        <Text style={[s.headCell, { width: 90 }]}>When</Text>
        <Text style={[s.headCell, { width: 90, textAlign: "right" }]}>
          Amount
        </Text>
      </View>
      {plan.milestones.map((m, i) => (
        <View key={`${m.label}-${i}`} style={s.row}>
          <Text style={s.pct}>{m.percent}%</Text>
          <Text style={s.stage}>{m.label}</Text>
          <Text style={s.when}>{m.timing || "—"}</Text>
          <Text style={s.amount}>
            {hasPrice ? formatAed(priceAed * (m.percent / 100)) : "—"}
          </Text>
        </View>
      ))}

      <View style={s.buckets}>
        {buckets.map((b) => (
          <View key={b.label} style={s.bucket}>
            <Text style={s.bucketLabel}>{b.label}</Text>
            <Text style={s.bucketFig}>
              {hasPrice ? formatAed(b.value) : "—"}
            </Text>
            <Text style={s.bucketNote}>{b.note}</Text>
          </View>
        ))}
      </View>

      <Text style={s.note}>
        Indicative only. Milestone dates follow the developer&apos;s
        construction programme and may move; amounts exclude DLD fees, service
        charges and any mortgage costs. Not an offer or a reservation. Speak to
        your Bazar advisor before committing to a schedule.
      </Text>
    </Shell>
  );
}
