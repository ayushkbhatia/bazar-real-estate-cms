/**
 * Market Report PDF (T1-A).
 *
 * Renders a 1-2 page advisor-prepared PDF summarising a per-area-per-type
 * quarterly snapshot. Reuses the shared @react-pdf shell (`lib/pdf/_shared`).
 */

import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { Shell, palette, styles } from "./_shared";
import {
  propertyTypeLabel,
  quarterLabel,
  type Comparable,
  type Snapshot,
  type TrendPoint,
} from "@/lib/queries/market-reports";
import {
  formatPrice,
  formatArea,
  type Preferences,
} from "@/lib/preferences";

type Props = {
  snapshot: Snapshot;
  trend: TrendPoint[];
  comparables: Comparable[];
  prefs: Preferences;
};

function fmtDate(s: string): string {
  const d = new Date(s + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function MarketReportPDF({ snapshot, trend, comparables, prefs }: Props) {
  const yoyPct =
    snapshot.yoy_change != null
      ? Math.round(snapshot.yoy_change * 1000) / 10
      : null;

  return (
    <Shell
      title={`${snapshot.area_name} ${propertyTypeLabel(snapshot.property_type)} report`}
      subtitle={`${quarterLabel(snapshot.quarter)} · Closed transactions on DLD record. Compiled ${new Date().toLocaleDateString("en-GB")}.`}
      meta={`${quarterLabel(snapshot.quarter)} report`}
    >
      <Text style={styles.eyebrow}>Snapshot</Text>
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginBottom: 18,
        }}
      >
        <PdfTile
          label="Median price"
          value={formatPrice(snapshot.median_price_aed, prefs)}
        />
        <PdfTile
          label={prefs.area_unit === "m2" ? "Median AED/m²" : "Median AED/ft²"}
          value={
            snapshot.median_aed_per_ft2 == null
              ? "—"
              : formatPrice(
                  prefs.area_unit === "m2"
                    ? snapshot.median_aed_per_ft2 * 10.7639
                    : snapshot.median_aed_per_ft2,
                  prefs,
                )
          }
        />
        <PdfTile
          label="YoY change"
          value={yoyPct == null ? "—" : `${yoyPct >= 0 ? "+" : ""}${yoyPct}%`}
        />
        <PdfTile label="Transactions" value={snapshot.count.toLocaleString()} />
      </View>

      <Text style={styles.sectionH}>Trend · 8 quarters</Text>
      <View>
        {trend.map((p, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 4,
              borderBottomWidth: 0.5,
              borderBottomColor: palette.border,
            }}
          >
            <Text style={{ color: palette.muted, fontSize: 10 }}>
              {quarterLabel(p.quarter)}
            </Text>
            <Text style={{ fontFamily: "Courier", fontSize: 10, color: palette.ink }}>
              {p.median_price_aed == null
                ? "—"
                : formatPrice(p.median_price_aed, prefs)}
              {"  ·  "}
              {p.count.toLocaleString()} txns
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionH}>Recent transactions</Text>
      <View>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: palette.bg,
            paddingHorizontal: 6,
            paddingVertical: 5,
            borderBottomWidth: 0.5,
            borderBottomColor: palette.border,
          }}
        >
          <Text style={{ flex: 1.2, fontSize: 8, color: palette.muted, textTransform: "uppercase", letterSpacing: 1 }}>
            Closed
          </Text>
          <Text style={{ flex: 1, fontSize: 8, color: palette.muted, textTransform: "uppercase", letterSpacing: 1 }}>
            Type
          </Text>
          <Text style={{ flex: 0.6, fontSize: 8, color: palette.muted, textTransform: "uppercase", letterSpacing: 1 }}>
            Beds
          </Text>
          <Text style={{ flex: 1.2, fontSize: 8, color: palette.muted, textTransform: "uppercase", letterSpacing: 1 }}>
            Area
          </Text>
          <Text style={{ flex: 1.4, fontSize: 8, color: palette.muted, textTransform: "uppercase", letterSpacing: 1, textAlign: "right" }}>
            Price
          </Text>
        </View>
        {comparables.map((r, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              paddingHorizontal: 6,
              paddingVertical: 5,
              borderBottomWidth: 0.5,
              borderBottomColor: palette.border,
            }}
          >
            <Text style={{ flex: 1.2, fontFamily: "Courier", fontSize: 9, color: palette.ink2 }}>
              {fmtDate(r.transaction_date)}
            </Text>
            <Text style={{ flex: 1, fontSize: 9, color: palette.ink }}>
              {r.property_type}
            </Text>
            <Text style={{ flex: 0.6, fontSize: 9, color: palette.ink }}>
              {r.bedrooms != null ? r.bedrooms : "—"}
            </Text>
            <Text style={{ flex: 1.2, fontFamily: "Courier", fontSize: 9, color: palette.ink2 }}>
              {formatArea(r.built_up_ft2, prefs.area_unit)}
            </Text>
            <Text style={{ flex: 1.4, fontFamily: "Courier", fontSize: 9, color: palette.ink, textAlign: "right" }}>
              {formatPrice(r.price_aed, prefs)}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 24 }}>
        <Text style={styles.pill}>Bazar advisor commentary</Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 11,
            color: palette.ink2,
            lineHeight: 1.65,
          }}
        >
          Closed-book numbers only. Off-market and pre-listed activity excluded.
          For a personal interpretation — including buyer-pool composition,
          time-to-close, and whether the median masks a wide distribution —
          speak with your Bazar advisor.
        </Text>
      </View>
    </Shell>
  );
}

function PdfTile({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        padding: 10,
        backgroundColor: palette.surface,
        borderWidth: 0.5,
        borderColor: palette.border,
        borderRadius: 4,
      }}
    >
      <Text
        style={{
          fontSize: 8,
          color: palette.muted,
          textTransform: "uppercase",
          letterSpacing: 1.4,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "Times-Roman",
          fontSize: 16,
          color: palette.ink,
          marginTop: 4,
          letterSpacing: -0.2,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
