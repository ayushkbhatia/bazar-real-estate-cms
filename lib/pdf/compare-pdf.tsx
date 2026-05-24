/**
 * BF-6 — Compare PDF.
 *
 * /tools/compare snapshot ⇒ branded PDF. The page already aggregates
 * everything we need server-side (per-property attribute grid +
 * verdict band); the route flattens that to a ComparePropertyRow[]
 * shape and renders one column per property.
 */

import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { Shell, styles, palette } from "./_shared";

export type ComparePropertyRow = {
  reference: string;
  title: string;
  area_name: string | null;
  price_aed: number;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  type: string;
  tenure: string | null;
  furnishing: string | null;
  view: string | null;
  amenities: string[];
};

function formatAED(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `AED ${Math.round(n).toLocaleString()}`;
}

function safe(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export function ComparePdf({
  properties,
}: {
  properties: ComparePropertyRow[];
}): React.ReactElement {
  const cols = properties.slice(0, 4); // hard-cap to keep layout sane
  const colWidth = cols.length > 0 ? `${100 / cols.length}%` : "100%";

  const rows: { label: string; get: (p: ComparePropertyRow) => string }[] = [
    { label: "Reference", get: (p) => p.reference },
    { label: "Area", get: (p) => safe(p.area_name) },
    { label: "Price", get: (p) => formatAED(p.price_aed) },
    { label: "Type", get: (p) => safe(p.type) },
    { label: "Beds", get: (p) => String(p.beds) },
    { label: "Baths", get: (p) => String(p.baths) },
    {
      label: "Built-up",
      get: (p) => (p.built_up_ft2 ? `${p.built_up_ft2.toLocaleString()} ft²` : "—"),
    },
    {
      label: "Price / ft²",
      get: (p) =>
        p.built_up_ft2 && p.built_up_ft2 > 0
          ? formatAED(Math.round(p.price_aed / p.built_up_ft2))
          : "—",
    },
    { label: "Tenure", get: (p) => safe(p.tenure) },
    { label: "Furnishing", get: (p) => safe(p.furnishing) },
    { label: "View", get: (p) => safe(p.view) },
    {
      label: "Amenities",
      get: (p) =>
        p.amenities.length > 0 ? p.amenities.slice(0, 6).join(", ") : "—",
    },
  ];

  return (
    <Shell
      title="Property comparison"
      subtitle={`${cols.length} propert${cols.length === 1 ? "y" : "ies"} side by side. Generated ${new Date().toLocaleDateString()}.`}
    >
      <View>
        <Text style={styles.eyebrow}>Subjects</Text>
        <View
          style={{
            flexDirection: "row",
            borderTopWidth: 0.5,
            borderTopColor: palette.border,
            paddingVertical: 8,
          }}
        >
          {cols.map((c, i) => (
            <View
              key={c.reference + "-h"}
              style={{
                width: colWidth,
                paddingHorizontal: 8,
                borderLeftWidth: i === 0 ? 0 : 0.5,
                borderLeftColor: palette.border,
              }}
            >
              <Text
                style={{
                  fontFamily: "Times-Roman",
                  fontSize: 13,
                  letterSpacing: -0.3,
                  color: palette.ink,
                }}
              >
                {c.title}
              </Text>
              <Text style={{ fontSize: 9, color: palette.muted, marginTop: 2 }}>
                {c.reference}
              </Text>
            </View>
          ))}
        </View>

        {rows.map((row) => (
          <View
            key={row.label}
            style={{
              flexDirection: "row",
              borderTopWidth: 0.5,
              borderTopColor: palette.border,
            }}
          >
            <View
              style={{
                width: 110,
                padding: 8,
                backgroundColor: palette.bg,
              }}
            >
              <Text style={{ fontSize: 10, color: palette.muted }}>
                {row.label}
              </Text>
            </View>
            <View style={{ flexDirection: "row", flex: 1 }}>
              {cols.map((c, i) => (
                <View
                  key={`${row.label}-${c.reference}`}
                  style={{
                    width: colWidth,
                    paddingHorizontal: 8,
                    paddingVertical: 8,
                    borderLeftWidth: i === 0 ? 0 : 0.5,
                    borderLeftColor: palette.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10.5,
                      color: palette.ink,
                      fontFamily: "Courier",
                    }}
                  >
                    {row.get(c)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <Text style={[styles.eyebrow, { marginTop: 24 }]}>Bazar verdict</Text>
        <Text style={{ color: palette.ink2, fontSize: 11, lineHeight: 1.6 }}>
          Use price/ft² as the baseline comparison; in Abu Dhabi the
          quartile spread by community is usually larger than the spread
          by bedroom count. If two properties are within 10% on
          price/ft², orientation + view + finish typically drive the
          decision. Your Bazar advisor can run scenario-specific yields
          and 5-year resale projections on any of these.
        </Text>
      </View>
    </Shell>
  );
}
