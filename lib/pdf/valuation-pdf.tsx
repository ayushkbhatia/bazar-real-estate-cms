/**
 * Sprint 12 — valuation report PDF.
 *
 * Rendered by /api/pdf/valuation/[id]. Authenticated users (the owner
 * or staff) receive the full report including the advisor's note;
 * anonymous downloads omit the advisor block.
 */

import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { Shell, styles, palette } from "./_shared";

export type ValuationReport = {
  id: string;
  owner_name: string | null;
  property_type: string;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  building_name: string | null;
  area_name: string | null;
  estimate_low_aed: number | null;
  estimate_mid_aed: number | null;
  estimate_high_aed: number | null;
  advisor_estimate_aed: number | null;
  advisor_notes: string | null;
  sent_at: string | null;
};

function formatAED(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return `AED ${Math.round(n).toLocaleString()}`;
}

function formatRange(low: number | null, high: number | null): string {
  if (low === null || high === null) return "—";
  return `${formatAED(low)} — ${formatAED(high)}`;
}

export function ValuationReportPdf({
  report,
  hideAdvisorBlock = false,
}: {
  report: ValuationReport;
  hideAdvisorBlock?: boolean;
}): React.ReactElement {
  const headline = report.building_name
    ? `${report.beds}-bed ${report.property_type} · ${report.building_name}`
    : `${report.beds}-bed ${report.property_type}`;

  const dateLine = report.sent_at
    ? new Date(report.sent_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString();

  return (
    <Shell title="Valuation report" subtitle={headline} meta={dateLine}>
      <View>
        <Text style={styles.eyebrow}>Subject</Text>
        <View>
          <KV label="Property type" value={report.property_type} />
          <KV label="Bedrooms" value={String(report.beds)} />
          <KV label="Bathrooms" value={String(report.baths)} />
          {report.built_up_ft2 ? (
            <KV
              label="Built-up area"
              value={`${report.built_up_ft2.toLocaleString()} ft²`}
            />
          ) : null}
          {report.building_name ? (
            <KV label="Building" value={report.building_name} />
          ) : null}
          {report.area_name ? <KV label="Area" value={report.area_name} /> : null}
        </View>

        <Text style={[styles.eyebrow, { marginTop: 28 }]}>Range</Text>
        <View
          style={{
            backgroundColor: palette.surface,
            borderWidth: 0.5,
            borderColor: palette.border,
            padding: 14,
            marginTop: 4,
          }}
        >
          <Text style={{ fontSize: 10, color: palette.muted }}>
            Bazar valuation range
          </Text>
          <Text
            style={{
              fontFamily: "Times-Roman",
              fontSize: 22,
              color: palette.ink,
              letterSpacing: -0.4,
              marginTop: 4,
            }}
          >
            {formatRange(report.estimate_low_aed, report.estimate_high_aed)}
          </Text>
          {report.estimate_mid_aed !== null ? (
            <Text style={{ fontSize: 10, color: palette.muted, marginTop: 6 }}>
              Midpoint · {formatAED(report.estimate_mid_aed)}
            </Text>
          ) : null}
        </View>

        {!hideAdvisorBlock && report.advisor_estimate_aed !== null ? (
          <>
            <Text style={[styles.eyebrow, { marginTop: 28 }]}>
              Advisor estimate
            </Text>
            <Text
              style={{
                fontFamily: "Times-Roman",
                fontSize: 18,
                color: palette.ink,
                letterSpacing: -0.4,
              }}
            >
              {formatAED(report.advisor_estimate_aed)}
            </Text>
          </>
        ) : null}

        {!hideAdvisorBlock && report.advisor_notes ? (
          <>
            <Text style={[styles.eyebrow, { marginTop: 24 }]}>Advisor note</Text>
            <View
              style={{
                paddingLeft: 12,
                borderLeftWidth: 2,
                borderLeftColor: palette.accent,
              }}
            >
              <Text style={{ color: palette.ink2, fontSize: 11 }}>
                {report.advisor_notes}
              </Text>
            </View>
          </>
        ) : null}

        <Text style={[styles.eyebrow, { marginTop: 32 }]}>
          How this estimate was prepared
        </Text>
        <Text style={{ color: palette.ink2, fontSize: 10, lineHeight: 1.6 }}>
          Range derived from DLD transactions in the last 12 months adjusted
          for floor, view, finish quality, and tenancy status. Where DLD
          coverage is thin (off-plan handovers, niche communities) we
          supplement with broker-channel comparables and Bazar advisor
          judgement.
        </Text>

        <Text style={[styles.eyebrow, { marginTop: 24 }]}>What to do next</Text>
        <Text style={{ color: palette.ink, fontSize: 11, marginBottom: 6 }}>
          Talk to a Bazar advisor before listing or accepting an offer. We
          will share fresh comparables, marketing strategy, and timing
          considerations.
        </Text>
        <Text style={{ color: palette.muted, fontSize: 10 }}>
          Reply to the email you received this report from, or book a 30-min
          advisory call at bazar.ae.
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
