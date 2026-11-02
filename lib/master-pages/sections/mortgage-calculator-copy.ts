/**
 * The mortgage calculator's own words, as sections of the Mortgage page.
 *
 * Every section head on /tools/mortgage was already a field; what wasn't was
 * the calculator itself — the slider labels, the monthly payment and totals,
 * the debt-burden gauge, the closing-cost lines, the scenario cards and the
 * PDF button. Those are next-intl messages (`tools.mortgage` in
 * `messages/{en,ar}/tools.json`) read by client components, and they are made
 * editable the way the mortgage application wizard's are (`catalogue-copy.ts`):
 * each message a field keyed by its path under `tools.mortgage`, the
 * catalogue's English and Arabic the defaults, only the differences stored,
 * and the page laying them over the catalogue for the calculator to read.
 *
 * These sections are copy, not layout: `locked`, so they can't be hidden or
 * moved, and the calculator renders nothing for their keys.
 *
 * The inputs' words are the exception. They sit on the Mortgage calculator
 * section itself (`scenario`), beside the ranges and the "opens on" choices
 * for the same controls: an editor looking at "Mortgage type · opens on"
 * looked there for the Fixed / Variable / Hybrid wording too, and never found
 * it in a section of its own further down the list.
 */

import enTools from "@/messages/en/tools.json";
import arTools from "@/messages/ar/tools.json";
import {
  catalogueCopyIssues,
  catalogueOverlay,
  catalogueStoredValues,
  flattenCatalogue,
  isCountedMessage,
  type Catalogue,
  type CatalogueCopyIssue,
  type MessageTree,
} from "../catalogue-copy";
import { area, text } from "../fields";
import type { Locale } from "@/lib/i18n/locales";
import type { ResolvedSection, SectionDef, SectionValues, SimpleFieldDef } from "../types";

const EN = new Map(flattenCatalogue(enTools.mortgage as Catalogue));
const AR = new Map(flattenCatalogue(arTools.mortgage as Catalogue));

type Group = {
  key: string;
  label: string;
  description: string;
  /** Whether a message (by its path under `tools.mortgage`) belongs here. */
  owns: (path: string) => boolean;
  /**
   * A band of the page that carries these fields after its own, instead of a
   * section of their own. The band keeps its key, so nothing stored moves.
   */
  host?: string;
};

const starts = (...prefixes: string[]) => (path: string) => prefixes.some((p) => path.startsWith(p));

/** In the order a visitor meets them. Every message belongs to exactly one. */
const GROUPS: readonly Group[] = [
  {
    key: "calc_inputs",
    host: "scenario",
    label: "Calculator · Your numbers",
    description:
      "The calculator's inputs: property price, down payment and its minimum warning, interest rate, term, mortgage type, buyer status and annual income.",
    owns: starts(
      "propertyPrice",
      "downPayment",
      "belowGuidance",
      "interestRate",
      "term",
      "mortgageType",
      "type",
      "buyerStatus",
      "status",
      "annualIncome",
      "affordabilityHelp",
    ),
  },
  {
    key: "calc_results",
    label: "Calculator · Results and affordability",
    description:
      "The monthly payment and what's under it, the affordability line, and the debt-burden ratio gauge with its explainer.",
    owns: starts("monthlyPayment", "borrowedFor", "totalToPay", "totalInterest", "principalShare", "affordability", "dbr"),
  },
  {
    key: "calc_closing",
    label: "Calculator · Cash to close",
    description: "The total cash needed at close, each closing-cost line and the note beside it, and the currency note.",
    owns: starts("cash"),
  },
  {
    key: "calc_compare",
    label: "Calculator · Scenarios and schedule",
    description: "The three scenario cards and the amortization chart.",
    owns: starts("scenario", "amort"),
  },
  {
    key: "calc_summary",
    label: "Calculator · Your scenario and PDF",
    description: "The scenario summary beside the pre-approval band, and the PDF button with its messages.",
    owns: starts("line", "pdf"),
  },
];

function groupOf(path: string): Group {
  // `affordabilityHelp` sits under the income input; the other `affordability…`
  // messages are results. First match wins, so the inputs claim it first.
  const group = GROUPS.find((g) => g.owns(path));
  if (!group) throw new Error(`mortgage-calculator-copy: "${path}" belongs to no section`);
  return group;
}

// ── Labels ───────────────────────────────────────────────────────

const WORDS: Record<string, string> = {
  aria: "screen-reader text",
  slider: "slider (screen-reader text)",
  dbr: "DBR",
  dld: "DLD",
  noc: "NOC",
  pdf: "PDF",
  amort: "chart",
  pct: "percentage",
  uae: "UAE",
  gcc: "GCC",
};

function words(segment: string): string {
  return segment
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((w) => WORDS[w.toLowerCase()] ?? w.toLowerCase())
    .join(" ");
}

/**
 * The inputs' labels by hand: they share a section with the controls they name,
 * so each says which control and which part of it ("Mortgage type · Fixed
 * button"), where the derived "Type fixed" did not.
 */
const LABELS: Record<string, string> = {
  propertyPrice: "Property price · label",
  propertyPriceAria: "Property price · box (screen-reader text)",
  propertyPriceSlider: "Property price · slider (screen-reader text)",
  downPayment: "Down payment · label",
  downPaymentAria: "Down payment · box (screen-reader text)",
  downPaymentSlider: "Down payment · slider (screen-reader text)",
  belowGuidance: "Down payment · below the minimum",
  belowGuidanceHighTier: "Down payment · below the minimum, AED 5M and above",
  belowGuidanceHighTierConverted: "Down payment · below the minimum, AED 5M and above, other currency",
  interestRate: "Interest rate · label",
  interestRateAria: "Interest rate · box (screen-reader text)",
  term: "Term · label",
  termYears: "Term · each option",
  mortgageType: "Mortgage type · label",
  typeFixed: "Mortgage type · Fixed button",
  typeVariable: "Mortgage type · Variable button",
  typeHybrid: "Mortgage type · Hybrid button",
  typeFixedInline: "Mortgage type · Fixed, mid-sentence",
  typeVariableInline: "Mortgage type · Variable, mid-sentence",
  typeHybridInline: "Mortgage type · Hybrid, mid-sentence",
  buyerStatus: "Buyer status · label",
  statusUaeNational: "Buyer status · UAE national button",
  statusUaeResident: "Buyer status · UAE resident button",
  statusNonResident: "Buyer status · Non-resident button",
  statusGccNational: "Buyer status · GCC national button",
  annualIncome: "Annual income · label",
  annualIncomeAria: "Annual income · box (screen-reader text)",
  affordabilityHelp: "Annual income · note under the box",
};

/** "cashLine.dld_transfer" → "Cash line · DLD transfer"; "propertyPriceAria" → "Property price screen-reader text". */
function labelFor(path: string): string {
  if (LABELS[path]) return LABELS[path];
  const label = path.split(".").map(words).join(" · ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fieldFor(path: string): SimpleFieldDef {
  const message = EN.get(path)!;
  const long = message.length > 90;
  const max = Math.max(long ? 600 : 160, Math.ceil(message.length * 2));
  // Every message gets an Arabic twin, even a near-symbol one like "Y{year}":
  // the catalogue's Arabic differs, and a field with no twin would hand /ar
  // the English.
  return long ? area(path, labelFor(path), { max, optional: false }) : text(path, labelFor(path), { max, optional: false });
}

/** Every calculator message the editor offers, by path under `tools.mortgage`. */
export const MORTGAGE_CALCULATOR_COPY_KEYS: readonly string[] = [...EN.entries()]
  .filter(([, message]) => !isCountedMessage(message))
  .map(([key]) => key);

const byGroup = new Map<string, string[]>(GROUPS.map((g) => [g.key, []]));
for (const path of MORTGAGE_CALCULATOR_COPY_KEYS) byGroup.get(groupOf(path).key)!.push(path);

function defaultsFor(paths: readonly string[]): SectionValues {
  const defaults: SectionValues = {};
  for (const path of paths) {
    defaults[path] = EN.get(path)!;
    defaults[`${path}_ar`] = AR.get(path) ?? EN.get(path)!;
  }
  return defaults;
}

/**
 * The calculator copy a band of the page carries after its own fields (see
 * `Group.host`), with the catalogue's English and Arabic as defaults. Empty
 * for a band that hosts none.
 */
export function calculatorCopyHostedBy(host: string): { fields: SimpleFieldDef[]; defaults: SectionValues } {
  const paths = GROUPS.filter((g) => g.host === host).flatMap((g) => byGroup.get(g.key)!);
  return { fields: paths.map(fieldFor), defaults: defaultsFor(paths) };
}

function buildSections(): SectionDef[] {
  return GROUPS.filter((group) => !group.host).map((group): SectionDef => {
    const paths = byGroup.get(group.key)!;
    const defaults = defaultsFor(paths);
    return {
      key: group.key,
      label: group.label,
      description: group.description,
      locked: true,
      dataNote:
        "Keep anything in {curly braces}: the calculator fills it in with the visitor's figures. The numbers themselves — fees, LTV tiers, DBR bands, the opening scenario — are in Settings → Mortgage.",
      fields: paths.map(fieldFor),
      defaults,
    };
  });
}

export const MORTGAGE_CALCULATOR_COPY_SECTIONS: readonly SectionDef[] = buildSections();

const COPY_KEYS = new Set(GROUPS.filter((g) => !g.host).map((g) => g.key));
const HOSTS = new Set(GROUPS.flatMap((g) => (g.host ? [g.host] : [])));

/** Whether a section of the Mortgage page is calculator copy rather than a band of the page. */
export function isCalculatorCopySection(key: string): boolean {
  return COPY_KEYS.has(key);
}

/** Whether a section holds calculator copy at all: a copy section, or a band hosting some. */
function carriesCalculatorCopy(key: string): boolean {
  return COPY_KEYS.has(key) || HOSTS.has(key);
}

/** The save's checks for the calculator copy: placeholders kept, nothing unformattable. */
export function calculatorCopyIssues(sections: readonly { key: string; values: SectionValues }[]): CatalogueCopyIssue[] {
  return catalogueCopyIssues(
    sections.flatMap((section) => {
      const def = MORTGAGE_CALCULATOR_COPY_SECTIONS.find((s) => s.key === section.key);
      if (def) return [{ label: def.label, fields: def.fields, values: section.values }];
      // A hosting band's own fields aren't catalogue messages, so the check
      // passes over them; its label is the band's, which is where the editor is.
      const hosted = HOSTS.has(section.key) ? calculatorCopyHostedBy(section.key).fields : [];
      return hosted.length ? [{ label: "Mortgage calculator", fields: hosted, values: section.values }] : [];
    }),
    EN,
  );
}

/**
 * Calculator copy as stored: only what differs from the catalogue. Other
 * sections pass through, and so do a hosting band's own fields — a blank
 * eyebrow there is an editor's choice, not a default to fall back to.
 */
export function calculatorCopyStoredValues<T extends { key: string; values: SectionValues }>(sections: readonly T[]): T[] {
  return sections.map((section) => {
    if (isCalculatorCopySection(section.key)) return { ...section, values: catalogueStoredValues(section.values, EN, AR) };
    if (!HOSTS.has(section.key)) return section;
    const own: SectionValues = {};
    const copy: SectionValues = {};
    for (const [k, v] of Object.entries(section.values)) {
      if (EN.has(k.endsWith("_ar") ? k.slice(0, -3) : k)) copy[k] = v;
      else own[k] = v;
    }
    return { ...section, values: { ...own, ...catalogueStoredValues(copy, EN, AR) } };
  });
}

/** The `tools.mortgage` messages an editor changed, for one locale; empty when nothing is. */
export function calculatorCopyOverlay(sections: readonly ResolvedSection[], locale: Locale): MessageTree {
  return catalogueOverlay(
    sections.filter((s) => carriesCalculatorCopy(s.key)),
    locale,
    EN,
    AR,
  );
}
