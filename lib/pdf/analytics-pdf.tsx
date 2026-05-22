/**
 * Sprint 12 — analytics export PDF for /admin/analytics.
 *
 * Admin-only via /api/pdf/analytics. Captures KPI tiles + the 4
 * supporting tables (traffic-by-source / top-searches /
 * top-neighborhoods / agent-leaderboard) in a single document.
 */

import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { Shell, styles, palette } from "./_shared";

export type AnalyticsSnapshot = {
  rangeLabel: string;
  kpis: {
    site_visits: number;
    property_views: number;
    enquiry_conversion_pct: number;
    form_completions: number;
    closes_aed: number;
  };
  traffic_by_source: { label: string; visits: number; share: number }[];
  top_searches: { query: string; count: number }[];
  top_neighborhoods: { slug: string; name: string; views: number }[];
  agent_leaderboard: {
    display_name: string;
    title: string | null;
    closedAed: number;
    deals: number;
  }[];
};

function fmtInt(n: number): string {
  return n.toLocaleString();
}
function fmtAed(n: number): string {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n.toLocaleString()}`;
}

export function AnalyticsPdf({
  snapshot,
}: {
  snapshot: AnalyticsSnapshot;
}): React.ReactElement {
  return (
    <Shell
      title="Analytics export"
      subtitle={snapshot.rangeLabel}
      meta={new Date().toLocaleDateString()}
    >
      <View>
        <Text style={styles.eyebrow}>KPIs</Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <Kpi label="Site visits" value={fmtInt(snapshot.kpis.site_visits)} />
          <Kpi
            label="Property views"
            value={fmtInt(snapshot.kpis.property_views)}
          />
          <Kpi
            label="Enquiry conversion"
            value={`${snapshot.kpis.enquiry_conversion_pct.toFixed(1)}%`}
          />
          <Kpi
            label="Form completions"
            value={fmtInt(snapshot.kpis.form_completions)}
          />
          <Kpi
            label="Closes (AED)"
            value={fmtAed(snapshot.kpis.closes_aed)}
          />
        </View>

        <Text style={styles.sectionH}>Traffic by source</Text>
        <View>
          {snapshot.traffic_by_source.map((r) => (
            <View key={r.label} style={styles.kv}>
              <Text style={styles.kvLabel}>{r.label}</Text>
              <Text style={styles.kvValue}>
                {fmtInt(r.visits)} · {(r.share * 100).toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionH}>Top searches</Text>
        <View>
          {snapshot.top_searches.map((r, i) => (
            <View key={r.query} style={styles.kv}>
              <Text style={styles.kvLabel}>
                {String(i + 1).padStart(2, "0")} · {r.query}
              </Text>
              <Text style={styles.kvValue}>{fmtInt(r.count)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionH}>Top neighborhoods</Text>
        <View>
          {snapshot.top_neighborhoods.map((r) => (
            <View key={r.slug} style={styles.kv}>
              <Text style={styles.kvLabel}>{r.name}</Text>
              <Text style={styles.kvValue}>{fmtInt(r.views)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionH}>Agent leaderboard</Text>
        <View>
          {snapshot.agent_leaderboard.map((r) => (
            <View key={r.display_name} style={styles.kv}>
              <Text style={styles.kvLabel}>
                {r.display_name}
                {r.title ? ` · ${r.title}` : ""}
              </Text>
              <Text style={styles.kvValue}>
                {fmtAed(r.closedAed)} · {r.deals} deals
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Shell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        width: "30%",
        borderWidth: 0.5,
        borderColor: palette.border,
        backgroundColor: palette.surface,
        padding: 10,
      }}
    >
      <Text
        style={{
          fontSize: 7.5,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: palette.muted,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "Times-Roman",
          fontSize: 20,
          color: palette.ink,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
