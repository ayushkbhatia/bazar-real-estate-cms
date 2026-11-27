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
 *
 * It is the one PDF drawn in Arabic too (client, 27 Nov 2026): a visitor on
 * /ar downloads it in Arabic, right to left. @react-pdf shapes Arabic and
 * runs bidi inside a line, but Yoga lays rows out left to right whatever the
 * direction (lib/pdf/language-note.ts), so the mirroring is done here by
 * hand: every row is `row-reverse`, every side rule swaps sides and text
 * aligns right. The face is IBM Plex Sans Arabic, embedded from
 * lib/pdf/fonts (OFL), the same face /ar ships with; it carries Latin and
 * digits as well, so figures and English names print in the same face.
 * The other PDFs stay English (`pdfLanguageSuffix`).
 */

import React from "react";
import path from "node:path";
import {
  renderToBuffer,
  Document,
  Font,
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
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { arabicFor } from "@/lib/i18n/arabic-store";
import { paymentPlanWords, type PaymentPlanWords } from "./payment-plan-words";

/** The embedded Arabic face. Registered once per server instance. */
const ARABIC_FONT = "IBM Plex Sans Arabic";
const FONT_DIR = path.join(process.cwd(), "lib/pdf/fonts");
Font.register({
  family: ARABIC_FONT,
  fonts: [
    { src: path.join(FONT_DIR, "IBMPlexSansArabic-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "IBMPlexSansArabic-SemiBold.ttf"), fontWeight: 600 },
  ],
});

type CachedGlyph = { codePoints: number[] };
type GlyphSource = {
  getGlyph: (id: number, characters?: number[]) => CachedGlyph | null;
};
const mended = new WeakSet<object>();

/**
 * Load the Arabic face and mend fontkit's glyph cache before a render.
 *
 * fontkit keeps one glyph object per id, made by whichever call asked first.
 * Subsetting the font into a PDF asks for glyphs by id alone, with no code
 * points, so after the FIRST Arabic PDF an instance's "2" and "0" are cached
 * as glyphs that stand for no character. textkit maps glyphs back to the
 * string by those code points, so the next PDF with a figure beside Arabic
 * ("120 درهم") lost a character and threw inside the bidi pass
 * ("Cannot read properties of undefined (reading 'id')"). Every request after
 * the first on a warm server would have failed.
 *
 * The mend: when a cached glyph has no code points and the caller knows
 * them, take the caller's. Done on the loaded font instance only, so no other
 * font, and no other PDF, is touched.
 */
async function prepareArabicFont(): Promise<void> {
  for (const fontWeight of [400, 600] as const) {
    const descriptor = { fontFamily: ARABIC_FONT, fontWeight };
    await Font.load(descriptor);
    const font = (Font.getFont(descriptor) as unknown as { data?: GlyphSource } | null)?.data;
    if (!font || mended.has(font)) continue;
    const getGlyph = font.getGlyph.bind(font);
    font.getGlyph = (id, characters = []) => {
      const glyph = getGlyph(id, characters);
      if (glyph && glyph.codePoints.length === 0 && characters.length > 0) {
        glyph.codePoints = characters;
      }
      return glyph;
    };
    mended.add(font);
  }
}

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

function makeStyles(rtl: boolean) {
  // Bold, a row, and a rule on the side a row's next cell starts from: the
  // three things that differ when the page is drawn right to left.
  const bold = rtl
    ? { fontFamily: ARABIC_FONT, fontWeight: 600 as const }
    : { fontFamily: "Helvetica-Bold" };
  const row = rtl ? ("row-reverse" as const) : ("row" as const);
  const ruleSide = (color: string) =>
    rtl
      ? { borderRightWidth: 1, borderRightColor: color }
      : { borderLeftWidth: 1, borderLeftColor: color };
  // Arabic joins its letters; tracking pulls them apart.
  const track = (n: number) => (rtl ? 0 : n);
  return StyleSheet.create({
  page: {
    paddingTop: LETTERHEAD_SAFE.top,
    paddingBottom: LETTERHEAD_SAFE.bottom,
    paddingHorizontal: LETTERHEAD_SAFE.side,
    fontFamily: rtl ? ARABIC_FONT : "Helvetica",
    // The bidi pass's paragraph direction, inherited by every line: without
    // it a line is laid out as English and "التاريخ: 27 نوفمبر" reads backwards.
    ...(rtl ? { direction: "rtl" as const } : {}),
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
    ...bold,
    fontSize: 24,
    lineHeight: 1,
    letterSpacing: track(1.2),
    color: c.navy,
  },
  titleSub: {
    fontSize: 9,
    lineHeight: 1.2,
    color: c.muted,
    marginTop: 8,
    letterSpacing: track(0.4),
    textAlign: "right",
  },

  metaRow: {
    flexDirection: row,
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: c.rule,
    borderBottomWidth: 1,
    borderBottomColor: c.rule,
  },
  metaLabel: { ...bold },

  greeting: { marginTop: 12, marginBottom: 12 },
  greetingHead: { ...bold, marginBottom: 3 },
  greetingBody: { color: c.ink2 },

  band: { flexDirection: row, backgroundColor: c.sand, paddingVertical: 9 },
  bandCell: { flex: 1, paddingHorizontal: 8, alignItems: "center" },
  bandDivider: ruleSide("#C9BFAE"),
  bandLabel: {
    ...bold,
    fontSize: 8.5,
    marginBottom: 3,
    color: c.ink,
  },
  bandValue: { fontSize: 8.5, color: c.ink2, textAlign: "center" },

  grid: { marginTop: 8, borderWidth: 1, borderColor: c.rule },
  gridRow: { flexDirection: row },
  gridRowRule: { borderTopWidth: 1, borderTopColor: c.rule },
  gridCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: row,
  },
  gridCellRule: ruleSide(c.rule),
  // The gap before the value: a trailing space would be trimmed at the
  // run's edge on the right-to-left page.
  gridLabel: { ...bold, fontSize: 8, ...(rtl ? { marginLeft: 3 } : {}) },
  gridValue: { fontSize: 8, color: c.ink2, flexShrink: 1 },

  sectionHead: {
    marginTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: c.rule,
    ...bold,
    fontSize: 12.5,
    letterSpacing: track(0.6),
    color: c.ink,
  },
  sectionSub: { fontSize: 8, color: c.muted, marginTop: 5, marginBottom: 6 },

  thead: { flexDirection: row, backgroundColor: c.navy },
  th: {
    ...bold,
    fontSize: 8,
    color: c.white,
    paddingVertical: 5,
    paddingHorizontal: 6,
    textAlign: "center",
  },
  tr: {
    flexDirection: row,
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
  tdRule: ruleSide(c.rule),
  totalRow: { backgroundColor: c.sand },
  bold: { ...bold },

  summary: { marginTop: 14 },
  sumHead: {
    backgroundColor: c.navy,
    paddingVertical: 4.5,
    alignItems: "center",
  },
  sumHeadText: { ...bold, fontSize: 8.5, color: c.white },
  sumValue: {
    backgroundColor: c.sand,
    paddingVertical: 6,
    alignItems: "center",
    flexGrow: 1,
  },
  sumValueText: { ...bold, fontSize: 9.5, color: c.ink },
  sumNote: { fontSize: 7.5, color: c.muted, marginTop: 2 },
  sumRow: { flexDirection: row },
  sumCol: { flex: 1 },
  sumColGap: rtl ? { marginRight: 1 } : { marginLeft: 1 },

  // Denser drawings for a plan that would not fit one page (see `density`).
  tdTight: { paddingVertical: 1.5 },
  tdCompact: { paddingVertical: 1, fontSize: 7, lineHeight: 1.15 },
  gapTight: { marginTop: 10 },
  bandTight: { paddingVertical: 6 },
  note: { fontSize: 7, color: c.muted, marginTop: 10, lineHeight: 1.45 },
  /** Where a line of running text starts. */
  start: { textAlign: rtl ? "right" : "left" },
  });
}

const STYLES = { ltr: makeStyles(false), rtl: makeStyles(true) } as const;

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

/**
 * A milestone's words in the PDF's language: the editor's typed twin, then
 * the site's Arabic store, then the English.
 *
 * Folded at the point of printing and never on the plan itself, for the
 * reason `useMilestoneText` gives on the project page: `splitPaymentPlan`
 * finds the handover row by matching the ENGLISH label, so a plan folded
 * upstream would split its totals wrongly.
 */
export function inLanguage(
  locale: Locale,
  english: string | null | undefined,
  typed?: string | null,
): string {
  if (!english) return english ?? "";
  if (locale === DEFAULT_LOCALE) return english;
  if (typed?.trim()) return typed.trim();
  return arabicFor(english) ?? english;
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
  /** The page's language. Arabic draws the whole document right to left. */
  locale?: Locale;
  /**
   * The currency and area words, from the site's unit dictionary
   * (`getPublicUnitLabels`). Unset, the shipped words for the locale.
   */
  labels?: { currency: string; area: string };
  /**
   * How tightly to draw: 0 as designed, 1 tighter rows and gaps, 2 smaller
   * rows still and no greeting, 3 (only extreme text: every field at its
   * limit) also without the unit-details grid. Unset, a plan of more than eight milestones
   * starts at 1. The route steps up until the document is one page.
   */
  density?: 0 | 1 | 2 | 3;
};

type Styles = (typeof STYLES)["ltr"];

function Cell({
  s,
  label,
  value,
  rule,
}: {
  s: Styles;
  label: string;
  value: string;
  rule?: boolean;
}) {
  return (
    <View style={rule ? [s.gridCell, s.gridCellRule] : s.gridCell}>
      <Text style={s.gridLabel}>{label}:{s === STYLES.rtl ? "" : " "}</Text>
      <Text style={s.gridValue}>{value}</Text>
    </View>
  );
}

/** "Q4 2029" → its parts, so Arabic can write the quarter in words. */
function parseQuarter(v: string): { q: number; year: number } | null {
  const m = /^Q([1-4])\s+(\d{4})$/.exec(v.trim());
  return m ? { q: Number(m[1]), year: Number(m[2]) } : null;
}

export function PaymentPlanPdf({
  developmentName,
  priceAed,
  plan,
  project,
  unit,
  letterhead,
  issuedAt = new Date(),
  locale = DEFAULT_LOCALE,
  labels,
  density,
}: PaymentPlanPdfProps): React.ReactElement {
  const rtl = locale === "ar";
  const s = rtl ? STYLES.rtl : STYLES.ltr;
  const w: PaymentPlanWords = paymentPlanWords(locale);
  const cur = labels?.currency ?? (rtl ? "درهم" : "AED");
  const areaUnit = labels?.area ?? (rtl ? "قدم²" : "ft²");
  const say = (english: string | null | undefined, typed?: string | null) =>
    inLanguage(locale, english, typed);

  const split = splitPaymentPlan(plan);
  const breakdown = computePaymentBreakdown(plan, priceAed);
  const hasPrice = priceAed > 0;
  const dash = "—";
  const starting = unit?.kind === "starting";
  const level = density ?? (plan.milestones.length > 8 ? 1 : 0);
  const tight = level >= 1;
  const td =
    level >= 2 ? [s.td, s.tdCompact] : tight ? [s.td, s.tdTight] : [s.td];
  const totalPct = plan.milestones.reduce((sum, m) => sum + m.percent, 0);
  const name = say(developmentName);
  const unitType = unit?.type ? say(unit.type) : null;

  const intro = w.intro({
    name,
    what: starting ? "starting" : (unit?.kind ?? null),
    type: unitType,
    hasPrice,
  });

  // The handover row's timing, in the words that row prints.
  const handoverTiming = split.handoverTiming
    ? say(
        split.handoverTiming,
        plan.milestones.find((m) => m.timing === split.handoverTiming)?.timing_ar,
      )
    : null;

  const buckets: { label: string; value: number; note: string }[] = [
    {
      label: w.duringConstruction,
      value: breakdown.construction,
      note: [
        `${split.constructionPct}%`,
        split.constructionCount > 0 ? w.instalments(split.constructionCount) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    {
      label: w.atHandover,
      value: breakdown.handover,
      note: [`${split.handoverPct}%`, handoverTiming].filter(Boolean).join(" · "),
    },
  ];
  if (split.postHandoverPct > 0) {
    buckets.push({
      label: w.postHandover,
      value: breakdown.postHandover,
      note: plan.post_handover_months
        ? w.overMonths(split.postHandoverPct, plan.post_handover_months)
        : `${split.postHandoverPct}%`,
    });
  }

  const handover =
    project?.handover && project.handover !== dash ? project.handover : null;
  const quarter = handover ? parseQuarter(handover) : null;

  const band = [
    { label: w.project, value: name },
    { label: w.location, value: w.place(project?.area ? say(project.area) : null) },
    {
      label: w.handover,
      value: quarter ? w.quarter(quarter.q, quarter.year) : (handover ?? dash),
    },
    {
      label: starting ? w.startingPrice(cur) : w.price(cur),
      value: hasPrice ? aed(priceAed) : dash,
    },
  ];

  const heads = w.heads.map((h, i) => (i === 4 ? `${h} (${cur})` : h));

  return (
    <Document
      title={w.docTitle(name)}
      author={w.company}
      creator={w.company}
      language={rtl ? "ar" : "en"}
    >
      {/*
        One page, always (client, Nov 2026): the plan is one sheet an
        advisor hands over. A long plan is drawn tighter (`density`), and
        the route redraws it denser still if it ever runs to a second page.
        (Not `wrap={false}` on the page: that shrinks the page to its
        content instead of keeping A4.)
      */}
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

        {/* Beside the logo, which is top left in both languages. */}
        <View style={s.title}>
          <Text style={s.titleText}>{w.title}</Text>
          <Text style={s.titleSub}>{name}</Text>
        </View>

        <View style={s.metaRow}>
          <Text>
            <Text style={s.metaLabel}>{w.preparedBy}</Text>
            {w.company}
          </Text>
          <Text>
            <Text style={s.metaLabel}>{w.date}</Text>
            {w.issued(issuedAt)}
          </Text>
        </View>

        {level < 2 ? (
          <View style={s.greeting}>
            <Text style={[s.greetingHead, s.start]}>{w.dear}</Text>
            <Text style={[s.greetingBody, s.start]}>{intro}</Text>
          </View>
        ) : (
          <View style={s.gapTight} />
        )}

        <View style={tight ? [s.band, s.bandTight] : s.band}>
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

        {level < 3 ? (
          <View style={s.grid} wrap={false}>
            <View style={s.gridRow}>
              <Cell
                s={s}
                label={w.unitType}
                value={starting ? w.startingPriceValue : unitType || dash}
              />
              <Cell
                s={s}
                rule
                label={w.bedrooms}
                value={unit?.beds ? String(unit.beds) : dash}
              />
              <Cell
                s={s}
                rule
                label={
                  unit?.kind === "unitType" ? w.sizeFrom(areaUnit) : w.size(areaUnit)
                }
                value={
                  unit?.areaFt2
                    ? Math.round(unit.areaFt2).toLocaleString("en-AE")
                    : dash
                }
              />
            </View>
            <View style={[s.gridRow, s.gridRowRule]}>
              <Cell
                s={s}
                label={w.developer}
                value={project?.developer ? say(project.developer) : dash}
              />
              <Cell
                s={s}
                rule
                label={w.instalmentsLabel}
                value={String(plan.milestones.length)}
              />
            </View>
          </View>
        ) : null}

        <Text
          style={
            tight ? [s.sectionHead, s.start, s.gapTight] : [s.sectionHead, s.start]
          }
        >
          {w.title}
        </Text>
        <Text style={[s.sectionSub, s.start]}>{say(plan.name, plan.name_ar)}</Text>

        <View style={s.thead} fixed={false}>
          {heads.map((h, i) => (
            <Text key={h} style={[s.th, COLS[i]!, i === 1 ? s.start : {}]}>
              {h}
            </Text>
          ))}
        </View>
        {plan.milestones.map((m, i) => (
          <View key={`${m.label}-${i}`} style={s.tr} wrap={false}>
            <Text style={[...td, COLS[0]]}>{i + 1}</Text>
            <Text style={[...td, s.tdRule, COLS[1], s.start]}>
              {say(m.label, m.label_ar)}
            </Text>
            <Text style={[...td, s.tdRule, COLS[2]]}>
              {w.percent(m.percent.toFixed(2))}
            </Text>
            <Text style={[...td, s.tdRule, COLS[3]]}>
              {m.timing ? say(m.timing, m.timing_ar) : dash}
            </Text>
            <Text style={[...td, s.tdRule, COLS[4]]}>
              {hasPrice ? aed(priceAed * (m.percent / 100)) : dash}
            </Text>
          </View>
        ))}
        <View style={[s.tr, s.totalRow]} wrap={false}>
          <Text style={[...td, COLS[0]]}> </Text>
          <Text style={[...td, s.bold, COLS[1], s.start]}>{w.total}</Text>
          <Text style={[...td, s.bold, COLS[2]]}>
            {w.percent(totalPct.toFixed(2))}
          </Text>
          <Text style={[...td, COLS[3]]}> </Text>
          <Text style={[...td, s.bold, COLS[4]]}>
            {hasPrice ? aed(priceAed * (totalPct / 100)) : dash}
          </Text>
        </View>

        {/* The totals and the small print stay together. */}
        <View style={tight ? [s.summary, s.gapTight] : s.summary} wrap={false}>
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
                    {hasPrice ? w.money(aed(b.value), cur) : dash}
                  </Text>
                  <Text style={s.sumNote}>{b.note}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={[s.note, s.start]}>{w.note}</Text>
        </View>
      </Page>
    </Document>
  );
}

/** Pages in a PDF @react-pdf wrote: one `/Type /Page` object each. */
export function pdfPageCount(pdf: Buffer): number {
  return pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
}

/**
 * The PDF, on one page. Drawn as designed first; if it runs to a second page
 * (a twelve-milestone plan with long labels) it is redrawn denser until it
 * fits, and the densest drawing goes out regardless.
 */
export async function renderPaymentPlanPdf(
  props: Omit<PaymentPlanPdfProps, "density">,
): Promise<Buffer> {
  if (props.locale === "ar") await prepareArabicFont();
  const first = props.plan.milestones.length > 8 ? 1 : 0;
  let pdf: Buffer = Buffer.alloc(0);
  for (const density of ([0, 1, 2, 3] as const).filter((d) => d >= first)) {
    // @react-pdf wants a Document-rooted element, which this is; TS can't see through the component.
    pdf = await renderToBuffer(
      React.createElement(PaymentPlanPdf, {
        ...props,
        density,
      }) as unknown as Parameters<typeof renderToBuffer>[0],
    );
    if (pdfPageCount(pdf) <= 1) break;
  }
  return pdf;
}
