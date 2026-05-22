/**
 * Sprint 12 — shared PDF layout (header + footer + tokens).
 *
 * Wrap every Bazar-branded PDF in <Shell title="…">…</Shell>. Renders
 * with @react-pdf/renderer; @react-pdf doesn't load Google fonts —
 * we ship system serif/sans defaults that look close to Instrument
 * Serif + Geist.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

export const palette = {
  bg: "#FAFAF6",
  ink: "#1B1A17",
  ink2: "#32312d",
  muted: "#7d8e7e",
  border: "#E5E5DF",
  accent: "#4B5A4C",
  danger: "#B33A2A",
  surface: "#FFFFFF",
};

export const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    backgroundColor: palette.bg,
    color: palette.ink,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.border,
    marginBottom: 28,
  },
  brand: {
    fontFamily: "Times-Italic",
    fontSize: 22,
    color: palette.ink,
    letterSpacing: -0.4,
  },
  brandSub: {
    fontFamily: "Helvetica",
    fontSize: 9,
    letterSpacing: 2,
    color: palette.muted,
    textTransform: "uppercase",
    marginTop: 4,
  },
  headerMeta: {
    fontSize: 9,
    color: palette.muted,
    textAlign: "right",
  },
  title: {
    fontFamily: "Times-Roman",
    fontSize: 32,
    color: palette.ink,
    letterSpacing: -0.8,
    lineHeight: 1.1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: palette.ink2,
    lineHeight: 1.5,
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: palette.muted,
    marginBottom: 6,
  },
  sectionH: {
    fontFamily: "Times-Roman",
    fontSize: 18,
    color: palette.ink,
    letterSpacing: -0.4,
    marginTop: 16,
    marginBottom: 10,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 56,
    right: 56,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: palette.border,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    color: palette.muted,
  },
  monoSm: {
    fontFamily: "Courier",
    fontSize: 9,
    color: palette.muted,
  },
  kv: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: palette.border,
  },
  kvLabel: { color: palette.muted, fontSize: 10 },
  kvValue: { color: palette.ink, fontSize: 11, fontFamily: "Courier" },
  pill: {
    fontSize: 9,
    color: palette.accent,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 0.5,
    borderColor: palette.accent,
    borderRadius: 2,
  },
});

export function Header({
  meta,
}: {
  meta?: string;
}): React.ReactElement {
  return (
    <View style={styles.header} fixed>
      <View>
        <Text style={styles.brand}>Bazar</Text>
        <Text style={styles.brandSub}>Abu Dhabi · ORN 28041</Text>
      </View>
      <Text style={styles.headerMeta}>{meta ?? new Date().toLocaleDateString()}</Text>
    </View>
  );
}

export function Footer(): React.ReactElement {
  return (
    <View style={styles.footer} fixed>
      <Text>bazar.ae · hello@bazar.ae</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

export function Shell({
  title,
  subtitle,
  meta,
  children,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Document
      title={title}
      author="Bazar Real Estate"
      creator="Bazar Real Estate"
    >
      <Page size="A4" style={styles.page}>
        <Header meta={meta} />
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
        <Footer />
      </Page>
    </Document>
  );
}
