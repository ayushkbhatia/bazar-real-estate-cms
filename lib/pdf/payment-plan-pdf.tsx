/**
 * Payment-plan PDF: the "Custom plan as PDF" button on a project page.
 *
 * Takes the project's payment plan and the price of the unit the visitor
 * selected, and prints the milestone schedule with the money filled in. It
 * is drawn on Bazar's letterhead (lib/pdf/letterhead.ts), laid out like a
 * developer's sales offer, which is the shape the client pointed to
 * (Nov 2026): a title beside the logo, a summary band, the unit's details, a
 * numbered schedule under a dark header, and the totals.
 *
 * The other PDFs keep the plain `Shell` from ./_shared.
 */

import React from "react";
import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { LETTERHEAD_SAFE } from "./letterhead";
import {
  computePaymentBreakdown,
  splitPaymentPlan,
  type PaymentPlan,
} from "@/lib/schemas/development";

const A4 = { width: 595.28, height: 841.89 } as const;

const c = {
  navy: "#003452",
  teal: "#2E6B7E",
  sand: "#EDE5D6",
  ink: "#1B1A17",
  ink2: "#3D3B36",
  muted: "#6B6355",
  rule: "#D9D4CA",
  white: "#FFFFFF",
} as const;

const s = StyleSheet.create({
  page: {
    paddingTop: LETTERHEAD_SAFE.top,
    paddingBottom: LETTERHEAD_SAFE.bottom,
    paddingHorizontal: LETTERHEAD_SAFE.side,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: c.ink,
    lineHeight: 1.35,
  },
  letterhead: {
    position: "absolute",
    top: 0,
    left: 0,
    width: A4.width,
    height: A4.height,
  },
  title: {
    position: "absolute",
    top: LETTERHEAD_SAFE.headerTop + 14,
    right: LETTERHEAD_SAFE.side,
    width: 300,
    alignItems: "flex-end",
  },
  titleText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 24,
    lineHeight: 1,
    letterSpacing: 1.2,
    color: c.navy,
  },
  titleSub: {
    fontSize: 9,
    lineHeight: 1.2,
    color: c.muted,
    marginTop: 8,
    letterSpacing: 0.4,
    textAlign: "right",
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: c.rule,
    borderBottomWidth: 1,
    borderBottomColor: c.rule,
  },
  metaLabel: { fontFamily: "Helvetica-Bold" },

  greeting: { marginTop: 12, marginBottom: 12 },
  greetingHead: { fontFamily: "Helvetica-Bold", marginBottom: 3 },
  greetingBody: { color: c.ink2 },

  band: { flexDirection: "row", backgroundColor: c.sand, paddingVertical: 9 },
  bandCell: { flex: 1, paddingHorizontal: 8, alignItems: "center" },
  bandDivider: { borderLeftWidth: 1, borderLeftColor: "#C9BFAE" },
  bandLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    marginBottom: 3,
    color: c.ink,
  },
  bandValue: { fontSize: 8.5, color: c.ink2, textAlign: "center" },

  grid: { marginTop: 8, borderWidth: 1, borderColor: c.rule },
  gridRow: { flexDirection: "row" },
  gridRowRule: { borderTopWidth: 1, borderTopColor: c.rule },
  gridCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: "row",
  },
  gridCellRule: { borderLeftWidth: 1, borderLeftColor: c.rule },
  gridLabel: { fontFamily: "Helvetica-Bold", fontSize: 8 },
  gridValue: { fontSize: 8, color: c.ink2, flexShrink: 1 },

  sectionHead: {
    marginTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: c.rule,
    fontFamily: "Helvetica-Bold",
    fontSize: 12.5,
    letterSpacing: 0.6,
    color: c.ink,
  },
  sectionSub: { fontSize: 8, color: c.muted, marginTop: 5, marginBottom: 6 },

  thead: { flexDirection: "row", backgroundColor: c.navy },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: c.white,
    paddingVertical: 5,
    paddingHorizontal: 6,
    textAlign: "center",
  },
  tr: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.rule,
  },
  td: {
    fontSize: 8,
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    textAlign: "center",
    color: c.ink,
  },
  tdRule: { borderLeftWidth: 1, borderLeftColor: c.rule },
  totalRow: { backgroundColor: c.sand },
  bold: { fontFamily: "Helvetica-Bold" },

  summary: { marginTop: 14 },
  sumHead: {
    backgroundColor: c.navy,
    paddingVertical: 4.5,
    alignItems: "center",
  },
  sumHeadText: { fontFamily: "Helvetica-Bold", fontSize: 8.5, color: c.white },
  sumValue: {
    backgroundColor: c.sand,
    paddingVertical: 6,
    alignItems: "center",
  },
  sumValueText: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: c.ink },
  sumNote: { fontSize: 7.5, color: c.muted, marginTop: 2 },
  sumRow: { flexDirection: "row" },
  sumCol: { flex: 1 },
  sumColGap: { marginLeft: 1 },

  note: { fontSize: 7, color: c.muted, marginTop: 10, lineHeight: 1.45 },
});

/** The table's columns: number, milestone, share, when, amount. */
const COLS = [
  { width: 38 },
  { flex: 1 },
  { width: 72 },
  { width: 112 },
  { width: 98 },
] as const;

function aed(n: number): string {
  return Math.round(n).toLocaleString("en-AE");
}

function issued(d: Date): string {
  return d
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Dubai",
    })
    .replace(/ /g, "-");
}

export type PaymentPlanPdfProps = {
  developmentName: string;
  /** The option's one-line description as the page showed it; the PDF reads `unit` instead. */
  unitLabel?: string | null;
  priceAed: number;
  plan: PaymentPlan;
  /** What the project page knows about the project; each is left as "—" when missing. */
  project?: {
    area?: string | null;
    developer?: string | null;
    handover?: string | null;
  };
  /** The option the visitor picked: the starting price, a unit type, or one unit. */
  unit?: {
    kind?: "starting" | "unitType" | "unit" | null;
    type?: string | null;
    beds?: number | null;
    areaFt2?: number | null;
  };
  /** The letterhead image; null draws the page without it (tests). */
  letterhead: Buffer | null;
  issuedAt?: Date;
};

function Cell({
  label,
  value,
  rule,
}: {
  label: string;
  value: string;
  rule?: boolean;
}) {
  return (
    <View style={rule ? [s.gridCell, s.gridCellRule] : s.gridCell}>
      <Text style={s.gridLabel}>{label}: </Text>
      <Text style={s.gridValue}>{value}</Text>
    </View>
  );
}

export function PaymentPlanPdf({
  developmentName,
  priceAed,
  plan,
  project,
  unit,
  letterhead,
  issuedAt = new Date(),
}: PaymentPlanPdfProps): React.ReactElement {
  const split = splitPaymentPlan(plan);
  const breakdown = computePaymentBreakdown(plan, priceAed);
  const hasPrice = priceAed > 0;
  const dash = "—";
  const starting = unit?.kind === "starting";
  const totalPct = plan.milestones.reduce((sum, m) => sum + m.percent, 0);

  const what = starting
    ? "at its starting price"
    : unit?.kind === "unitType" && unit.type
      ? `for the ${unit.type} unit type`
      : unit?.kind === "unit"
        ? "for the unit you selected"
        : "";
  const intro = `Thank you for your interest in ${developmentName}. Below is the developer's payment plan${what ? ` ${what}` : ""}, set out milestone by milestone with ${hasPrice ? "the amount due at each" : "the share of the price due at each"}.`;

  const buckets: { label: string; value: number; note: string }[] = [
    {
      label: "During construction",
      value: breakdown.construction,
      note: [
        `${split.constructionPct}%`,
        split.constructionCount > 0
          ? `${split.constructionCount} instalment${split.constructionCount === 1 ? "" : "s"}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      label: "At handover",
      value: breakdown.handover,
      note: [`${split.handoverPct}%`, split.handoverTiming]
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
        : `${split.postHandoverPct}%`,
    });
  }

  const band = [
    { label: "Project", value: developmentName },
    {
      label: "Location",
      value: project?.area ? `${project.area}, Abu Dhabi` : "Abu Dhabi",
    },
    {
      label: "Estimated Handover",
      value:
        project?.handover && project.handover !== dash
          ? project.handover
          : dash,
    },
    {
      label: starting ? "Starting Price (AED)" : "Price (AED)",
      value: hasPrice ? aed(priceAed) : dash,
    },
  ];

  return (
    <Document
      title={`Payment plan · ${developmentName}`}
      author="Bazar Real Estate"
      creator="Bazar Real Estate"
    >
      <Page size="A4" style={s.page}>
        {letterhead ? (
          // A PDF image has no alt text; the letterhead is the page itself.
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image
            fixed
            style={s.letterhead}
            src={{ data: letterhead, format: "jpg" }}
          />
        ) : null}

        <View style={s.title}>
          <Text style={s.titleText}>PAYMENT PLAN</Text>
          <Text style={s.titleSub}>{developmentName}</Text>
        </View>

        <View style={s.metaRow}>
          <Text>
            <Text style={s.metaLabel}>Prepared by: </Text>
            Bazar Real Estate
          </Text>
          <Text>
            <Text style={s.metaLabel}>Date: </Text>
            {issued(issuedAt)}
          </Text>
        </View>

        <View style={s.greeting}>
          <Text style={s.greetingHead}>Dear Customer,</Text>
          <Text style={s.greetingBody}>{intro}</Text>
        </View>

        <View style={s.band} wrap={false}>
          {band.map((b, i) => (
            <View
              key={b.label}
              style={i ? [s.bandCell, s.bandDivider] : s.bandCell}
            >
              <Text style={s.bandLabel}>{b.label}</Text>
              <Text style={s.bandValue}>{b.value}</Text>
            </View>
          ))}
        </View>

        <View style={s.grid} wrap={false}>
          <View style={s.gridRow}>
            <Cell
              label="Unit Type"
              value={starting ? "Starting price" : unit?.type || dash}
            />
            <Cell
              rule
              label="Bedrooms"
              value={unit?.beds ? String(unit.beds) : dash}
            />
            <Cell
              rule
              label={
                unit?.kind === "unitType" ? "Size from (ft²)" : "Size (ft²)"
              }
              value={
                unit?.areaFt2
                  ? Math.round(unit.areaFt2).toLocaleString("en-AE")
                  : dash
              }
            />
          </View>
          <View style={[s.gridRow, s.gridRowRule]}>
            <Cell label="Developer" value={project?.developer || dash} />
            <Cell
              rule
              label="Instalments"
              value={String(plan.milestones.length)}
            />
          </View>
        </View>

        <Text style={s.sectionHead}>PAYMENT PLAN</Text>
        <Text style={s.sectionSub}>{plan.name}</Text>

        <View style={s.thead} fixed={false}>
          {["Inst.", "Milestone", "Percentage", "Due", "Amount (AED)"].map(
            (h, i) => (
              <Text
                key={h}
                style={[s.th, COLS[i]!, i === 1 ? { textAlign: "left" } : {}]}
              >
                {h}
              </Text>
            ),
          )}
        </View>
        {plan.milestones.map((m, i) => (
          <View key={`${m.label}-${i}`} style={s.tr} wrap={false}>
            <Text style={[s.td, COLS[0]]}>{i + 1}</Text>
            <Text style={[s.td, s.tdRule, COLS[1], { textAlign: "left" }]}>
              {m.label}
            </Text>
            <Text style={[s.td, s.tdRule, COLS[2]]}>
              {m.percent.toFixed(2)} %
            </Text>
            <Text style={[s.td, s.tdRule, COLS[3]]}>{m.timing || dash}</Text>
            <Text style={[s.td, s.tdRule, COLS[4]]}>
              {hasPrice ? aed(priceAed * (m.percent / 100)) : dash}
            </Text>
          </View>
        ))}
        <View style={[s.tr, s.totalRow]} wrap={false}>
          <Text style={[s.td, COLS[0]]}> </Text>
          <Text style={[s.td, s.bold, COLS[1], { textAlign: "left" }]}>
            Total
          </Text>
          <Text style={[s.td, s.bold, COLS[2]]}>{totalPct.toFixed(2)} %</Text>
          <Text style={[s.td, COLS[3]]}> </Text>
          <Text style={[s.td, s.bold, COLS[4]]}>
            {hasPrice ? aed(priceAed * (totalPct / 100)) : dash}
          </Text>
        </View>

        {/* The totals and the small print move together: never the note alone on a page. */}
        <View style={s.summary} wrap={false}>
          <View style={s.sumRow}>
            {buckets.map((b, i) => (
              <View
                key={b.label}
                style={i ? [s.sumCol, s.sumColGap] : s.sumCol}
              >
                <View style={s.sumHead}>
                  <Text style={s.sumHeadText}>{b.label}</Text>
                </View>
                <View style={s.sumValue}>
                  <Text style={s.sumValueText}>
                    {hasPrice ? `AED ${aed(b.value)}` : dash}
                  </Text>
                  <Text style={s.sumNote}>{b.note}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={s.note}>
            Indicative only. Milestone dates follow the developer&apos;s
            construction programme and may move; amounts exclude ADM
            registration fees, service charges and any mortgage costs. This
            document is not an offer or a reservation. Speak to your Bazar
            advisor before committing to a schedule.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
